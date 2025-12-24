import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import type { CurrencyType, TransactionType } from "@topia/core";

interface TransactionRow extends RowDataPacket {
  id: string;
  guild_id: string;
  user_id: string;
  currency_type: CurrencyType;
  transaction_type: TransactionType;
  amount: string;
  balance_after: string;
  fee: string;
  related_user_id: string | null;
  description: string | null;
  created_at: Date;
}

interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

async function fetchUserInfo(userId: string, botToken: string): Promise<UserInfo> {
  try {
    const response = await fetch(
      `https://discord.com/api/v10/users/${userId}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    if (response.ok) {
      const userData = await response.json();
      return {
        id: userId,
        username: userData.username,
        displayName: userData.global_name || userData.username,
        avatar: userData.avatar
          ? `https://cdn.discordapp.com/avatars/${userId}/${userData.avatar}.png`
          : null,
      };
    }
  } catch {
    // Ignore errors
  }
  return {
    id: userId,
    username: `User ${userId.slice(-4)}`,
    displayName: `User ${userId.slice(-4)}`,
    avatar: null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const offset = (page - 1) * limit;
  const userId = searchParams.get("userId");
  const currencyType = searchParams.get("currencyType") as CurrencyType | null;
  const transactionType = searchParams.get("type") as TransactionType | null;

  try {
    const pool = db();

    // WHERE 조건 구성
    let whereClause = "WHERE guild_id = ?";
    const queryParams: (string | number)[] = [guildId];

    if (userId) {
      whereClause += " AND user_id = ?";
      queryParams.push(userId);
    }

    if (currencyType) {
      whereClause += " AND currency_type = ?";
      queryParams.push(currencyType);
    }

    if (transactionType) {
      whereClause += " AND transaction_type = ?";
      queryParams.push(transactionType);
    }

    // 총 개수
    const [countResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM currency_transactions ${whereClause}`,
      queryParams
    );
    const total = (countResult[0] as { total: number }).total;

    // 거래 내역 조회
    const [rows] = await pool.query<TransactionRow[]>(
      `SELECT * FROM currency_transactions ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    // 유저 정보 조회
    const botToken = process.env["DISCORD_TOKEN"];
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const userMap = new Map<string, UserInfo>();

    if (botToken && userIds.length > 0) {
      const userInfos = await Promise.all(
        userIds.map((id) => fetchUserInfo(id, botToken))
      );
      userInfos.forEach((info) => userMap.set(info.id, info));
    }

    const transactions = rows.map((row) => {
      const userInfo = userMap.get(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        username: userInfo?.username ?? `User ${row.user_id.slice(-4)}`,
        displayName: userInfo?.displayName ?? `User ${row.user_id.slice(-4)}`,
        avatar: userInfo?.avatar ?? null,
        currencyType: row.currency_type,
        transactionType: row.transaction_type,
        amount: row.amount,
        balanceAfter: row.balance_after,
        fee: row.fee,
        relatedUserId: row.related_user_id,
        description: row.description,
        createdAt: row.created_at,
      };
    });

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
