import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyBotSettingsChanged } from "@/lib/bot-notify";
import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ExclusionRow extends RowDataPacket {
  id: number;
  guild_id: string;
  target_type: "channel" | "role";
  target_id: string;
}

const bulkCreateSchema = z.object({
  targetType: z.enum(["channel", "role"]),
  targetIds: z.array(z.string().min(1)).min(1).max(50),
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

  try {
    const body = await request.json();
    const validatedData = bulkCreateSchema.parse(body);

    const pool = db();

    // 이미 존재하는 항목 조회
    const [existing] = await pool.query<ExclusionRow[]>(
      `SELECT target_id FROM xp_exclusions WHERE guild_id = ? AND target_type = ? AND target_id IN (?)`,
      [guildId, validatedData.targetType, validatedData.targetIds]
    );

    const existingIds = new Set(existing.map((e) => e.target_id));
    const newIds = validatedData.targetIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) {
      return NextResponse.json({
        created: 0,
        skipped: validatedData.targetIds.length,
        message: "모든 항목이 이미 존재합니다.",
      });
    }

    // 새 항목 추가
    const values = newIds.map((id) => [guildId, validatedData.targetType, id]);
    await pool.query<ResultSetHeader>(
      `INSERT INTO xp_exclusions (guild_id, target_type, target_id) VALUES ?`,
      [values]
    );

    // 봇에 설정 변경 알림 (한 번에)
    await notifyBotSettingsChanged({
      guildId,
      type: "xp-exclusion",
      action: "추가",
      details: `${validatedData.targetType === "channel" ? "채널" : "역할"} ${newIds.length}개 추가`,
    });

    return NextResponse.json({
      created: newIds.length,
      skipped: existingIds.size,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error bulk creating exclusions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
