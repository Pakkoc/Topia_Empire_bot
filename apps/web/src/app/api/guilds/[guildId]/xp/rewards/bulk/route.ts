import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

type XpType = 'text' | 'voice';

interface RewardRow extends RowDataPacket {
  id: number;
  guild_id: string;
  type: XpType;
  level: number;
  role_id: string;
}

const bulkCreateSchema = z.object({
  level: z.number().min(1).max(999),
  roleIds: z.array(z.string().min(1)).min(1).max(50),
  removeOnHigherLevel: z.boolean(),
});

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
    const validatedData = bulkCreateSchema.parse(body);

    const pool = db();

    // 이미 존재하는 보상 조회 (같은 타입, 같은 레벨, 같은 역할)
    const [existing] = await pool.query<RewardRow[]>(
      `SELECT role_id FROM xp_level_rewards WHERE guild_id = ? AND type = ? AND level = ? AND role_id IN (?)`,
      [guildId, xpType, validatedData.level, validatedData.roleIds]
    );

    const existingRoleIds = new Set(existing.map((e) => e.role_id));
    const newRoleIds = validatedData.roleIds.filter((id) => !existingRoleIds.has(id));

    if (newRoleIds.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: validatedData.roleIds.length,
        message: "모든 보상이 이미 존재합니다.",
      });
    }

    // 새 보상 추가
    const values = newRoleIds.map((roleId) => [
      guildId,
      xpType,
      validatedData.level,
      roleId,
      validatedData.removeOnHigherLevel,
    ]);
    await pool.query<ResultSetHeader>(
      `INSERT INTO xp_level_rewards (guild_id, type, level, role_id, remove_on_higher_level) VALUES ?`,
      [values]
    );

    const typeLabel = xpType === 'text' ? '텍스트' : '음성';

    // 봇에 설정 변경 알림 (비동기, 대기 안함)
    notifyBotSettingsChanged({
      guildId,
      type: "xp-reward",
      action: "추가",
      details: `${typeLabel} 레벨 ${validatedData.level}에 역할 ${newRoleIds.length}개 추가`,
    });

    return NextResponse.json({
      created: newRoleIds.length,
      skipped: existingRoleIds.size,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error bulk creating rewards:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
