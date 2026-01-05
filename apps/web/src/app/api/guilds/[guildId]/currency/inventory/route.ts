import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { z } from "zod";

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
  guild_id: string;
  name: string;
  description: string | null;
  item_type: string | null;
  duration_days: number;
}

// 유저 인벤토리 조회
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
  const search = searchParams.get("search") || "";

  try {
    const pool = db();

    // 검색 조건
    let whereClause = "WHERE ui.guild_id = ? AND ui.quantity > 0";
    const queryParams: (string | number)[] = [guildId];

    if (search) {
      whereClause += " AND ui.user_id LIKE ?";
      queryParams.push(`%${search}%`);
    }

    // 총 개수 (유저별로 그룹화)
    const [countResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT ui.user_id) as total FROM user_items_v2 ui ${whereClause}`,
      queryParams
    );
    const total = (countResult[0] as { total: number }).total;

    // 유저별 인벤토리 조회
    const [userItemRows] = await pool.query<UserItemRow[]>(
      `SELECT ui.* FROM user_items_v2 ui
       ${whereClause}
       ORDER BY ui.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit * 10, offset * 10] // 아이템별로 여러개 있을 수 있으므로 더 많이 가져옴
    );

    // 상점 아이템 정보 조회
    const shopItemIds = [...new Set(userItemRows.map((row) => row.shop_item_id))];
    let shopItemMap = new Map<number, ShopItemRow>();

    if (shopItemIds.length > 0) {
      const [shopRows] = await pool.query<ShopItemRow[]>(
        `SELECT id, guild_id, name, description, item_type, duration_days
         FROM shop_items_v2 WHERE id IN (?)`,
        [shopItemIds]
      );
      shopItemMap = new Map(shopRows.map((row) => [row.id, row]));
    }

    // 유저별로 그룹화
    const userItemsMap = new Map<string, {
      userId: string;
      items: Array<{
        id: string;
        shopItemId: number;
        itemName: string;
        itemType: string | null;
        quantity: number;
        expiresAt: Date | null;
        durationDays: number;
      }>;
      totalItems: number;
    }>();

    for (const row of userItemRows) {
      const shopItem = shopItemMap.get(row.shop_item_id);
      if (!shopItem) continue;

      if (!userItemsMap.has(row.user_id)) {
        userItemsMap.set(row.user_id, {
          userId: row.user_id,
          items: [],
          totalItems: 0,
        });
      }

      const userEntry = userItemsMap.get(row.user_id)!;
      userEntry.items.push({
        id: row.id,
        shopItemId: row.shop_item_id,
        itemName: shopItem.name,
        itemType: shopItem.item_type,
        quantity: row.quantity,
        expiresAt: row.expires_at,
        durationDays: shopItem.duration_days,
      });
      userEntry.totalItems += row.quantity;
    }

    const inventories = Array.from(userItemsMap.values()).slice(0, limit);

    return NextResponse.json({
      inventories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 아이템 지급/회수
const actionSchema = z.object({
  userId: z.string().min(1),
  shopItemId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(999),
  action: z.enum(["give", "take"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;

  try {
    const body = await request.json();
    const validatedData = actionSchema.parse(body);
    const { userId, shopItemId, quantity, action } = validatedData;

    const pool = db();

    // 아이템 존재 확인
    const [itemRows] = await pool.query<ShopItemRow[]>(
      `SELECT * FROM shop_items_v2 WHERE id = ? AND guild_id = ?`,
      [shopItemId, guildId]
    );

    if (itemRows.length === 0) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    const item = itemRows[0]!;

    if (action === "give") {
      // 기간제 아이템: 만료일 계산
      let expiresAt: Date | null = null;
      if (item.duration_days > 0) {
        const [existingRows] = await pool.query<UserItemRow[]>(
          `SELECT * FROM user_items_v2 WHERE guild_id = ? AND user_id = ? AND shop_item_id = ?`,
          [guildId, userId, shopItemId]
        );

        const now = new Date();
        const existing = existingRows[0];
        const baseDate = existing?.expires_at && existing.expires_at > now
          ? existing.expires_at
          : now;

        const daysToAdd = item.duration_days * quantity;
        expiresAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      }

      // upsert
      await pool.query(
        `INSERT INTO user_items_v2 (guild_id, user_id, shop_item_id, quantity, expires_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         quantity = quantity + VALUES(quantity),
         expires_at = COALESCE(VALUES(expires_at), expires_at),
         updated_at = NOW()`,
        [guildId, userId, shopItemId, quantity, expiresAt]
      );

      // 결과 조회
      const [resultRows] = await pool.query<UserItemRow[]>(
        `SELECT * FROM user_items_v2 WHERE guild_id = ? AND user_id = ? AND shop_item_id = ?`,
        [guildId, userId, shopItemId]
      );

      return NextResponse.json({
        success: true,
        message: `${item.name} ${quantity}개를 지급했습니다.`,
        userItem: resultRows[0] ? {
          id: resultRows[0].id,
          quantity: resultRows[0].quantity,
          expiresAt: resultRows[0].expires_at,
        } : null,
      });
    } else {
      // take
      // 현재 보유 확인
      const [existingRows] = await pool.query<UserItemRow[]>(
        `SELECT * FROM user_items_v2 WHERE guild_id = ? AND user_id = ? AND shop_item_id = ?`,
        [guildId, userId, shopItemId]
      );

      if (existingRows.length === 0 || existingRows[0]!.quantity < 1) {
        return NextResponse.json(
          { error: "User does not own this item" },
          { status: 400 }
        );
      }

      const existing = existingRows[0]!;
      if (existing.quantity < quantity) {
        return NextResponse.json(
          { error: `Insufficient quantity. User has ${existing.quantity}, requested ${quantity}` },
          { status: 400 }
        );
      }

      // 차감
      await pool.query(
        `UPDATE user_items_v2
         SET quantity = GREATEST(quantity - ?, 0), updated_at = NOW()
         WHERE id = ?`,
        [quantity, existing.id]
      );

      return NextResponse.json({
        success: true,
        message: `${item.name} ${quantity}개를 회수했습니다.`,
        remainingQuantity: existing.quantity - quantity,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error processing inventory action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
