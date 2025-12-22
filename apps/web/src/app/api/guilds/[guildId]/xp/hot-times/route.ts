import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { createXpHotTimeSchema } from "@/types/xp";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface HotTimeRow extends RowDataPacket {
  id: number;
  guild_id: string;
  type: "text" | "voice" | "all";
  start_time: string;
  end_time: string;
  multiplier: number;
  enabled: boolean;
  created_at: Date;
}

interface HotTimeChannelRow extends RowDataPacket {
  channel_id: string;
}

function rowToHotTime(row: HotTimeRow, channelIds: string[] = []) {
  return {
    id: row.id,
    guildId: row.guild_id,
    type: row.type,
    startTime: row.start_time,
    endTime: row.end_time,
    multiplier: Number(row.multiplier),
    enabled: row.enabled,
    createdAt: row.created_at,
    channelIds,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;

  try {
    const pool = db();
    const [rows] = await pool.query<HotTimeRow[]>(
      `SELECT * FROM xp_hot_times WHERE guild_id = ? ORDER BY start_time`,
      [guildId]
    );

    // 각 핫타임의 채널 목록 조회
    const hotTimesWithChannels = await Promise.all(
      rows.map(async (row) => {
        const [channelRows] = await pool.query<HotTimeChannelRow[]>(
          `SELECT channel_id FROM xp_hot_time_channels WHERE hot_time_id = ?`,
          [row.id]
        );
        return rowToHotTime(row, channelRows.map(c => c.channel_id));
      })
    );

    return NextResponse.json(hotTimesWithChannels);
  } catch (error) {
    console.error("Error fetching hot times:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;

  try {
    const body = await request.json();
    const validatedData = createXpHotTimeSchema.parse(body);
    const channelIds: string[] = body.channelIds || [];

    const pool = db();

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO xp_hot_times (guild_id, type, start_time, end_time, multiplier, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        guildId,
        validatedData.type,
        validatedData.startTime,
        validatedData.endTime,
        validatedData.multiplier,
        validatedData.enabled ?? true,
      ]
    );

    const hotTimeId = result.insertId;

    // 채널 설정 저장
    if (channelIds.length > 0) {
      const channelValues = channelIds.map(channelId => [hotTimeId, channelId]);
      await pool.query(
        `INSERT INTO xp_hot_time_channels (hot_time_id, channel_id) VALUES ?`,
        [channelValues]
      );
    }

    const newHotTime = {
      id: hotTimeId,
      guildId,
      ...validatedData,
      enabled: validatedData.enabled ?? true,
      channelIds,
    };

    // 봇에 설정 변경 알림
    await notifyBotSettingsChanged({
      guildId,
      type: 'xp-hottime',
      action: '추가',
      details: `${validatedData.startTime}~${validatedData.endTime} (${validatedData.multiplier}배)`,
    });

    return NextResponse.json(newHotTime, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating hot time:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validatedData = createXpHotTimeSchema.partial().parse(body);
    const channelIds: string[] | undefined = body.channelIds;

    const pool = db();
    const hotTimeId = parseInt(id);

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | boolean)[] = [];

    if (validatedData.type !== undefined) {
      updates.push("type = ?");
      values.push(validatedData.type);
    }
    if (validatedData.startTime !== undefined) {
      updates.push("start_time = ?");
      values.push(validatedData.startTime);
    }
    if (validatedData.endTime !== undefined) {
      updates.push("end_time = ?");
      values.push(validatedData.endTime);
    }
    if (validatedData.multiplier !== undefined) {
      updates.push("multiplier = ?");
      values.push(validatedData.multiplier);
    }
    if (validatedData.enabled !== undefined) {
      updates.push("enabled = ?");
      values.push(validatedData.enabled);
    }

    // 핫타임 기본 정보 업데이트
    if (updates.length > 0) {
      values.push(hotTimeId, guildId);
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE xp_hot_times SET ${updates.join(", ")} WHERE id = ? AND guild_id = ?`,
        values
      );

      if (result.affectedRows === 0) {
        return NextResponse.json({ error: "Hot time not found" }, { status: 404 });
      }
    }

    // 채널 설정 업데이트 (channelIds가 전달된 경우에만)
    if (channelIds !== undefined) {
      // 기존 채널 삭제
      await pool.query(
        `DELETE FROM xp_hot_time_channels WHERE hot_time_id = ?`,
        [hotTimeId]
      );

      // 새 채널 추가
      if (channelIds.length > 0) {
        const channelValues = channelIds.map(channelId => [hotTimeId, channelId]);
        await pool.query(
          `INSERT INTO xp_hot_time_channels (hot_time_id, channel_id) VALUES ?`,
          [channelValues]
        );
      }
    }

    // Fetch and return updated hot time with channels
    const [rows] = await pool.query<HotTimeRow[]>(
      `SELECT * FROM xp_hot_times WHERE id = ?`,
      [hotTimeId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Hot time not found" }, { status: 404 });
    }

    const [channelRows] = await pool.query<HotTimeChannelRow[]>(
      `SELECT channel_id FROM xp_hot_time_channels WHERE hot_time_id = ?`,
      [hotTimeId]
    );

    // 봇에 설정 변경 알림
    await notifyBotSettingsChanged({
      guildId,
      type: 'xp-hottime',
      action: '수정',
      details: `ID: ${id}`,
    });

    return NextResponse.json(rowToHotTime(rows[0]!, channelRows.map(c => c.channel_id)));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating hot time:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const pool = db();
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM xp_hot_times WHERE id = ? AND guild_id = ?`,
      [parseInt(id), guildId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Hot time not found" }, { status: 404 });
    }

    // 봇에 설정 변경 알림
    await notifyBotSettingsChanged({
      guildId,
      type: 'xp-hottime',
      action: '삭제',
      details: `ID: ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting hot time:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
