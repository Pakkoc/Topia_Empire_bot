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

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toUserXp(firstRow));
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
      // MySQL prepared statement에서 LIMIT/OFFSET 바인딩 문제 방지
      const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
      const safeOffset = Math.max(0, Number(offset) || 0);

      const [rows] = await this.pool.execute<UserXpRow[]>(
        `SELECT * FROM xp_users WHERE guild_id = ? ORDER BY xp DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        [guildId]
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

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(firstRow['rank'] as number);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAllByGuild(guildId: string): Promise<Result<UserXp[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<UserXpRow[]>(
        'SELECT * FROM xp_users WHERE guild_id = ?',
        [guildId]
      );

      return Result.ok(rows.map(toUserXp));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async saveBulk(users: UserXp[]): Promise<Result<void, RepositoryError>> {
    if (users.length === 0) {
      return Result.ok(undefined);
    }

    try {
      const values = users.map(u => [
        u.guildId,
        u.userId,
        u.xp,
        u.level,
        u.lastTextXpAt,
        u.textCountInCooldown,
        u.lastVoiceXpAt,
        u.voiceCountInCooldown,
        u.createdAt,
        u.updatedAt,
      ]);

      await this.pool.query(
        `INSERT INTO xp_users
         (guild_id, user_id, xp, level, last_text_xp_at, text_count_in_cooldown,
          last_voice_xp_at, voice_count_in_cooldown, created_at, updated_at)
         VALUES ?
         ON DUPLICATE KEY UPDATE
         xp = VALUES(xp),
         level = VALUES(level),
         updated_at = VALUES(updated_at)`,
        [values]
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
