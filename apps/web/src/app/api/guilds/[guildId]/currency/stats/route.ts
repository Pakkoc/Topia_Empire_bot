import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface TransactionStatsRow extends RowDataPacket {
  transaction_type: string;
  count: number;
  total_amount: string;
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  earn_text: '텍스트 보상',
  earn_voice: '음성 보상',
  earn_attendance: '출석 보상',
  transfer_in: '송금 수신',
  transfer_out: '송금 발신',
  shop_purchase: '상점 구매',
  tax: '세금',
  fee: '수수료',
  admin_add: '관리자 지급',
  admin_remove: '관리자 차감',
  game_entry: '내전 참가',
  game_reward: '내전 보상',
  game_refund: '게임 환불',
  vault_deposit: '금고 예금',
  vault_withdraw: '금고 출금',
  vault_interest: '금고 이자',
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

    // 거래 유형별 통계 (최근 30일)
    const [transactionStats] = await pool.query<TransactionStatsRow[]>(
      `SELECT
        transaction_type,
        COUNT(*) as count,
        COALESCE(SUM(ABS(amount)), 0) as total_amount
       FROM currency_transactions
       WHERE guild_id = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY transaction_type
       ORDER BY count DESC`,
      [guildId]
    );

    const distribution = transactionStats.map((row) => ({
      type: row.transaction_type,
      label: TRANSACTION_TYPE_LABELS[row.transaction_type] ?? row.transaction_type,
      count: Number(row.count),
      totalAmount: Number(row.total_amount),
    }));

    const totalTransactions = distribution.reduce((sum, d) => sum + d.count, 0);

    return NextResponse.json({
      distribution,
      totalTransactions,
      period: '30days',
    });
  } catch (error) {
    console.error("Error fetching currency stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
