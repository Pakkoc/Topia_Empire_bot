import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { TopyWalletRepositoryPort, TopyWallet, RepositoryError } from '@topia/core';
import { Result } from '@topia/core';

interface TopyWalletRow extends RowDataPacket {
  guild_id: string;
  user_id: string;
  balance: string; // BIGINT은 string으로 반환
  total_earned: string;
  daily_earned: number;
  daily_reset_at: Date;
  last_text_earn_at: Date | null;
  text_count_in_cooldown: number;
  last_voice_earn_at: Date | null;
  voice_count_in_cooldown: number;
  created_at: Date;
  updated_at: Date;
}

function toTopyWallet(row: TopyWalletRow): TopyWallet {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    balance: BigInt(row.balance),
    totalEarned: BigInt(row.total_earned),
    dailyEarned: row.daily_earned,
    dailyResetAt: row.daily_reset_at,
    lastTextEarnAt: row.last_text_earn_at,
    textCountInCooldown: row.text_count_in_cooldown,
    lastVoiceEarnAt: row.last_voice_earn_at,
    voiceCountInCooldown: row.voice_count_in_cooldown,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TopyWalletRepository implements TopyWalletRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findByUser(guildId: string, userId: string): Promise<Result<TopyWallet | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<TopyWalletRow[]>(
        'SELECT * FROM topy_wallets WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toTopyWallet(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async save(wallet: TopyWallet): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO topy_wallets
         (guild_id, user_id, balance, total_earned, daily_earned, daily_reset_at,
          last_text_earn_at, text_count_in_cooldown, last_voice_earn_at, voice_count_in_cooldown,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         balance = VALUES(balance),
         total_earned = VALUES(total_earned),
         daily_earned = VALUES(daily_earned),
         daily_reset_at = VALUES(daily_reset_at),
         last_text_earn_at = VALUES(last_text_earn_at),
         text_count_in_cooldown = VALUES(text_count_in_cooldown),
         last_voice_earn_at = VALUES(last_voice_earn_at),
         voice_count_in_cooldown = VALUES(voice_count_in_cooldown),
         updated_at = VALUES(updated_at)`,
        [
          wallet.guildId,
          wallet.userId,
          wallet.balance.toString(),
          wallet.totalEarned.toString(),
          wallet.dailyEarned,
          wallet.dailyResetAt,
          wallet.lastTextEarnAt,
          wallet.textCountInCooldown,
          wallet.lastVoiceEarnAt,
          wallet.voiceCountInCooldown,
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

  async getLeaderboard(guildId: string, limit: number, offset: number = 0): Promise<Result<TopyWallet[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<TopyWalletRow[]>(
        'SELECT * FROM topy_wallets WHERE guild_id = ? ORDER BY balance DESC LIMIT ? OFFSET ?',
        [guildId, limit, offset]
      );

      return Result.ok(rows.map(toTopyWallet));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAllByGuild(guildId: string): Promise<Result<TopyWallet[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<TopyWalletRow[]>(
        'SELECT * FROM topy_wallets WHERE guild_id = ?',
        [guildId]
      );

      return Result.ok(rows.map(toTopyWallet));
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
  ): Promise<Result<TopyWallet, RepositoryError>> {
    try {
      const operator = operation === 'add' ? '+' : '-';
      await this.pool.execute(
        `UPDATE topy_wallets
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
