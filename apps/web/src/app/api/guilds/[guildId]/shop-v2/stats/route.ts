import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface PopularItemRow extends RowDataPacket {
  item_id: number;
  item_name: string;
  item_type: string;
  total_sold: number;
  price: string;
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

    // 인기 아이템 TOP 5 (user_items_v2 보유량 합계 기준)
    const [popularItems] = await pool.query<PopularItemRow[]>(
      `SELECT
        si.id as item_id,
        si.name as item_name,
        si.item_type as item_type,
        COALESCE(SUM(ui.quantity), 0) as total_sold,
        si.price
       FROM shop_items_v2 si
       LEFT JOIN user_items_v2 ui ON ui.shop_item_id = si.id AND ui.guild_id = si.guild_id
       WHERE si.guild_id = ? AND si.enabled = 1
       GROUP BY si.id, si.name, si.item_type, si.price
       HAVING total_sold > 0
       ORDER BY total_sold DESC
       LIMIT 5`,
      [guildId]
    );

    const items = popularItems.map((row, index) => ({
      rank: index + 1,
      id: row.item_id,
      name: row.item_name,
      type: row.item_type,
      purchaseCount: Number(row.total_sold),
      totalRevenue: Number(row.total_sold) * Number(row.price),
    }));

    return NextResponse.json({
      popularItems: items,
      period: 'all',
    });
  } catch (error) {
    console.error("Error fetching shop stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
