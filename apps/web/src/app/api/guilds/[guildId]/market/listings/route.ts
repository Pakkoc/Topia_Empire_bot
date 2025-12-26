import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

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

interface CountRow extends RowDataPacket {
  count: number;
}

interface CurrencySettingsRow extends RowDataPacket {
  topy_name: string | null;
  ruby_name: string | null;
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

// ========== Schemas ==========

const createListingSchema = z.object({
  sellerId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(["design", "music", "video", "coding", "other"]),
  price: z.number().int().positive(),
  currencyType: z.enum(["topy", "ruby"]),
});

// ========== Handlers ==========

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId } = await params;
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const currencyType = searchParams.get("currencyType");
  const sellerId = searchParams.get("sellerId");
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  try {
    const pool = db();

    // Build query
    let query = `SELECT * FROM market_listings WHERE guild_id = ?`;
    const queryParams: (string | number)[] = [guildId];

    if (status) {
      query += " AND status = ?";
      queryParams.push(status);
    }

    if (category) {
      query += " AND category = ?";
      queryParams.push(category);
    }

    if (currencyType) {
      query += " AND currency_type = ?";
      queryParams.push(currencyType);
    }

    if (sellerId) {
      query += " AND seller_id = ?";
      queryParams.push(sellerId);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    queryParams.push(limit, offset);

    const [rows] = await pool.query<MarketListingRow[]>(query, queryParams);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM market_listings WHERE guild_id = ?`;
    const countParams: string[] = [guildId];

    if (status) {
      countQuery += " AND status = ?";
      countParams.push(status);
    }

    if (category) {
      countQuery += " AND category = ?";
      countParams.push(category);
    }

    if (currencyType) {
      countQuery += " AND currency_type = ?";
      countParams.push(currencyType);
    }

    if (sellerId) {
      countQuery += " AND seller_id = ?";
      countParams.push(sellerId);
    }

    const [countRows] = await pool.query<CountRow[]>(countQuery, countParams);
    const total = countRows[0]?.count ?? 0;

    return NextResponse.json({
      listings: rows.map(rowToMarketListing),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching market listings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const validatedData = createListingSchema.parse(body);

    const pool = db();

    // Get currency settings for dynamic names
    const [settingsRows] = await pool.query<CurrencySettingsRow[]>(
      "SELECT topy_name, ruby_name FROM currency_settings WHERE guild_id = ?",
      [guildId]
    );
    const topyName = settingsRows[0]?.topy_name ?? "토피";
    const rubyName = settingsRows[0]?.ruby_name ?? "루비";

    // Validate minimum price
    const minPrice = validatedData.currencyType === "ruby" ? 1 : 100;
    const currencyName = validatedData.currencyType === "ruby" ? rubyName : topyName;
    if (validatedData.price < minPrice) {
      return NextResponse.json(
        {
          error: `최소 가격은 ${minPrice}${currencyName}입니다.`,
        },
        { status: 400 }
      );
    }

    // Check active listings count (max 10)
    const [countRows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) as count FROM market_listings
       WHERE guild_id = ? AND seller_id = ? AND status = 'active'`,
      [guildId, validatedData.sellerId]
    );

    if ((countRows[0]?.count ?? 0) >= 10) {
      return NextResponse.json(
        { error: "최대 10개의 상품만 등록할 수 있습니다." },
        { status: 400 }
      );
    }

    // Calculate expiration date (30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO market_listings
       (guild_id, seller_id, title, description, category, price, currency_type, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        guildId,
        validatedData.sellerId,
        validatedData.title,
        validatedData.description ?? null,
        validatedData.category,
        validatedData.price,
        validatedData.currencyType,
        expiresAt,
      ]
    );

    const [rows] = await pool.query<MarketListingRow[]>(
      "SELECT * FROM market_listings WHERE id = ?",
      [result.insertId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Failed to create listing" },
        { status: 500 }
      );
    }

    return NextResponse.json(rowToMarketListing(rows[0]!), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating market listing:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
