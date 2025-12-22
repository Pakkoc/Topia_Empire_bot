import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { RubyWalletRepositoryPort, RubyWallet, RepositoryError } from '@topia/core';
import { Result } from '@topia/core';

interface RubyWalletRow extends RowDataPacket {
  guild_id: string;
  user_id: string;
  balance: string;
  total_earned: string;
  created_at: Date;
  updated_at: Date;
}

function toRubyWallet(row: RubyWalletRow): RubyWallet {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    balance: BigInt(row.balance),
    totalEarned: BigInt(row.total_earned),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RubyWalletRepository implements RubyWalletRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findByUser(guildId: string, userId: string): Promise<Result<RubyWallet | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<RubyWalletRow[]>(
        'SELECT * FROM ruby_wallets WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toRubyWallet(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async save(wallet: RubyWallet): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO ruby_wallets
         (guild_id, user_id, balance, total_earned, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         balance = VALUES(balance),
         total_earned = VALUES(total_earned),
         updated_at = VALUES(updated_at)`,
        [
          wallet.guildId,
          wallet.userId,
          wallet.balance.toString(),
          wallet.totalEarned.toString(),
          wallet.createdAt,
          wallet.updatedAt,
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

  async getLeaderboard(guildId: string, limit: number, offset: number = 0): Promise<Result<RubyWallet[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<RubyWalletRow[]>(
        'SELECT * FROM ruby_wallets WHERE guild_id = ? ORDER BY balance DESC LIMIT ? OFFSET ?',
        [guildId, limit, offset]
      );

      return Result.ok(rows.map(toRubyWallet));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateBalance(
    guildId: string,
    userId: string,
    amount: bigint,
    operation: 'add' | 'subtract'
  ): Promise<Result<RubyWallet, RepositoryError>> {
    try {
      const operator = operation === 'add' ? '+' : '-';
      await this.pool.execute(
        `UPDATE ruby_wallets
         SET balance = balance ${operator} ?,
             total_earned = total_earned + ?,
             updated_at = NOW()
         WHERE guild_id = ? AND user_id = ?`,
        [
          amount.toString(),
          operation === 'add' ? amount.toString() : '0',
          guildId,
          userId,
        ]
      );

      const result = await this.findByUser(guildId, userId);
      if (!result.success || !result.data) {
        return Result.err({ type: 'NOT_FOUND', message: 'Wallet not found after update' });
      }

      return Result.ok(result.data);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
