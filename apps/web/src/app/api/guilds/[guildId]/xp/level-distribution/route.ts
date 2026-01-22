import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface LevelDistributionRow extends RowDataPacket {
  level_range: string;
  count: number;
}

interface MaxLevelRow extends RowDataPacket {
  max_level: number;
}

// 최대 레벨에 따른 동적 범례 생성
function getDynamicLevelRanges(maxLevel: number): { min: number; max: number; label: string }[] {
  const allRanges = [
    { min: 0, max: 0, label: '0' },
    { min: 1, max: 5, label: '1-5' },
    { min: 6, max: 10, label: '6-10' },
    { min: 11, max: 20, label: '11-20' },
    { min: 21, max: 30, label: '21-30' },
    { min: 31, max: 50, label: '31-50' },
    { min: 51, max: 100, label: '51-100' },
    { min: 101, max: Infinity, label: '100+' },
  ];

  // 최대 레벨을 포함하는 구간까지만 사용
  const ranges: typeof allRanges = [];
  for (const r of allRanges) {
    ranges.push(r);
    if (maxLevel <= r.max) break;
  }
  return ranges;
}

// 동적 범례용 SQL CASE 문 생성
function buildLevelCaseSQL(ranges: { min: number; max: number; label: string }[], columnName: string): string {
  const cases = ranges.map(r => {
    if (r.min === 0 && r.max === 0) {
      return `WHEN ${columnName} = 0 THEN '${r.label}'`;
    }
    if (r.max === Infinity) {
      return `WHEN ${columnName} >= ${r.min} THEN '${r.label}'`;
    }
    return `WHEN ${columnName} BETWEEN ${r.min} AND ${r.max} THEN '${r.label}'`;
  });
  return `CASE ${cases.join(' ')} END`;
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

    // 1. 최대 레벨 조회 (텍스트/음성 중 큰 값)
    const [maxResult] = await pool.query<MaxLevelRow[]>(
      `SELECT GREATEST(
        COALESCE(MAX(text_level), 0),
        COALESCE(MAX(voice_level), 0)
       ) as max_level FROM xp_users WHERE guild_id = ?`,
      [guildId]
    );
    const maxLevel = Number(maxResult[0]?.max_level ?? 0);

    // 2. 최대 레벨 기반 동적 범례 생성
    const ranges = getDynamicLevelRanges(maxLevel);
    const rangeLabels = ranges.map(r => r.label);
    const fieldOrder = rangeLabels.map(l => `'${l}'`).join(', ');

    // 3. 텍스트 레벨 분포
    const textCaseSQL = buildLevelCaseSQL(ranges, 'text_level');
    const [textLevelStats] = await pool.query<LevelDistributionRow[]>(
      `SELECT
        ${textCaseSQL} as level_range,
        COUNT(*) as count
       FROM xp_users
       WHERE guild_id = ?
       GROUP BY level_range
       ORDER BY FIELD(level_range, ${fieldOrder})`,
      [guildId]
    );

    // 4. 음성 레벨 분포
    const voiceCaseSQL = buildLevelCaseSQL(ranges, 'voice_level');
    const [voiceLevelStats] = await pool.query<LevelDistributionRow[]>(
      `SELECT
        ${voiceCaseSQL} as level_range,
        COUNT(*) as count
       FROM xp_users
       WHERE guild_id = ?
       GROUP BY level_range
       ORDER BY FIELD(level_range, ${fieldOrder})`,
      [guildId]
    );

    // 텍스트 레벨 분포 맵
    const textMap = new Map(textLevelStats.map(r => [r.level_range, Number(r.count)]));
    const textDistribution = rangeLabels.map(range => ({
      range,
      count: textMap.get(range) ?? 0,
    }));

    // 음성 레벨 분포 맵
    const voiceMap = new Map(voiceLevelStats.map(r => [r.level_range, Number(r.count)]));
    const voiceDistribution = rangeLabels.map(range => ({
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
