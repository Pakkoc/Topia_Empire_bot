import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

interface UserItemRow extends RowDataPacket {
  id: string;
  guild_id: string;
  user_id: string;
  shop_item_id: number;
  quantity: number;
  expires_at: Date | null;
  current_role_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ShopItemRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  item_type: string | null;
  duration_days: number;
  topy_price: string | null;
  ruby_price: string | null;
  currency_type: string;
}

// 특정 유저의 인벤토리 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, userId } = await params;

  try {
    const pool = db();

    // 유저 아이템 조회
    const [userItemRows] = await pool.query<UserItemRow[]>(
      `SELECT * FROM user_items_v2
       WHERE guild_id = ? AND user_id = ? AND quantity > 0
       ORDER BY updated_at DESC`,
      [guildId, userId]
    );

    // 상점 아이템 정보 조회
    const shopItemIds = userItemRows.map((row) => row.shop_item_id);
    let shopItemMap = new Map<number, ShopItemRow>();

    if (shopItemIds.length > 0) {
      const [shopRows] = await pool.query<ShopItemRow[]>(
        `SELECT id, name, description, item_type, duration_days, topy_price, ruby_price, currency_type
         FROM shop_items_v2 WHERE id IN (?)`,
        [shopItemIds]
      );
      shopItemMap = new Map(shopRows.map((row) => [row.id, row]));
    }

    const items = userItemRows.map((row) => {
      const shopItem = shopItemMap.get(row.shop_item_id);
      return {
        id: row.id,
        shopItemId: row.shop_item_id,
        itemName: shopItem?.name ?? "알 수 없는 아이템",
        itemType: shopItem?.item_type ?? null,
        description: shopItem?.description ?? null,
        quantity: row.quantity,
        expiresAt: row.expires_at,
        durationDays: shopItem?.duration_days ?? 0,
        topyPrice: shopItem?.topy_price ?? null,
        rubyPrice: shopItem?.ruby_price ?? null,
        currencyType: shopItem?.currency_type ?? "topy",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json({
      userId,
      items,
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    });
  } catch (error) {
    console.error("Error fetching user inventory:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
