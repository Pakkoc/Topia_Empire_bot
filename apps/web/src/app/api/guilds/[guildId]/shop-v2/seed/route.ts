import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_SHOP_ITEMS, isSystemItemType } from "@topia/core";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ExistingItemRow extends RowDataPacket {
  item_type: string;
}

export async function POST(
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

    // 기존에 등록된 시스템 아이템 타입 조회
    const [existingRows] = await pool.query<ExistingItemRow[]>(
      `SELECT item_type FROM shop_items_v2 WHERE guild_id = ? AND item_type IS NOT NULL AND item_type != 'custom'`,
      [guildId]
    );

    const existingTypes = new Set(existingRows.map((r) => r.item_type));

    // 등록할 디폴트 아이템 필터링
    const itemsToSeed = DEFAULT_SHOP_ITEMS.filter(
      (item) => !existingTypes.has(item.itemType)
    );

    if (itemsToSeed.length === 0) {
      return NextResponse.json({
        success: true,
        message: "모든 기본 아이템이 이미 등록되어 있습니다.",
        seeded: 0,
      });
    }

    // 아이템 등록 (가격 0원, 비활성화)
    const insertedItems: string[] = [];

    for (const item of itemsToSeed) {
      await pool.execute<ResultSetHeader>(
        `INSERT INTO shop_items_v2
         (guild_id, name, description, item_type, topy_price, ruby_price, currency_type, duration_days, stock, max_per_user, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          guildId,
          item.name,
          item.description,
          item.itemType,
          0, // topy_price = 0
          null, // ruby_price = null
          item.currencyType,
          item.durationDays,
          null, // stock = null (무제한)
          null, // max_per_user = null (무제한)
          0, // enabled = false (비활성화)
        ]
      );

      insertedItems.push(item.name);
    }

    return NextResponse.json({
      success: true,
      message: `${insertedItems.length}개의 기본 아이템이 등록되었습니다.`,
      seeded: insertedItems.length,
      items: insertedItems,
    });
  } catch (error) {
    console.error("Error seeding default shop items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
