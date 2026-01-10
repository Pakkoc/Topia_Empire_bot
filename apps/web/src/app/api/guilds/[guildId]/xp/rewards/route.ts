import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { createLevelRewardSchema } from "@/types/xp";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

type XpType = 'text' | 'voice';

interface RewardRow extends RowDataPacket {
  id: number;
  guild_id: string;
  type: XpType;
  level: number;
  role_id: string;
  remove_on_higher_level: boolean;
  created_at: Date;
}

function rowToReward(row: RewardRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    type: row.type,
    level: row.level,
    roleId: row.role_id,
    removeOnHigherLevel: row.remove_on_higher_level,
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
    const [rows] = await pool.query<RewardRow[]>(
      `SELECT * FROM xp_level_rewards WHERE guild_id = ? AND type = ? ORDER BY level`,
      [guildId, xpType]
    );

    return NextResponse.json(rows.map(rowToReward));
  } catch (error) {
    console.error("Error fetching rewards:", error);
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
    const validatedData = createLevelRewardSchema.parse(body);

    const pool = db();

    // Check for duplicate level-role combination
    const [existing] = await pool.query<RewardRow[]>(
      `SELECT id FROM xp_level_rewards WHERE guild_id = ? AND type = ? AND level = ? AND role_id = ?`,
      [guildId, xpType, validatedData.level, validatedData.roleId]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Reward for this level and role already exists" },
        { status: 409 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO xp_level_rewards (guild_id, type, level, role_id, remove_on_higher_level)
       VALUES (?, ?, ?, ?, ?)`,
      [
        guildId,
        xpType,
        validatedData.level,
        validatedData.roleId,
        validatedData.removeOnHigherLevel ?? false,
      ]
    );

    const typeLabel = xpType === 'text' ? '텍스트' : '음성';

    const newReward = {
      id: result.insertId,
      guildId,
      type: xpType,
      level: validatedData.level,
      roleId: validatedData.roleId,
      removeOnHigherLevel: validatedData.removeOnHigherLevel ?? false,
    };

    // 봇에 설정 변경 알림 (비동기, 대기 안함)
    notifyBotSettingsChanged({
      guildId,
      type: 'xp-reward',
      action: '추가',
      details: `${typeLabel} 레벨 ${validatedData.level} 보상 역할`,
    });

    return NextResponse.json(newReward, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating reward:", error);
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
    const validatedData = createLevelRewardSchema.partial().parse(body);

    const pool = db();

    // Build update query dynamically
    const updates: string[] = [];
    const values: (number | string | boolean)[] = [];

    if (validatedData.level !== undefined) {
      updates.push("level = ?");
      values.push(validatedData.level);
    }
    if (validatedData.roleId !== undefined) {
      updates.push("role_id = ?");
      values.push(validatedData.roleId);
    }
    if (validatedData.removeOnHigherLevel !== undefined) {
      updates.push("remove_on_higher_level = ?");
      values.push(validatedData.removeOnHigherLevel);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(parseInt(id), guildId);

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE xp_level_rewards SET ${updates.join(", ")} WHERE id = ? AND guild_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    // Fetch and return updated reward
    const [rows] = await pool.query<RewardRow[]>(
      `SELECT * FROM xp_level_rewards WHERE id = ?`,
      [parseInt(id)]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    // 봇에 설정 변경 알림 (비동기, 대기 안함)
    notifyBotSettingsChanged({
      guildId,
      type: 'xp-reward',
      action: '수정',
      details: `ID: ${id}`,
    });

    return NextResponse.json(rowToReward(rows[0]!));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error updating reward:", error);
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
      `DELETE FROM xp_level_rewards WHERE id = ? AND guild_id = ?`,
      [parseInt(id), guildId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    // 봇에 설정 변경 알림 (비동기, 대기 안함)
    notifyBotSettingsChanged({
      guildId,
      type: 'xp-reward',
      action: '삭제',
      details: `ID: ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reward:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
