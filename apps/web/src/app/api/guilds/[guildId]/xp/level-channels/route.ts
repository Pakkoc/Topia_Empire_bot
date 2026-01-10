import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged, lockChannel, unlockChannelForUsers } from "@/lib/bot-notify";
import { createLevelUnlockChannelSchema } from "@/types/xp";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

type XpType = 'text' | 'voice';

interface LevelChannelRow extends RowDataPacket {
  id: number;
  guild_id: string;
  type: XpType;
  level: number;
  channel_id: string;
  created_at: Date;
}

interface XpUserRow extends RowDataPacket {
  user_id: string;
  text_level: number;
  voice_level: number;
}

function rowToLevelChannel(row: LevelChannelRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    type: row.type,
    level: row.level,
    channelId: row.channel_id,
    createdAt: row.created_at,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const { searchParams } = new URL(request.url);
  const xpType = (searchParams.get("type") || "text") as XpType;

  try {
    const pool = db();
    const [rows] = await pool.query<LevelChannelRow[]>(
      `SELECT * FROM xp_level_channels WHERE guild_id = ? AND type = ? ORDER BY level`,
      [guildId, xpType]
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
  const { searchParams } = new URL(request.url);
  const xpType = (searchParams.get("type") || "text") as XpType;

  try {
    const body = await request.json();
    const validatedData = createLevelUnlockChannelSchema.parse(body);

    const pool = db();

    // Check for duplicate - same channel can only be linked to one level per type
    const [existing] = await pool.query<LevelChannelRow[]>(
      `SELECT id FROM xp_level_channels WHERE guild_id = ? AND type = ? AND channel_id = ?`,
      [guildId, xpType, validatedData.channelId]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "This channel is already linked to a level" },
        { status: 409 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO xp_level_channels (guild_id, type, level, channel_id)
       VALUES (?, ?, ?, ?)`,
      [guildId, xpType, validatedData.level, validatedData.channelId]
    );

    const newLevelChannel = {
      id: result.insertId,
      guildId,
      type: xpType,
      level: validatedData.level,
      channelId: validatedData.channelId,
    };

    // 채널 잠금 (봇이 @everyone ViewChannel 권한 거부)
    await lockChannel(guildId, validatedData.channelId);

    // 소급 적용: 이미 해당 레벨 이상인 유저들에게 채널 해금
    const levelColumn = xpType === 'text' ? 'text_level' : 'voice_level';
    const [eligibleUsers] = await pool.query<XpUserRow[]>(
      `SELECT user_id, text_level, voice_level FROM xp_users WHERE guild_id = ? AND ${levelColumn} >= ?`,
      [guildId, validatedData.level]
    );

    if (eligibleUsers.length > 0) {
      const userIds = eligibleUsers.map(u => u.user_id);
      const unlockResult = await unlockChannelForUsers(guildId, validatedData.channelId, userIds);
      console.log(`[LEVEL CHANNEL] Retroactive unlock: ${unlockResult.unlocked}/${userIds.length} users for ${xpType} level ${validatedData.level}`);
    }

    const typeLabel = xpType === 'text' ? '텍스트' : '음성';

    notifyBotSettingsChanged({
      guildId,
      type: 'xp-level-channel',
      action: '추가',
      details: `${typeLabel} 레벨 ${validatedData.level} 해금 채널 (소급 적용: ${eligibleUsers.length}명)`,
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

    notifyBotSettingsChanged({
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

    notifyBotSettingsChanged({
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
