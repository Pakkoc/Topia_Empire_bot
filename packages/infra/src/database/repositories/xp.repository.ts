import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { XpRepositoryPort, UserXp, RepositoryError, XpType } from '@topia/core';
import { Result } from '@topia/core';

interface UserXpRow extends RowDataPacket {
  guild_id: string;
  user_id: string;
  text_xp: number;
  voice_xp: number;
  text_level: number;
  voice_level: number;
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
    textXp: row.text_xp ?? 0,
    voiceXp: row.voice_xp ?? 0,
    textLevel: row.text_level ?? 0,
    voiceLevel: row.voice_level ?? 0,
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
         (guild_id, user_id, text_xp, voice_xp, text_level, voice_level, last_text_xp_at, text_count_in_cooldown,
          last_voice_xp_at, voice_count_in_cooldown, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         text_xp = VALUES(text_xp),
         voice_xp = VALUES(voice_xp),
         text_level = VALUES(text_level),
         voice_level = VALUES(voice_level),
         last_text_xp_at = VALUES(last_text_xp_at),
         text_count_in_cooldown = VALUES(text_count_in_cooldown),
         last_voice_xp_at = VALUES(last_voice_xp_at),
         voice_count_in_cooldown = VALUES(voice_count_in_cooldown),
         updated_at = VALUES(updated_at)`,
        [
          userXp.guildId,
          userXp.userId,
          userXp.textXp,
          userXp.voiceXp,
          userXp.textLevel,
          userXp.voiceLevel,
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

  async getLeaderboard(guildId: string, limit: number, offset: number = 0, type?: XpType): Promise<Result<UserXp[], RepositoryError>> {
    try {
      // MySQL prepared statement에서 LIMIT/OFFSET 바인딩 문제 방지
      const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
      const safeOffset = Math.max(0, Number(offset) || 0);

      // 타입에 따라 정렬 기준 결정
      const orderColumn = type === 'voice' ? 'voice_xp' : 'text_xp';

      const [rows] = await this.pool.execute<UserXpRow[]>(
        `SELECT * FROM xp_users WHERE guild_id = ? ORDER BY ${orderColumn} DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
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

  async getUserRank(guildId: string, userId: string, type?: XpType): Promise<Result<number | null, RepositoryError>> {
    try {
      // 타입에 따라 XP 컬럼 결정
      const xpColumn = type === 'voice' ? 'voice_xp' : 'text_xp';

      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) + 1 as \`rank\` FROM xp_users
         WHERE guild_id = ? AND ${xpColumn} > (SELECT COALESCE(${xpColumn}, 0) FROM xp_users WHERE guild_id = ? AND user_id = ?)`,
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
        u.textXp,
        u.voiceXp,
        u.textLevel,
        u.voiceLevel,
        u.lastTextXpAt,
        u.textCountInCooldown,
        u.lastVoiceXpAt,
        u.voiceCountInCooldown,
        u.createdAt,
        u.updatedAt,
      ]);

      await this.pool.query(
        `INSERT INTO xp_users
         (guild_id, user_id, text_xp, voice_xp, text_level, voice_level, last_text_xp_at, text_count_in_cooldown,
          last_voice_xp_at, voice_count_in_cooldown, created_at, updated_at)
         VALUES ?
         ON DUPLICATE KEY UPDATE
         text_xp = VALUES(text_xp),
         voice_xp = VALUES(voice_xp),
         text_level = VALUES(text_level),
         voice_level = VALUES(voice_level),
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

  async upsert(userXp: UserXp): Promise<Result<UserXp, RepositoryError>> {
    try {
      // INSERT IGNORE: 이미 존재하면 무시
      await this.pool.execute(
        `INSERT IGNORE INTO xp_users
         (guild_id, user_id, text_xp, voice_xp, text_level, voice_level, last_text_xp_at, text_count_in_cooldown,
          last_voice_xp_at, voice_count_in_cooldown, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userXp.guildId,
          userXp.userId,
          userXp.textXp,
          userXp.voiceXp,
          userXp.textLevel,
          userXp.voiceLevel,
          userXp.lastTextXpAt,
          userXp.textCountInCooldown,
          userXp.lastVoiceXpAt,
          userXp.voiceCountInCooldown,
          userXp.createdAt,
          userXp.updatedAt,
        ]
      );

      // 생성되었든 이미 있었든 조회해서 반환
      const result = await this.findByUser(userXp.guildId, userXp.userId);
      if (!result.success || !result.data) {
        return Result.err({ type: 'NOT_FOUND', message: 'UserXp not found after upsert' });
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
