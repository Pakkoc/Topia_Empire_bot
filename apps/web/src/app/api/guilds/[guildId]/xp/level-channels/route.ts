import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged, lockChannel } from "@/lib/bot-notify";
import { createLevelUnlockChannelSchema } from "@/types/xp";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface LevelChannelRow extends RowDataPacket {
  id: number;
  guild_id: string;
  level: number;
  channel_id: string;
  created_at: Date;
}

function rowToLevelChannel(row: LevelChannelRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    level: row.level,
    channelId: row.channel_id,
    createdAt: row.created_at,
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
    const [rows] = await pool.query<LevelChannelRow[]>(
      `SELECT * FROM xp_level_channels WHERE guild_id = ? ORDER BY level`,
      [guildId]
    );

    return NextResponse.json(rows.map(rowToLevelChannel));
  } catch (error) {
    console.error("Error fetching level channels:", error);
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
    const validatedData = createLevelUnlockChannelSchema.parse(body);

    const pool = db();

    // Check for duplicate - same channel can only be linked to one level
    const [existing] = await pool.query<LevelChannelRow[]>(
      `SELECT id FROM xp_level_channels WHERE guild_id = ? AND channel_id = ?`,
      [guildId, validatedData.channelId]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "This channel is already linked to a level" },
        { status: 409 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO xp_level_channels (guild_id, level, channel_id)
       VALUES (?, ?, ?)`,
      [guildId, validatedData.level, validatedData.channelId]
    );

    const newLevelChannel = {
      id: result.insertId,
      guildId,
      level: validatedData.level,
      channelId: validatedData.channelId,
    };

    // 채널 잠금 (봇이 @everyone ViewChannel 권한 거부)
    await lockChannel(guildId, validatedData.channelId);

    await notifyBotSettingsChanged({
      guildId,
      type: 'xp-level-channel',
      action: '추가',
      details: `레벨 ${validatedData.level} 해금 채널`,
    });

    return NextResponse.json(newLevelChannel, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating level channel:", error);
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
    const validatedData = createLevelUnlockChannelSchema.partial().parse(body);

    const pool = db();

    const updates: string[] = [];
    const values: (number | string)[] = [];

    if (validatedData.level !== undefined) {
      updates.push("level = ?");
      values.push(validatedData.level);
    }
    if (validatedData.channelId !== undefined) {
      updates.push("channel_id = ?");
      values.push(validatedData.channelId);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(parseInt(id), guildId);

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE xp_level_channels SET ${updates.join(", ")} WHERE id = ? AND guild_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Level channel not found" }, { status: 404 });
    }

    const [rows] = await pool.query<LevelChannelRow[]>(
      `SELECT * FROM xp_level_channels WHERE id = ?`,
      [parseInt(id)]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Level channel not found" }, { status: 404 });
    }

    await notifyBotSettingsChanged({
      guildId,
      type: 'xp-level-channel',
      action: '수정',
      details: `ID: ${id}`,
    });

    return NextResponse.json(rowToLevelChannel(rows[0]!));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating level channel:", error);
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
      `DELETE FROM xp_level_channels WHERE id = ? AND guild_id = ?`,
      [parseInt(id), guildId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Level channel not found" }, { status: 404 });
    }

    await notifyBotSettingsChanged({
      guildId,
      type: 'xp-level-channel',
      action: '삭제',
      details: `ID: ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting level channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
