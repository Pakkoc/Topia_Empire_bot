import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { format, subDays } from "date-fns";

interface DailyStatsRow extends RowDataPacket {
  date: string;
  transaction_type: string;
  total_amount: string;
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  transfer_fee: '이체 수수료',
  shop_fee: '상점 수수료',
  tax: '세금',
  admin_distribute: '관리자 지급',
};

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

    // 최근 7일간 일별 국고 수입/지출 (topy 기준)
    const [dailyStats] = await pool.query<DailyStatsRow[]>(
      `SELECT
        DATE(created_at) as date,
        transaction_type,
        COALESCE(SUM(amount), 0) as total_amount
       FROM treasury_transactions
       WHERE guild_id = ?
         AND currency_type = 'topy'
         AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at), transaction_type
       ORDER BY date ASC`,
      [guildId]
    );

    // 최근 7일 날짜 배열 생성
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return format(date, 'yyyy-MM-dd');
    });

    // 수입 유형: transfer_fee, shop_fee, tax
    // 지출 유형: admin_distribute
    const incomeTypes = ['transfer_fee', 'shop_fee', 'tax'];
    const expenseTypes = ['admin_distribute'];

    // 일별 데이터 맵 생성
    const dailyMap = new Map<string, { income: number; expense: number }>();
    for (const date of last7Days) {
      dailyMap.set(date, { income: 0, expense: 0 });
    }

    for (const row of dailyStats) {
      const dateStr = format(new Date(row.date), 'yyyy-MM-dd');
      const amount = Number(row.total_amount);
      const data = dailyMap.get(dateStr);
      if (data) {
        if (incomeTypes.includes(row.transaction_type)) {
          data.income += amount;
        } else if (expenseTypes.includes(row.transaction_type)) {
          data.expense += amount;
        }
      }
    }

    const dailyTrend = last7Days.map(date => ({
      date,
      label: format(new Date(date), 'M/d'),
      income: dailyMap.get(date)?.income ?? 0,
      expense: dailyMap.get(date)?.expense ?? 0,
    }));

    // 유형별 합계
    const typeStats = new Map<string, number>();
    for (const row of dailyStats) {
      const current = typeStats.get(row.transaction_type) ?? 0;
      typeStats.set(row.transaction_type, current + Number(row.total_amount));
    }

    const byType = Array.from(typeStats.entries()).map(([type, amount]) => ({
      type,
      label: TRANSACTION_TYPE_LABELS[type] ?? type,
      amount,
    }));

    const totalIncome = dailyTrend.reduce((sum, d) => sum + d.income, 0);
    const totalExpense = dailyTrend.reduce((sum, d) => sum + d.expense, 0);

    // 복지 지수: 관리자 지급(admin_distribute)이 총 지출에서 차지하는 비율
    const adminDistributeTotal = typeStats.get('admin_distribute') ?? 0;
    const welfareIndex = totalExpense > 0
      ? Math.round((adminDistributeTotal / totalExpense) * 100)
      : 0;

    return NextResponse.json({
      dailyTrend,
      byType,
      totalIncome,
      totalExpense,
      welfareIndex,
      period: '7days',
    });
  } catch (error) {
    console.error("Error fetching treasury stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
