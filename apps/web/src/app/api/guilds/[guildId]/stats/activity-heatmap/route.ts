import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface ActivityCountRow extends RowDataPacket {
  day_of_week: number; // 0=일요일, 1=월요일, ..., 6=토요일
  hour_of_day: number; // 0-23
  activity_count: number;
}

export interface HeatmapCell {
  day: number; // 0-6 (일-토)
  hour: number; // 0-23
  count: number;
}

export interface ActivityHeatmapData {
  cells: HeatmapCell[];
  maxCount: number;
  totalActivities: number;
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

    // 최근 30일간 활동 데이터를 요일×시간으로 집계
    const [rows] = await pool.query<ActivityCountRow[]>(
      `SELECT
        DAYOFWEEK(activity_time) - 1 as day_of_week,
        HOUR(activity_time) as hour_of_day,
        COUNT(*) as activity_count
       FROM activity_logs
       WHERE guild_id = ?
         AND activity_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY day_of_week, hour_of_day
       ORDER BY day_of_week, hour_of_day`,
      [guildId]
    );

    // 7x24 히트맵 데이터 초기화
    const cells: HeatmapCell[] = [];
    const countMap = new Map<string, number>();

    // DB 결과를 맵으로 변환
    for (const row of rows) {
      const key = `${row.day_of_week}-${row.hour_of_day}`;
      countMap.set(key, Number(row.activity_count));
    }

    // 모든 요일×시간 조합 생성
    let maxCount = 0;
    let totalActivities = 0;
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        const count = countMap.get(key) || 0;
        cells.push({ day, hour, count });
        if (count > maxCount) maxCount = count;
        totalActivities += count;
      }
    }

    return NextResponse.json({
      cells,
      maxCount,
      totalActivities,
    } as ActivityHeatmapData);
  } catch (error) {
    console.error("Error fetching activity heatmap:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
