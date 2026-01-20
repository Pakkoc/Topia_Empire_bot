import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface TreasuryRow extends RowDataPacket {
  guild_id: string;
  topy_balance: bigint;
  ruby_balance: bigint;
  total_topy_collected: bigint;
  total_ruby_collected: bigint;
  total_topy_distributed: bigint;
  total_ruby_distributed: bigint;
  created_at: Date;
  updated_at: Date;
}

interface MonthlyCollectedRow extends RowDataPacket {
  topy_sum: bigint | null;
  ruby_sum: bigint | null;
}

interface TotalSupplyRow extends RowDataPacket {
  total_topy: bigint | null;
  total_ruby: bigint | null;
}

function rowToTreasury(row: TreasuryRow) {
  return {
    guildId: row.guild_id,
    topyBalance: row.topy_balance.toString(),
    rubyBalance: row.ruby_balance.toString(),
    totalTopyCollected: row.total_topy_collected.toString(),
    totalRubyCollected: row.total_ruby_collected.toString(),
    totalTopyDistributed: row.total_topy_distributed.toString(),
    totalRubyDistributed: row.total_ruby_distributed.toString(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

    // 국고 조회 (없으면 기본값 반환)
    const [treasuryRows] = await pool.query<TreasuryRow[]>(
      `SELECT * FROM guild_treasury WHERE guild_id = ?`,
      [guildId]
    );

    let treasury;
    if (treasuryRows.length === 0) {
      treasury = {
        guildId,
        topyBalance: "0",
        rubyBalance: "0",
        totalTopyCollected: "0",
        totalRubyCollected: "0",
        totalTopyDistributed: "0",
        totalRubyDistributed: "0",
        createdAt: null,
        updatedAt: null,
      };
    } else {
      treasury = rowToTreasury(treasuryRows[0]!);
    }

    // 이번 달 수집량 조회
    const [monthlyRows] = await pool.query<MonthlyCollectedRow[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN currency_type = 'topy' THEN amount ELSE 0 END), 0) as topy_sum,
         COALESCE(SUM(CASE WHEN currency_type = 'ruby' THEN amount ELSE 0 END), 0) as ruby_sum
       FROM treasury_transactions
       WHERE guild_id = ?
         AND transaction_type IN ('transfer_fee', 'shop_fee', 'tax')
         AND YEAR(created_at) = YEAR(NOW())
         AND MONTH(created_at) = MONTH(NOW())`,
      [guildId]
    );

    const monthlyCollected = {
      topy: (monthlyRows[0]?.topy_sum ?? BigInt(0)).toString(),
      ruby: (monthlyRows[0]?.ruby_sum ?? BigInt(0)).toString(),
    };

    // 총 발행량 조회 (모든 유저 지갑 잔액 합계)
    const [topySupplyRows] = await pool.query<TotalSupplyRow[]>(
      `SELECT COALESCE(SUM(balance), 0) as total_topy, NULL as total_ruby FROM topy_wallets WHERE guild_id = ?`,
      [guildId]
    );
    const [rubySupplyRows] = await pool.query<TotalSupplyRow[]>(
      `SELECT NULL as total_topy, COALESCE(SUM(balance), 0) as total_ruby FROM ruby_wallets WHERE guild_id = ?`,
      [guildId]
    );

    const totalSupply = {
      topy: (topySupplyRows[0]?.total_topy ?? BigInt(0)).toString(),
      ruby: (rubySupplyRows[0]?.total_ruby ?? BigInt(0)).toString(),
    };

    return NextResponse.json({
      treasury,
      monthlyCollected,
      totalSupply,
    });
  } catch (error) {
    console.error("Error fetching treasury:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
