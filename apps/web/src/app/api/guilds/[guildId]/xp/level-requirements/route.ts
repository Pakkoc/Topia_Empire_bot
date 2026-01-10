import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

type XpType = 'text' | 'voice';

interface LevelRequirementRow extends RowDataPacket {
  guild_id: string;
  type: XpType;
  level: number;
  required_xp: number;
  created_at: Date;
  updated_at: Date;
}

function rowToRequirement(row: LevelRequirementRow) {
  return {
    guildId: row.guild_id,
    type: row.type,
    level: row.level,
    requiredXp: row.required_xp,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const saveLevelRequirementSchema = z.object({
  level: z.number().min(1).max(999),
  requiredXp: z.number().min(0),
});

const bulkSaveSchema = z.array(saveLevelRequirementSchema);

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
  const type = (searchParams.get("type") || "text") as XpType;

  try {
    const pool = db();
    const [rows] = await pool.query<LevelRequirementRow[]>(
      `SELECT * FROM xp_level_requirements WHERE guild_id = ? AND type = ? ORDER BY level`,
      [guildId, type]
    );

    return NextResponse.json(rows.map(rowToRequirement));
  } catch (error) {
    console.error("Error fetching level requirements:", error);
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
    const validatedData = saveLevelRequirementSchema.parse(body);

    const pool = db();

    await pool.query<ResultSetHeader>(
      `INSERT INTO xp_level_requirements (guild_id, type, level, required_xp)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE required_xp = VALUES(required_xp), updated_at = NOW()`,
      [guildId, xpType, validatedData.level, validatedData.requiredXp]
    );

    const newRequirement = {
      guildId,
      type: xpType,
      level: validatedData.level,
      requiredXp: validatedData.requiredXp,
    };

    const typeLabel = xpType === 'text' ? '텍스트' : '음성';

    // 봇에 설정 변경 알림 (비동기, 대기 안함)
    notifyBotSettingsChanged({
      guildId,
      type: 'xp-level-requirement',
      action: '추가',
      details: `${typeLabel} 레벨 ${validatedData.level}: ${validatedData.requiredXp} XP`,
    });

    return NextResponse.json(newRequirement, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error saving level requirement:", error);
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
  const xpType = (searchParams.get("type") || "text") as XpType;

  try {
    const body = await request.json();
    const validatedData = bulkSaveSchema.parse(body);

    const pool = db();

    // 기존 데이터 삭제 후 새로 저장 (해당 타입만 전체 교체)
    await pool.query(`DELETE FROM xp_level_requirements WHERE guild_id = ? AND type = ?`, [guildId, xpType]);

    if (validatedData.length > 0) {
      const values = validatedData.map((item) => [guildId, xpType, item.level, item.requiredXp]);
      await pool.query(
        `INSERT INTO xp_level_requirements (guild_id, type, level, required_xp) VALUES ?`,
        [values]
      );
    }

    // 새로 저장된 데이터 반환
    const [rows] = await pool.query<LevelRequirementRow[]>(
      `SELECT * FROM xp_level_requirements WHERE guild_id = ? AND type = ? ORDER BY level`,
      [guildId, xpType]
    );

    const typeLabel = xpType === 'text' ? '텍스트' : '음성';

    // 봇에 설정 변경 알림 (비동기, 대기 안함)
    notifyBotSettingsChanged({
      guildId,
      type: 'xp-level-requirement',
      action: '변경',
      details: `${typeLabel} ${validatedData.length}개 레벨 설정 저장`,
    });

    return NextResponse.json(rows.map(rowToRequirement));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error bulk saving level requirements:", error);
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
  const level = searchParams.get("level");
  const xpType = (searchParams.get("type") || "text") as XpType;
  const typeLabel = xpType === 'text' ? '텍스트' : '음성';

  try {
    const pool = db();

    if (level) {
      // 특정 레벨만 삭제
      const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM xp_level_requirements WHERE guild_id = ? AND type = ? AND level = ?`,
        [guildId, xpType, parseInt(level)]
      );

      if (result.affectedRows === 0) {
        return NextResponse.json({ error: "Level requirement not found" }, { status: 404 });
      }

      // 봇에 설정 변경 알림 (비동기, 대기 안함)
      notifyBotSettingsChanged({
        guildId,
        type: 'xp-level-requirement',
        action: '삭제',
        details: `${typeLabel} 레벨 ${level}`,
      });
    } else {
      // 해당 타입 전체 삭제
      await pool.query(
        `DELETE FROM xp_level_requirements WHERE guild_id = ? AND type = ?`,
        [guildId, xpType]
      );

      // 봇에 설정 변경 알림 (비동기, 대기 안함)
      notifyBotSettingsChanged({
        guildId,
        type: 'xp-level-requirement',
        action: '삭제',
        details: `${typeLabel} 전체 레벨 설정 삭제`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting level requirements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
