import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  ShopRepositoryPort,
  ShopItem,
  CreateShopItemInput,
  UpdateShopItemInput,
  UserItemV2,
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
  duration_days: number;
  stock: number | null;
  max_per_user: number | null;
  enabled: number;
  created_at: Date;
}

interface UserItemV2Row extends RowDataPacket {
  id: string; // BIGINT as string
  guild_id: string;
  user_id: string;
  shop_item_id: number;
  quantity: number;
  expires_at: Date | null;
  current_role_id: string | null;
  current_role_applied_at: Date | null;
  fixed_role_id: string | null;
  role_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
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
    durationDays: row.duration_days,
    stock: row.stock,
    maxPerUser: row.max_per_user,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

function toUserItemV2(row: UserItemV2Row): UserItemV2 {
  return {
    id: BigInt(row.id),
    guildId: row.guild_id,
    userId: row.user_id,
    shopItemId: row.shop_item_id,
    quantity: row.quantity,
    expiresAt: row.expires_at,
    currentRoleId: row.current_role_id,
    currentRoleAppliedAt: row.current_role_applied_at,
    fixedRoleId: row.fixed_role_id,
    roleExpiresAt: row.role_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ========== Repository ==========

export class ShopRepository implements ShopRepositoryPort {
  constructor(private readonly pool: Pool) {}

  // ========== Shop Items CRUD ==========

  async findAllByGuild(guildId: string): Promise<Result<ShopItem[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ShopItemRow[]>(
        'SELECT * FROM shop_items_v2 WHERE guild_id = ? ORDER BY id ASC',
        [guildId]
      );
      return Result.ok(rows.map(toShopItem));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findEnabledByGuild(guildId: string): Promise<Result<ShopItem[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ShopItemRow[]>(
        'SELECT * FROM shop_items_v2 WHERE guild_id = ? AND enabled = 1 ORDER BY id ASC',
        [guildId]
      );
      return Result.ok(rows.map(toShopItem));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findEnabledByGuildAndCurrency(
    guildId: string,
    currencyType: 'topy' | 'ruby'
  ): Promise<Result<ShopItem[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ShopItemRow[]>(
        'SELECT * FROM shop_items_v2 WHERE guild_id = ? AND enabled = 1 AND currency_type = ? ORDER BY id ASC',
        [guildId, currencyType]
      );
      return Result.ok(rows.map(toShopItem));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findById(id: number): Promise<Result<ShopItem | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ShopItemRow[]>(
        'SELECT * FROM shop_items_v2 WHERE id = ?',
        [id]
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

  async create(input: CreateShopItemInput): Promise<Result<ShopItem, RepositoryError>> {
    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `INSERT INTO shop_items_v2
         (guild_id, name, description, price, currency_type, duration_days, stock, max_per_user, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.guildId,
          input.name,
          input.description ?? null,
          input.price.toString(),
          input.currencyType,
          input.durationDays ?? 0,
          input.stock ?? null,
          input.maxPerUser ?? null,
          input.enabled !== false ? 1 : 0,
        ]
      );

      const itemResult = await this.findById(result.insertId);
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

  async update(id: number, input: UpdateShopItemInput): Promise<Result<void, RepositoryError>> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (input.name !== undefined) {
        fields.push('name = ?');
        values.push(input.name);
      }
      if (input.description !== undefined) {
        fields.push('description = ?');
        values.push(input.description);
      }
      if (input.price !== undefined) {
        fields.push('price = ?');
        values.push(input.price.toString());
      }
      if (input.currencyType !== undefined) {
        fields.push('currency_type = ?');
        values.push(input.currencyType);
      }
      if (input.durationDays !== undefined) {
        fields.push('duration_days = ?');
        values.push(input.durationDays);
      }
      if (input.stock !== undefined) {
        fields.push('stock = ?');
        values.push(input.stock);
      }
      if (input.maxPerUser !== undefined) {
        fields.push('max_per_user = ?');
        values.push(input.maxPerUser);
      }
      if (input.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(input.enabled ? 1 : 0);
      }

      if (fields.length === 0) {
        return Result.ok(undefined);
      }

      values.push(id);
      await this.pool.execute(
        `UPDATE shop_items_v2 SET ${fields.join(', ')} WHERE id = ?`,
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

  async delete(id: number): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute('DELETE FROM shop_items_v2 WHERE id = ?', [id]);
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async decreaseStock(id: number, quantity: number = 1): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        'UPDATE shop_items_v2 SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [quantity, id, quantity]
      );
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ========== User Items (Inventory) ==========

  async findUserItem(
    guildId: string,
    userId: string,
    shopItemId: number
  ): Promise<Result<UserItemV2 | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<UserItemV2Row[]>(
        'SELECT * FROM user_items_v2 WHERE guild_id = ? AND user_id = ? AND shop_item_id = ?',
        [guildId, userId, shopItemId]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toUserItemV2(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findUserItems(
    guildId: string,
    userId: string
  ): Promise<Result<UserItemV2[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<UserItemV2Row[]>(
        'SELECT * FROM user_items_v2 WHERE guild_id = ? AND user_id = ? ORDER BY id ASC',
        [guildId, userId]
      );
      return Result.ok(rows.map(toUserItemV2));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findExpiredItems(before: Date): Promise<Result<UserItemV2[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<UserItemV2Row[]>(
        `SELECT * FROM user_items_v2
         WHERE expires_at IS NOT NULL AND expires_at < ?
         ORDER BY expires_at ASC`,
        [before]
      );
      return Result.ok(rows.map(toUserItemV2));
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
    shopItemId: number,
    quantityDelta: number,
    expiresAt: Date | null
  ): Promise<Result<UserItemV2, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO user_items_v2 (guild_id, user_id, shop_item_id, quantity, expires_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         quantity = quantity + VALUES(quantity),
         expires_at = COALESCE(VALUES(expires_at), expires_at),
         updated_at = NOW()`,
        [guildId, userId, shopItemId, quantityDelta, expiresAt]
      );

      const result = await this.findUserItem(guildId, userId, shopItemId);
      if (!result.success || !result.data) {
        return Result.err({
          type: 'QUERY_ERROR',
          message: 'Failed to retrieve upserted user item',
        });
      }

      return Result.ok(result.data);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async decreaseUserItemQuantity(
    id: bigint,
    amount: number
  ): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `UPDATE user_items_v2
         SET quantity = GREATEST(quantity - ?, 0), updated_at = NOW()
         WHERE id = ?`,
        [amount, id.toString()]
      );
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateCurrentRole(
    id: bigint,
    roleId: string | null,
    appliedAt: Date | null,
    roleExpiresAt: Date | null,
    fixedRoleId?: string | null
  ): Promise<Result<void, RepositoryError>> {
    try {
      // fixedRoleId가 undefined가 아니면 업데이트에 포함
      if (fixedRoleId !== undefined) {
        await this.pool.execute(
          `UPDATE user_items_v2
           SET current_role_id = ?, current_role_applied_at = ?, fixed_role_id = ?, role_expires_at = ?, updated_at = NOW()
           WHERE id = ?`,
          [roleId, appliedAt, fixedRoleId, roleExpiresAt, id.toString()]
        );
      } else {
        await this.pool.execute(
          `UPDATE user_items_v2
           SET current_role_id = ?, current_role_applied_at = ?, role_expires_at = ?, updated_at = NOW()
           WHERE id = ?`,
          [roleId, appliedAt, roleExpiresAt, id.toString()]
        );
      }
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findRoleExpiredItems(before: Date): Promise<Result<UserItemV2[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<UserItemV2Row[]>(
        `SELECT * FROM user_items_v2
         WHERE role_expires_at IS NOT NULL
           AND role_expires_at < ?
           AND current_role_id IS NOT NULL
         ORDER BY role_expires_at ASC`,
        [before]
      );
      return Result.ok(rows.map(toUserItemV2));
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
    shopItemId: number
  ): Promise<Result<number, RepositoryError>> {
    try {
      // V2에서는 user_items_v2의 수량을 그대로 반환
      const [rows] = await this.pool.execute<(RowDataPacket & { quantity: number })[]>(
        `SELECT COALESCE(quantity, 0) as quantity FROM user_items_v2
         WHERE guild_id = ? AND user_id = ? AND shop_item_id = ?`,
        [guildId, userId, shopItemId]
      );

      const quantity = rows[0]?.quantity ?? 0;
      return Result.ok(quantity);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Backward compatibility alias
export const ShopV2Repository = ShopRepository;
