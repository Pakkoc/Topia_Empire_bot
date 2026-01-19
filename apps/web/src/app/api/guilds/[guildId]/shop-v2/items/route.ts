import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createShopItemV2Schema } from "@/types/shop-v2";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ShopItemV2Row extends RowDataPacket {
  id: number;
  guild_id: string;
  name: string;
  description: string | null;
  item_type: string | null;
  effect_percent: number | null;
  effect_config: string | null;
  topy_price: string | null;
  ruby_price: string | null;
  currency_type: "topy" | "ruby" | "both";
  duration_days: number;
  stock: number | null;
  max_per_user: number | null;
  enabled: number;
  created_at: Date;
  // Joined role ticket fields
  ticket_id?: number | null;
  ticket_consume_quantity?: number | null;
  ticket_remove_previous_role?: number | null;
  ticket_fixed_role_id?: string | null;
  ticket_effect_duration_seconds?: string | null;
}

interface RoleOptionRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  role_id: string;
  name: string;
  description: string | null;
  display_order: number;
}

function rowToShopItemV2(row: ShopItemV2Row, roleOptions?: RoleOptionRow[]) {
  const item: Record<string, unknown> = {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    description: row.description,
    itemType: row.item_type ?? "custom",
    effectPercent: row.effect_percent,
    effectConfig: row.effect_config ? JSON.parse(row.effect_config) : null,
    topyPrice: row.topy_price ? Number(row.topy_price) : null,
    rubyPrice: row.ruby_price ? Number(row.ruby_price) : null,
    currencyType: row.currency_type,
    durationDays: row.duration_days,
    stock: row.stock,
    maxPerUser: row.max_per_user,
    enabled: row.enabled === 1,
    createdAt: row.created_at.toISOString(),
  };

  // Include role ticket info if exists
  if (row.ticket_id) {
    item["roleTicket"] = {
      id: row.ticket_id,
      consumeQuantity: row.ticket_consume_quantity ?? 1,
      removePreviousRole: row.ticket_remove_previous_role === 1,
      fixedRoleId: row.ticket_fixed_role_id ?? null,
      effectDurationSeconds: row.ticket_effect_duration_seconds
        ? Number(row.ticket_effect_duration_seconds)
        : null,
      roleOptions: (roleOptions ?? []).map((opt) => ({
        id: opt.id,
        roleId: opt.role_id,
        name: opt.name,
        description: opt.description,
        displayOrder: opt.display_order,
      })),
    };
  }

  return item;
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

    // Fetch shop items with role ticket info
    const [rows] = await pool.query<ShopItemV2Row[]>(
      `SELECT si.*,
              rt.id as ticket_id,
              rt.consume_quantity as ticket_consume_quantity,
              rt.remove_previous_role as ticket_remove_previous_role,
              rt.fixed_role_id as ticket_fixed_role_id,
              rt.effect_duration_seconds as ticket_effect_duration_seconds
       FROM shop_items_v2 si
       LEFT JOIN role_tickets rt ON si.id = rt.shop_item_id
       WHERE si.guild_id = ?
       ORDER BY si.id ASC`,
      [guildId]
    );

    // Get all ticket IDs that have role tickets
    const ticketIds = rows
      .filter((r) => r.ticket_id)
      .map((r) => r.ticket_id as number);

    // Fetch role options for all tickets at once
    let roleOptionsMap: Map<number, RoleOptionRow[]> = new Map();
    if (ticketIds.length > 0) {
      const [roleOptions] = await pool.query<RoleOptionRow[]>(
        `SELECT * FROM ticket_role_options
         WHERE ticket_id IN (${ticketIds.map(() => "?").join(",")})
         ORDER BY display_order ASC`,
        ticketIds
      );

      // Group by ticket_id
      for (const opt of roleOptions) {
        const existing = roleOptionsMap.get(opt.ticket_id) || [];
        existing.push(opt);
        roleOptionsMap.set(opt.ticket_id, existing);
      }
    }

    return NextResponse.json(
      rows.map((row) =>
        rowToShopItemV2(
          row,
          row.ticket_id ? roleOptionsMap.get(row.ticket_id) : undefined
        )
      )
    );
  } catch (error) {
    console.error("Error fetching shop items v2:", error);
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
    const validatedData = createShopItemV2Schema.parse(body);

    const pool = db();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Create shop item
      const [shopItemResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO shop_items_v2
         (guild_id, name, description, item_type, effect_percent, effect_config, topy_price, ruby_price, currency_type, duration_days, stock, max_per_user, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          guildId,
          validatedData.name,
          validatedData.description ?? null,
          validatedData.itemType ?? "custom",
          validatedData.effectPercent ?? null,
          validatedData.effectConfig ? JSON.stringify(validatedData.effectConfig) : null,
          validatedData.topyPrice ?? null,
          validatedData.rubyPrice ?? null,
          validatedData.currencyType,
          validatedData.durationDays ?? 0,
          validatedData.stock ?? null,
          validatedData.maxPerUser ?? null,
          validatedData.enabled !== false ? 1 : 0,
        ]
      );

      const shopItemId = shopItemResult.insertId;

      // 2. If roleTicket is provided, create role_tickets and ticket_role_options
      if (validatedData.roleTicket) {
        const { consumeQuantity, removePreviousRole, fixedRoleId, effectDurationSeconds, roleOptions } = validatedData.roleTicket;

        // 디버그 로그
        console.log('[SHOP-V2 API] Creating role ticket with fixedRoleId:', fixedRoleId);

        // Create role ticket (name = shop item name)
        const [ticketResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO role_tickets
           (guild_id, name, description, shop_item_id, consume_quantity, remove_previous_role, fixed_role_id, effect_duration_seconds, enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            guildId,
            validatedData.name, // Use shop item name
            validatedData.description ?? null,
            shopItemId,
            consumeQuantity,
            removePreviousRole ? 1 : 0,
            fixedRoleId ?? null,
            effectDurationSeconds ?? null,
            validatedData.enabled !== false ? 1 : 0,
          ]
        );

        const ticketId = ticketResult.insertId;

        // Create role options
        for (let i = 0; i < roleOptions.length; i++) {
          const option = roleOptions[i]!;
          await connection.execute(
            `INSERT INTO ticket_role_options
             (ticket_id, role_id, name, description, display_order)
             VALUES (?, ?, ?, ?, ?)`,
            [
              ticketId,
              option.roleId,
              option.name,
              option.description ?? null,
              i,
            ]
          );
        }
      }

      await connection.commit();

      // Fetch the created item
      const [rows] = await pool.query<ShopItemV2Row[]>(
        "SELECT * FROM shop_items_v2 WHERE id = ?",
        [shopItemId]
      );

      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Failed to create item" },
          { status: 500 }
        );
      }

      return NextResponse.json(rowToShopItemV2(rows[0]!), { status: 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("Error creating shop item v2:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
