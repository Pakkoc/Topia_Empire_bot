import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { format, subDays } from "date-fns";

interface DailyActiveRow extends RowDataPacket {
  date: string;
  active_count: number;
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

    // 최근 7일간 일별 활동 유저 수 (텍스트 OR 음성 활동)
    // DISTINCT user_id로 중복 제거 (텍스트와 음성 둘 다 한 유저는 1명으로 카운트)
    const [dailyActive] = await pool.query<DailyActiveRow[]>(
      `SELECT
        date_range.date,
        COUNT(DISTINCT xu.user_id) as active_count
       FROM (
         SELECT DATE(DATE_SUB(NOW(), INTERVAL n DAY)) as date
         FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) days
       ) date_range
       LEFT JOIN xp_users xu ON xu.guild_id = ? AND (
         DATE(xu.last_text_xp_at) = date_range.date OR DATE(xu.last_voice_xp_at) = date_range.date
       )
       GROUP BY date_range.date
       ORDER BY date_range.date ASC`,
      [guildId]
    );

    // 최근 7일 날짜 배열 생성
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return format(date, 'yyyy-MM-dd');
    });

    // 데이터 맵 생성
    const dataMap = new Map(
      dailyActive.map(row => [format(new Date(row.date), 'yyyy-MM-dd'), Number(row.active_count)])
    );

    const dailyTrend = last7Days.map(date => ({
      date,
      label: format(new Date(date), 'M/d'),
      activeUsers: dataMap.get(date) ?? 0,
    }));

    // 총 활동 유저 수 (최근 7일)
    const totalActiveUsers = dailyTrend.reduce((sum, d) => sum + d.activeUsers, 0);

    // 평균 일일 활동 유저 수
    const avgDailyActive = Math.round(totalActiveUsers / 7);

    return NextResponse.json({
      dailyTrend,
      totalActiveUsers,
      avgDailyActive,
      period: '7days',
    });
  } catch (error) {
    console.error("Error fetching member activity trend:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
