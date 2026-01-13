import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  BankSubscriptionRepositoryPort,
  BankSubscription,
  BankTier,
  RepositoryError,
} from '@topia/core';
import type { Result } from '@topia/core';

interface BankSubscriptionRow extends RowDataPacket {
  id: bigint;
  guild_id: string;
  user_id: string;
  tier: BankTier;
  vault_limit: bigint | null;
  interest_rate: string | null;  // DECIMAL은 문자열로 반환됨
  starts_at: Date;
  expires_at: Date;
  created_at: Date;
}

function rowToEntity(row: BankSubscriptionRow): BankSubscription {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    tier: row.tier,
    vaultLimit: row.vault_limit,
    interestRate: row.interest_rate ? parseFloat(row.interest_rate) : null,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export class BankSubscriptionRepository implements BankSubscriptionRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findActiveByUser(
    guildId: string,
    userId: string,
    now: Date
  ): Promise<Result<BankSubscription | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.query<BankSubscriptionRow[]>(
        `SELECT * FROM bank_subscriptions
         WHERE guild_id = ? AND user_id = ?
           AND starts_at <= ? AND expires_at > ?
         ORDER BY starts_at DESC
         LIMIT 1`,
        [guildId, userId, now, now]
      );

      if (rows.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: rowToEntity(rows[0]!) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: 'QUERY_ERROR', message } };
    }
  }

  async findByUserAndTier(
    guildId: string,
    userId: string,
    tier: BankTier
  ): Promise<Result<BankSubscription | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.query<BankSubscriptionRow[]>(
        `SELECT * FROM bank_subscriptions
         WHERE guild_id = ? AND user_id = ? AND tier = ? AND expires_at > NOW()
         ORDER BY starts_at ASC
         LIMIT 1`,
        [guildId, userId, tier]
      );

      if (rows.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: rowToEntity(rows[0]!) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: 'QUERY_ERROR', message } };
    }
  }

  async findAllByUser(
    guildId: string,
    userId: string
  ): Promise<Result<BankSubscription[], RepositoryError>> {
    try {
      const [rows] = await this.pool.query<BankSubscriptionRow[]>(
        `SELECT * FROM bank_subscriptions
         WHERE guild_id = ? AND user_id = ? AND expires_at > NOW()
         ORDER BY starts_at ASC`,
        [guildId, userId]
      );

      return { success: true, data: rows.map(rowToEntity) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: 'QUERY_ERROR', message } };
    }
  }

  async save(
    subscription: Omit<BankSubscription, 'id' | 'createdAt'>
  ): Promise<Result<BankSubscription, RepositoryError>> {
    try {
      const [result] = await this.pool.query<ResultSetHeader>(
        `INSERT INTO bank_subscriptions (guild_id, user_id, tier, vault_limit, interest_rate, starts_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          subscription.guildId,
          subscription.userId,
          subscription.tier,
          subscription.vaultLimit,
          subscription.interestRate,
          subscription.startsAt,
          subscription.expiresAt,
        ]
      );

      const [rows] = await this.pool.query<BankSubscriptionRow[]>(
        `SELECT * FROM bank_subscriptions WHERE id = ?`,
        [result.insertId]
      );

      return { success: true, data: rowToEntity(rows[0]!) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: 'QUERY_ERROR', message } };
    }
  }

  async extendExpiration(
    id: bigint,
    newExpiresAt: Date
  ): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.query<ResultSetHeader>(
        `UPDATE bank_subscriptions SET expires_at = ? WHERE id = ?`,
        [newExpiresAt, id]
      );

      return { success: true, data: undefined };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: 'QUERY_ERROR', message } };
    }
  }

  async deleteExpired(before: Date): Promise<Result<number, RepositoryError>> {
    try {
      const [result] = await this.pool.query<ResultSetHeader>(
        `DELETE FROM bank_subscriptions WHERE expires_at < ?`,
        [before]
      );

      return { success: true, data: result.affectedRows };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: { type: 'QUERY_ERROR', message } };
    }
  }
}
