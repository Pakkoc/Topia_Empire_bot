import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateShopItemV2Schema } from "@/types/shop-v2";
import { refreshBankPanel } from "@/lib/bot-notify";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface ShopItemV2Row extends RowDataPacket {
  id: number;
  guild_id: string;
  name: string;
  description: string | null;
  item_type: string | null;
  effect_percent: number | null;
  effect_config: string | object | null;
  topy_price: string | null;
  ruby_price: string | null;
  currency_type: "topy" | "ruby" | "both";
  duration_days: number;
  stock: number | null;
  max_per_user: number | null;
  enabled: number;
  created_at: Date;
}

function rowToShopItemV2(row: ShopItemV2Row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    description: row.description,
    itemType: row.item_type ?? "custom",
    effectPercent: row.effect_percent,
    effectConfig: row.effect_config
      ? (typeof row.effect_config === 'string' ? JSON.parse(row.effect_config) : row.effect_config)
      : null,
    topyPrice: row.topy_price ? Number(row.topy_price) : null,
    rubyPrice: row.ruby_price ? Number(row.ruby_price) : null,
    currencyType: row.currency_type,
    durationDays: row.duration_days,
    stock: row.stock,
    maxPerUser: row.max_per_user,
    enabled: row.enabled === 1,
    createdAt: row.created_at.toISOString(),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const itemId = parseInt(id, 10);

  try {
    const pool = db();
    const [rows] = await pool.query<ShopItemV2Row[]>(
      "SELECT * FROM shop_items_v2 WHERE id = ? AND guild_id = ?",
      [itemId, guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(rowToShopItemV2(rows[0]!));
  } catch (error) {
    console.error("Error fetching shop item v2:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guildId, id } = await params;
  const itemId = parseInt(id, 10);

  try {
    const body = await request.json();
    const validatedData = updateShopItemV2Schema.parse(body);

    const pool = db();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Check if item exists
      const [existingRows] = await connection.query<ShopItemV2Row[]>(
        "SELECT * FROM shop_items_v2 WHERE id = ? AND guild_id = ?",
        [itemId, guildId]
      );

      if (existingRows.length === 0) {
        await connection.rollback();
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: unknown[] = [];

      if (validatedData.name !== undefined) {
        updates.push("name = ?");
        values.push(validatedData.name);
      }
      if (validatedData.description !== undefined) {
        updates.push("description = ?");
        values.push(validatedData.description);
      }
      if (validatedData.topyPrice !== undefined) {
        updates.push("topy_price = ?");
        values.push(validatedData.topyPrice);
      }
      if (validatedData.rubyPrice !== undefined) {
        updates.push("ruby_price = ?");
        values.push(validatedData.rubyPrice);
      }
      if (validatedData.currencyType !== undefined) {
        updates.push("currency_type = ?");
        values.push(validatedData.currencyType);
      }
      if (validatedData.durationDays !== undefined) {
        updates.push("duration_days = ?");
        values.push(validatedData.durationDays);
      }
      if (validatedData.stock !== undefined) {
        updates.push("stock = ?");
        values.push(validatedData.stock);
      }
      if (validatedData.maxPerUser !== undefined) {
        updates.push("max_per_user = ?");
        values.push(validatedData.maxPerUser);
      }
      if (validatedData.enabled !== undefined) {
        updates.push("enabled = ?");
        values.push(validatedData.enabled ? 1 : 0);
      }
      if (validatedData.itemType !== undefined) {
        updates.push("item_type = ?");
        values.push(validatedData.itemType);
      }
      if (validatedData.effectPercent !== undefined) {
        updates.push("effect_percent = ?");
        values.push(validatedData.effectPercent);
      }
      if (validatedData.effectConfig !== undefined) {
        updates.push("effect_config = ?");
        values.push(validatedData.effectConfig ? JSON.stringify(validatedData.effectConfig) : null);
      }

      // Update shop item if there are changes
      if (updates.length > 0) {
        values.push(itemId, guildId);
        await connection.execute(
          `UPDATE shop_items_v2 SET ${updates.join(", ")} WHERE id = ? AND guild_id = ?`,
          values
        );
      }

      // Handle role ticket update
      if (validatedData.roleTicket !== undefined) {
        // Check if role ticket exists
        const [existingTickets] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM role_tickets WHERE shop_item_id = ?",
          [itemId]
        );

        if (validatedData.roleTicket === null) {
          // Remove role ticket
          if (existingTickets.length > 0) {
            const ticketId = existingTickets[0]!["id"];
            await connection.execute(
              "DELETE FROM ticket_role_options WHERE ticket_id = ?",
              [ticketId]
            );
            await connection.execute(
              "DELETE FROM role_tickets WHERE id = ?",
              [ticketId]
            );
          }
        } else {
          // Get shop item name for role ticket
          const [itemRows] = await connection.query<ShopItemV2Row[]>(
            "SELECT name, description, enabled FROM shop_items_v2 WHERE id = ?",
            [itemId]
          );
          const shopItem = itemRows[0]!;

          const { consumeQuantity, removePreviousRole, fixedRoleId, effectDurationSeconds, roleOptions } = validatedData.roleTicket;

          if (existingTickets.length > 0) {
            // Update existing role ticket
            const ticketId = existingTickets[0]!["id"];
            await connection.execute(
              `UPDATE role_tickets
               SET name = ?, description = ?, consume_quantity = ?, remove_previous_role = ?, fixed_role_id = ?, effect_duration_seconds = ?, enabled = ?
               WHERE id = ?`,
              [
                shopItem.name,
                shopItem.description,
                consumeQuantity,
                removePreviousRole ? 1 : 0,
                fixedRoleId ?? null,
                effectDurationSeconds ?? null,
                shopItem.enabled,
                ticketId,
              ]
            );

            // Replace role options (delete all, then insert new)
            await connection.execute(
              "DELETE FROM ticket_role_options WHERE ticket_id = ?",
              [ticketId]
            );

            for (let i = 0; i < roleOptions.length; i++) {
              const option = roleOptions[i]!;
              await connection.execute(
                `INSERT INTO ticket_role_options
                 (ticket_id, role_id, name, description, display_order)
                 VALUES (?, ?, ?, ?, ?)`,
                [ticketId, option.roleId, option.name, option.description ?? null, i]
              );
            }
          } else {
            // Create new role ticket
            const [ticketResult] = await connection.execute<ResultSetHeader>(
              `INSERT INTO role_tickets
               (guild_id, name, description, shop_item_id, consume_quantity, remove_previous_role, fixed_role_id, effect_duration_seconds, enabled)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                guildId,
                shopItem.name,
                shopItem.description,
                itemId,
                consumeQuantity,
                removePreviousRole ? 1 : 0,
                fixedRoleId ?? null,
                effectDurationSeconds ?? null,
                shopItem.enabled,
              ]
            );

            const ticketId = ticketResult.insertId;

            for (let i = 0; i < roleOptions.length; i++) {
              const option = roleOptions[i]!;
              await connection.execute(
                `INSERT INTO ticket_role_options
                 (ticket_id, role_id, name, description, display_order)
                 VALUES (?, ?, ?, ?, ?)`,
                [ticketId, option.roleId, option.name, option.description ?? null, i]
              );
            }
          }
        }
      }

      await connection.commit();

      const [rows] = await pool.query<ShopItemV2Row[]>(
        "SELECT * FROM shop_items_v2 WHERE id = ?",
        [itemId]
      );

      if (rows.length === 0) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

      // vault_subscription 타입 상품 수정 시 디토뱅크 패널 새로고침
      // (기존이 vault_subscription이거나, 새로 vault_subscription으로 변경된 경우)
      const existingItem = existingRows[0]!;
      const wasVaultSubscription = existingItem.item_type === "vault_subscription";
      const isVaultSubscription = rows[0]!.item_type === "vault_subscription";
      if (wasVaultSubscription || isVaultSubscription) {
        refreshBankPanel(guildId).catch(() => {});
      }

      return NextResponse.json(rowToShopItemV2(rows[0]!));
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
    console.error("Error updating shop item v2:", error);
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
  const itemId = parseInt(id, 10);

  try {
    const pool = db();

    // Check if item exists
    const [rows] = await pool.query<ShopItemV2Row[]>(
      "SELECT * FROM shop_items_v2 WHERE id = ? AND guild_id = ?",
      [itemId, guildId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const deletedItem = rows[0]!;

    // Delete associated role tickets first
    await pool.execute(
      "DELETE FROM ticket_role_options WHERE ticket_id IN (SELECT id FROM role_tickets WHERE shop_item_id = ?)",
      [itemId]
    );
    await pool.execute("DELETE FROM role_tickets WHERE shop_item_id = ?", [itemId]);

    // Delete the item
    await pool.execute(
      "DELETE FROM shop_items_v2 WHERE id = ? AND guild_id = ?",
      [itemId, guildId]
    );

    // vault_subscription 타입 상품 삭제 시 디토뱅크 패널 새로고침
    if (deletedItem.item_type === "vault_subscription") {
      refreshBankPanel(guildId).catch(() => {});
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting shop item v2:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
