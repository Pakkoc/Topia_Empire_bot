import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface LevelDistributionRow extends RowDataPacket {
  level_range: string;
  count: number;
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

    // 텍스트 레벨 분포
    const [textLevelStats] = await pool.query<LevelDistributionRow[]>(
      `SELECT
        CASE
          WHEN text_level = 0 THEN '0'
          WHEN text_level BETWEEN 1 AND 5 THEN '1-5'
          WHEN text_level BETWEEN 6 AND 10 THEN '6-10'
          WHEN text_level BETWEEN 11 AND 20 THEN '11-20'
          WHEN text_level BETWEEN 21 AND 30 THEN '21-30'
          WHEN text_level BETWEEN 31 AND 50 THEN '31-50'
          ELSE '51+'
        END as level_range,
        COUNT(*) as count
       FROM xp_users
       WHERE guild_id = ?
       GROUP BY level_range
       ORDER BY FIELD(level_range, '0', '1-5', '6-10', '11-20', '21-30', '31-50', '51+')`,
      [guildId]
    );

    // 음성 레벨 분포
    const [voiceLevelStats] = await pool.query<LevelDistributionRow[]>(
      `SELECT
        CASE
          WHEN voice_level = 0 THEN '0'
          WHEN voice_level BETWEEN 1 AND 5 THEN '1-5'
          WHEN voice_level BETWEEN 6 AND 10 THEN '6-10'
          WHEN voice_level BETWEEN 11 AND 20 THEN '11-20'
          WHEN voice_level BETWEEN 21 AND 30 THEN '21-30'
          WHEN voice_level BETWEEN 31 AND 50 THEN '31-50'
          ELSE '51+'
        END as level_range,
        COUNT(*) as count
       FROM xp_users
       WHERE guild_id = ?
       GROUP BY level_range
       ORDER BY FIELD(level_range, '0', '1-5', '6-10', '11-20', '21-30', '31-50', '51+')`,
      [guildId]
    );

    const levelRanges = ['0', '1-5', '6-10', '11-20', '21-30', '31-50', '51+'];

    // 텍스트 레벨 분포 맵
    const textMap = new Map(textLevelStats.map(r => [r.level_range, Number(r.count)]));
    const textDistribution = levelRanges.map(range => ({
      range,
      count: textMap.get(range) ?? 0,
    }));

    // 음성 레벨 분포 맵
    const voiceMap = new Map(voiceLevelStats.map(r => [r.level_range, Number(r.count)]));
    const voiceDistribution = levelRanges.map(range => ({
      range,
      count: voiceMap.get(range) ?? 0,
    }));

    const totalMembers = textDistribution.reduce((sum, d) => sum + d.count, 0);

    return NextResponse.json({
      textDistribution,
      voiceDistribution,
      totalMembers,
    });
  } catch (error) {
    console.error("Error fetching level distribution:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
