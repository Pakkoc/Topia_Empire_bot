import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { XpRepositoryPort, UserXp, RepositoryError } from '@topia/core';
import { Result } from '@topia/core';

interface UserXpRow extends RowDataPacket {
  guild_id: string;
  user_id: string;
  xp: number;
  level: number;
  last_text_xp_at: Date | null;
  text_count_in_cooldown: number;
  last_voice_xp_at: Date | null;
  voice_count_in_cooldown: number;
  created_at: Date;
  updated_at: Date;
}

function toUserXp(row: UserXpRow): UserXp {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    xp: row.xp,
    level: row.level,
    lastTextXpAt: row.last_text_xp_at,
    textCountInCooldown: row.text_count_in_cooldown,
    lastVoiceXpAt: row.last_voice_xp_at,
    voiceCountInCooldown: row.voice_count_in_cooldown,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class XpRepository implements XpRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findByUser(guildId: string, userId: string): Promise<Result<UserXp | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<UserXpRow[]>(
        'SELECT * FROM xp_users WHERE guild_id = ? AND user_id = ?',
        [guildId, userId]
      );

      if (rows.length === 0) {
        return Result.ok(null);
      }

      return Result.ok(toUserXp(rows[0]));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async save(userXp: UserXp): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO xp_users
         (guild_id, user_id, xp, level, last_text_xp_at, text_count_in_cooldown,
          last_voice_xp_at, voice_count_in_cooldown, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         xp = VALUES(xp),
         level = VALUES(level),
         last_text_xp_at = VALUES(last_text_xp_at),
         text_count_in_cooldown = VALUES(text_count_in_cooldown),
         last_voice_xp_at = VALUES(last_voice_xp_at),
         voice_count_in_cooldown = VALUES(voice_count_in_cooldown),
         updated_at = VALUES(updated_at)`,
        [
          userXp.guildId,
          userXp.userId,
          userXp.xp,
          userXp.level,
          userXp.lastTextXpAt,
          userXp.textCountInCooldown,
          userXp.lastVoiceXpAt,
          userXp.voiceCountInCooldown,
          userXp.createdAt,
          userXp.updatedAt,
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

  async getLeaderboard(guildId: string, limit: number, offset: number = 0): Promise<Result<UserXp[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<UserXpRow[]>(
        'SELECT * FROM xp_users WHERE guild_id = ? ORDER BY xp DESC LIMIT ? OFFSET ?',
        [guildId, limit, offset]
      );

      return Result.ok(rows.map(toUserXp));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getUserRank(guildId: string, userId: string): Promise<Result<number | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) + 1 as rank FROM xp_users
         WHERE guild_id = ? AND xp > (SELECT COALESCE(xp, 0) FROM xp_users WHERE guild_id = ? AND user_id = ?)`,
        [guildId, guildId, userId]
      );

      if (rows.length === 0) {
        return Result.ok(null);
      }

      return Result.ok(rows[0].rank as number);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
