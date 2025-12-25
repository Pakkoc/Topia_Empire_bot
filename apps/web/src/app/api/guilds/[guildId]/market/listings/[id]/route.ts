import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

// ========== Row Interface ==========

interface MarketListingRow extends RowDataPacket {
  id: string;
  guild_id: string;
  seller_id: string;
  title: string;
  description: string | null;
  category: "design" | "music" | "video" | "coding" | "other";
  price: string;
  currency_type: "topy" | "ruby";
  status: "active" | "sold" | "cancelled" | "expired";
  buyer_id: string | null;
  created_at: Date;
  expires_at: Date;
  sold_at: Date | null;
}

// ========== Mapper ==========

function rowToMarketListing(row: MarketListingRow) {
  return {
    id: row.id,
    guildId: row.guild_id,
    sellerId: row.seller_id,
    title: row.title,
    description: row.description,
    category: row.category,
    price: row.price,
    currencyType: row.currency_type,
    status: row.status,
    buyerId: row.buyer_id,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    soldAt: row.sold_at?.toISOString() ?? null,
  };
}

// ========== Handlers ==========

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const listingId = parseInt(id, 10);

  if (isNaN(listingId)) {
    return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
  }

  try {
    const pool = db();
    const [rows] = await pool.query<MarketListingRow[]>(
      "SELECT * FROM market_listings WHERE id = ? AND guild_id = ?",
      [listingId, guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(rowToMarketListing(rows[0]!));
  } catch (error) {
    console.error("Error fetching market listing:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const listingId = parseInt(id, 10);

  if (isNaN(listingId)) {
    return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
  }

  try {
    const pool = db();

    // Check if listing exists and is active
    const [existingRows] = await pool.query<MarketListingRow[]>(
      "SELECT * FROM market_listings WHERE id = ? AND guild_id = ?",
      [listingId, guildId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    const listing = existingRows[0]!;

    if (listing.status !== "active") {
      return NextResponse.json(
        { error: "이미 거래가 완료되었거나 취소된 상품입니다." },
        { status: 400 }
      );
    }

    // Cancel the listing (don't delete, just change status)
    await pool.execute(
      "UPDATE market_listings SET status = 'cancelled' WHERE id = ?",
      [listingId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling market listing:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
