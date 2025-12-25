import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  ShopRepositoryPort,
  ShopItem,
  ItemType,
  UserItem,
  PurchaseHistory,
  ColorOption,
  CreateColorOption,
  RepositoryError,
} from '@topia/core';
import { Result } from '@topia/core';

// ========== Row Interfaces ==========

interface ShopItemRow extends RowDataPacket {
  id: number;
  guild_id: string;
  name: string;
  description: string | null;
  price: string;
  currency_type: 'topy' | 'ruby';
  item_type: ItemType;
  duration_days: number | null;
  role_id: string | null;
  stock: number | null;
  max_per_user: number | null;
  enabled: number;
  created_at: Date;
}

interface UserItemRow extends RowDataPacket {
  id: number;
  guild_id: string;
  user_id: string;
  item_type: string;
  quantity: number;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface PurchaseHistoryRow extends RowDataPacket {
  id: number;
  guild_id: string;
  user_id: string;
  item_id: number;
  item_name: string;
  price: string;
  fee: string;
  currency_type: 'topy' | 'ruby';
  purchased_at: Date;
}

interface ColorOptionRow extends RowDataPacket {
  id: number;
  item_id: number;
  color: string;
  name: string;
  role_id: string;
  price: string;
  created_at: Date;
}

// ========== Mappers ==========

function toShopItem(row: ShopItemRow): ShopItem {
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    description: row.description,
    price: BigInt(row.price),
    currencyType: row.currency_type,
    itemType: row.item_type,
    durationDays: row.duration_days,
    roleId: row.role_id,
    stock: row.stock,
    maxPerUser: row.max_per_user,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

function toUserItem(row: UserItemRow): UserItem {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    itemType: row.item_type,
    quantity: row.quantity,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPurchaseHistory(row: PurchaseHistoryRow): PurchaseHistory {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    itemId: row.item_id,
    itemName: row.item_name,
    price: BigInt(row.price),
    fee: BigInt(row.fee),
    currencyType: row.currency_type,
    purchasedAt: row.purchased_at,
  };
}

function toColorOption(row: ColorOptionRow): ColorOption {
  return {
    id: row.id,
    itemId: row.item_id,
    color: row.color,
    name: row.name,
    roleId: row.role_id,
    price: BigInt(row.price),
    createdAt: row.created_at,
  };
}

// ========== Repository ==========

export class ShopRepository implements ShopRepositoryPort {
  constructor(private readonly pool: Pool) {}

  // ========== Shop Items ==========

  async findItems(
    guildId: string,
    options?: { enabledOnly?: boolean }
  ): Promise<Result<ShopItem[], RepositoryError>> {
    try {
      let query = 'SELECT * FROM shop_items WHERE guild_id = ?';
      const params: unknown[] = [guildId];

      if (options?.enabledOnly) {
        query += ' AND enabled = 1';
      }

      query += ' ORDER BY id ASC';

      const [rows] = await this.pool.execute<ShopItemRow[]>(query, params);
      return Result.ok(rows.map(toShopItem));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findItemById(itemId: number): Promise<Result<ShopItem | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ShopItemRow[]>(
        'SELECT * FROM shop_items WHERE id = ?',
        [itemId]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toShopItem(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async saveItem(
    item: Omit<ShopItem, 'id' | 'createdAt'>
  ): Promise<Result<ShopItem, RepositoryError>> {
    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `INSERT INTO shop_items
         (guild_id, name, description, price, currency_type, item_type,
          duration_days, role_id, stock, max_per_user, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.guildId,
          item.name,
          item.description,
          item.price.toString(),
          item.currencyType,
          item.itemType,
          item.durationDays,
          item.roleId,
          item.stock,
          item.maxPerUser,
          item.enabled ? 1 : 0,
        ]
      );

      const itemResult = await this.findItemById(result.insertId);
      if (!itemResult.success || !itemResult.data) {
        return Result.err({
          type: 'QUERY_ERROR',
          message: 'Failed to retrieve created item',
        });
      }

      return Result.ok(itemResult.data);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateItem(
    itemId: number,
    updates: Partial<Omit<ShopItem, 'id' | 'guildId' | 'createdAt'>>
  ): Promise<Result<void, RepositoryError>> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.price !== undefined) {
        fields.push('price = ?');
        values.push(updates.price.toString());
      }
      if (updates.currencyType !== undefined) {
        fields.push('currency_type = ?');
        values.push(updates.currencyType);
      }
      if (updates.itemType !== undefined) {
        fields.push('item_type = ?');
        values.push(updates.itemType);
      }
      if (updates.durationDays !== undefined) {
        fields.push('duration_days = ?');
        values.push(updates.durationDays);
      }
      if (updates.roleId !== undefined) {
        fields.push('role_id = ?');
        values.push(updates.roleId);
      }
      if (updates.stock !== undefined) {
        fields.push('stock = ?');
        values.push(updates.stock);
      }
      if (updates.maxPerUser !== undefined) {
        fields.push('max_per_user = ?');
        values.push(updates.maxPerUser);
      }
      if (updates.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(updates.enabled ? 1 : 0);
      }

      if (fields.length === 0) {
        return Result.ok(undefined);
      }

      values.push(itemId);
      await this.pool.execute(
        `UPDATE shop_items SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteItem(itemId: number): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute('DELETE FROM shop_items WHERE id = ?', [itemId]);
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async decreaseStock(itemId: number): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        'UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND stock > 0',
        [itemId]
      );
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ========== User Items ==========

  async findUserItems(
    guildId: string,
    userId: string
  ): Promise<Result<UserItem[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<UserItemRow[]>(
        'SELECT * FROM user_items WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );
      return Result.ok(rows.map(toUserItem));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findUserItem(
    guildId: string,
    userId: string,
    itemType: string
  ): Promise<Result<UserItem | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<UserItemRow[]>(
        'SELECT * FROM user_items WHERE guild_id = ? AND user_id = ? AND item_type = ?',
        [guildId, userId, itemType]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toUserItem(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async upsertUserItem(
    guildId: string,
    userId: string,
    itemType: string,
    quantity: number,
    expiresAt: Date | null
  ): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO user_items (guild_id, user_id, item_type, quantity, expires_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         quantity = VALUES(quantity),
         expires_at = VALUES(expires_at),
         updated_at = NOW()`,
        [guildId, userId, itemType, quantity, expiresAt]
      );
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async increaseUserItemQuantity(
    guildId: string,
    userId: string,
    itemType: string,
    amount: number,
    expiresAt: Date | null
  ): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO user_items (guild_id, user_id, item_type, quantity, expires_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         quantity = quantity + VALUES(quantity),
         expires_at = COALESCE(VALUES(expires_at), expires_at),
         updated_at = NOW()`,
        [guildId, userId, itemType, amount, expiresAt]
      );
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async decreaseUserItemQuantity(
    guildId: string,
    userId: string,
    itemType: string,
    amount: number
  ): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `UPDATE user_items
         SET quantity = GREATEST(quantity - ?, 0), updated_at = NOW()
         WHERE guild_id = ? AND user_id = ? AND item_type = ?`,
        [amount, guildId, userId, itemType]
      );
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ========== Purchase History ==========

  async savePurchaseHistory(
    history: Omit<PurchaseHistory, 'id'>
  ): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO purchase_history
         (guild_id, user_id, item_id, item_name, price, fee, currency_type, purchased_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          history.guildId,
          history.userId,
          history.itemId,
          history.itemName,
          history.price.toString(),
          history.fee.toString(),
          history.currencyType,
          history.purchasedAt,
        ]
      );
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findPurchaseHistory(
    guildId: string,
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<PurchaseHistory[], RepositoryError>> {
    try {
      const limit = options?.limit ?? 20;
      const offset = options?.offset ?? 0;

      const [rows] = await this.pool.execute<PurchaseHistoryRow[]>(
        `SELECT * FROM purchase_history
         WHERE guild_id = ? AND user_id = ?
         ORDER BY purchased_at DESC
         LIMIT ? OFFSET ?`,
        [guildId, userId, limit, offset]
      );

      return Result.ok(rows.map(toPurchaseHistory));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getUserPurchaseCount(
    guildId: string,
    userId: string,
    itemId: number
  ): Promise<Result<number, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<(RowDataPacket & { count: number })[]>(
        `SELECT COUNT(*) as count FROM purchase_history
         WHERE guild_id = ? AND user_id = ? AND item_id = ?`,
        [guildId, userId, itemId]
      );

      const count = rows[0]?.count ?? 0;
      return Result.ok(count);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ========== Color Options ==========

  async findColorOptions(itemId: number): Promise<Result<ColorOption[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ColorOptionRow[]>(
        'SELECT * FROM shop_color_options WHERE item_id = ? ORDER BY id ASC',
        [itemId]
      );
      return Result.ok(rows.map(toColorOption));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findColorOptionById(optionId: number): Promise<Result<ColorOption | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ColorOptionRow[]>(
        'SELECT * FROM shop_color_options WHERE id = ?',
        [optionId]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toColorOption(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async saveColorOption(option: CreateColorOption): Promise<Result<ColorOption, RepositoryError>> {
    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `INSERT INTO shop_color_options (item_id, color, name, role_id, price)
         VALUES (?, ?, ?, ?, ?)`,
        [option.itemId, option.color, option.name, option.roleId, option.price.toString()]
      );

      const optionResult = await this.findColorOptionById(result.insertId);
      if (!optionResult.success || !optionResult.data) {
        return Result.err({
          type: 'QUERY_ERROR',
          message: 'Failed to retrieve created color option',
        });
      }

      return Result.ok(optionResult.data);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteColorOption(optionId: number): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute('DELETE FROM shop_color_options WHERE id = ?', [optionId]);
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteColorOptionsByItemId(itemId: number): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute('DELETE FROM shop_color_options WHERE item_id = ?', [itemId]);
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findAllColorOptionsByGuild(guildId: string): Promise<Result<ColorOption[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ColorOptionRow[]>(
        `SELECT sco.* FROM shop_color_options sco
         JOIN shop_items si ON sco.item_id = si.id
         WHERE si.guild_id = ?
         ORDER BY sco.id ASC`,
        [guildId]
      );
      return Result.ok(rows.map(toColorOption));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findColorOptionByColor(
    guildId: string,
    color: string
  ): Promise<Result<ColorOption | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ColorOptionRow[]>(
        `SELECT sco.* FROM shop_color_options sco
         JOIN shop_items si ON sco.item_id = si.id
         WHERE si.guild_id = ? AND sco.color = ?
         LIMIT 1`,
        [guildId, color.toUpperCase()]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toColorOption(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
