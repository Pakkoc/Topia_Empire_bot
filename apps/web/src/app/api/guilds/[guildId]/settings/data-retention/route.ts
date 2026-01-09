import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";

const DEFAULT_RETENTION_DAYS = 3;

interface DataRetentionSettingsRow extends RowDataPacket {
  guild_id: string;
  retention_days: number;
  created_at: Date;
  updated_at: Date;
}

interface LeftMemberRow extends RowDataPacket {
  guild_id: string;
  user_id: string;
  left_at: Date;
  expires_at: Date;
  created_at: Date;
}

const updateDataRetentionSchema = z.object({
  retentionDays: z.number().min(0).max(30), // 프리미엄 구독 시 최대 100일로 확장 예정
});

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

    // 설정 조회
    const [settingsRows] = await pool.query<DataRetentionSettingsRow[]>(
      `SELECT * FROM data_retention_settings WHERE guild_id = ?`,
      [guildId]
    );

    const settings = settingsRows[0];

    // 탈퇴 멤버 목록 조회
    const [leftMemberRows] = await pool.query<LeftMemberRow[]>(
      `SELECT * FROM left_members WHERE guild_id = ? ORDER BY left_at DESC`,
      [guildId]
    );

    return NextResponse.json({
      guildId,
      retentionDays: settings?.retention_days ?? DEFAULT_RETENTION_DAYS,
      leftMembers: leftMemberRows.map(row => ({
        userId: row.user_id,
        leftAt: row.left_at,
        expiresAt: row.expires_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching data retention settings:", error);
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

  try {
    const body = await request.json();
    const validatedData = updateDataRetentionSchema.parse(body);

    const pool = db();

    // 설정 저장 (upsert)
    await pool.query(
      `INSERT INTO data_retention_settings (guild_id, retention_days, created_at, updated_at)
       VALUES (?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
       retention_days = VALUES(retention_days),
       updated_at = NOW()`,
      [guildId, validatedData.retentionDays]
    );

    // 기존 탈퇴 멤버의 만료 시간 업데이트 (새 보존 기간 적용)
    if (validatedData.retentionDays > 0) {
      await pool.query(
        `UPDATE left_members
         SET expires_at = DATE_ADD(left_at, INTERVAL ? DAY)
         WHERE guild_id = ?`,
        [validatedData.retentionDays, guildId]
      );
    }

    // 업데이트된 설정 반환
    const [settingsRows] = await pool.query<DataRetentionSettingsRow[]>(
      `SELECT * FROM data_retention_settings WHERE guild_id = ?`,
      [guildId]
    );

    const [leftMemberRows] = await pool.query<LeftMemberRow[]>(
      `SELECT * FROM left_members WHERE guild_id = ? ORDER BY left_at DESC`,
      [guildId]
    );

    return NextResponse.json({
      guildId,
      retentionDays: settingsRows[0]?.retention_days ?? DEFAULT_RETENTION_DAYS,
      leftMembers: leftMemberRows.map(row => ({
        userId: row.user_id,
        leftAt: row.left_at,
        expiresAt: row.expires_at,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating data retention settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
