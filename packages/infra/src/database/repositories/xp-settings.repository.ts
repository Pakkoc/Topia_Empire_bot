import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { XpSettingsRepositoryPort, XpSettings, RepositoryError, LevelReward, LevelChannel, HotTimeConfig, LevelRequirement, XpMultiplier, XpType } from '@topia/core';
import { Result } from '@topia/core';

interface XpSettingsRow extends RowDataPacket {
  guild_id: string;
  enabled: number;
  text_xp_enabled: number;
  text_xp_min: number;
  text_xp_max: number;
  text_cooldown_seconds: number;
  text_max_per_cooldown: number;
  voice_xp_enabled: number;
  voice_xp_min: number;
  voice_xp_max: number;
  voice_cooldown_seconds: number;
  voice_max_per_cooldown: number;
  level_up_notification_enabled: number;
  level_up_channel_id: string | null;
  level_up_message: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ExclusionRow extends RowDataPacket {
  target_id: string;
}

interface HotTimeRow extends RowDataPacket {
  id: number;
  start_time: string;
  end_time: string;
  multiplier: number;
  enabled: number;
}

interface HotTimeChannelRow extends RowDataPacket {
  id: number;
  hot_time_id: number;
  channel_id: string;
}

interface LevelRewardRow extends RowDataPacket {
  id: number;
  guild_id: string;
  type: 'text' | 'voice';
  level: number;
  role_id: string;
  remove_on_higher_level: number;
  created_at: Date;
}

interface LevelChannelRow extends RowDataPacket {
  id: number;
  guild_id: string;
  type: 'text' | 'voice';
  level: number;
  channel_id: string;
}

interface LevelRequirementRow extends RowDataPacket {
  guild_id: string;
  type: 'text' | 'voice';
  level: number;
  required_xp: number;
  created_at: Date;
  updated_at: Date;
}

interface MultiplierRow extends RowDataPacket {
  id: number;
  guild_id: string;
  target_type: 'channel' | 'role';
  target_id: string;
  multiplier: number;
}

function toXpSettings(row: XpSettingsRow): XpSettings {
  return {
    guildId: row.guild_id,
    enabled: Boolean(row.enabled),
    textXpEnabled: Boolean(row.text_xp_enabled),
    textXpMin: row.text_xp_min,
    textXpMax: row.text_xp_max,
    textCooldownSeconds: row.text_cooldown_seconds,
    textMaxPerCooldown: row.text_max_per_cooldown,
    voiceXpEnabled: Boolean(row.voice_xp_enabled),
    voiceXpMin: row.voice_xp_min,
    voiceXpMax: row.voice_xp_max,
    voiceCooldownSeconds: row.voice_cooldown_seconds,
    voiceMaxPerCooldown: row.voice_max_per_cooldown,
    levelUpNotificationEnabled: row.level_up_notification_enabled !== undefined ? Boolean(row.level_up_notification_enabled) : true,
    levelUpChannelId: row.level_up_channel_id,
    levelUpMessage: row.level_up_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class XpSettingsRepository implements XpSettingsRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findByGuild(guildId: string): Promise<Result<XpSettings | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<XpSettingsRow[]>(
        'SELECT * FROM xp_settings WHERE guild_id = ?',
        [guildId]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toXpSettings(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async save(settings: XpSettings): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO xp_settings
         (guild_id, enabled, text_xp_enabled, text_xp_min, text_xp_max,
          text_cooldown_seconds, text_max_per_cooldown,
          voice_xp_enabled, voice_xp_min, voice_xp_max,
          voice_cooldown_seconds, voice_max_per_cooldown,
          level_up_notification_enabled, level_up_channel_id, level_up_message, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         enabled = VALUES(enabled),
         text_xp_enabled = VALUES(text_xp_enabled),
         text_xp_min = VALUES(text_xp_min),
         text_xp_max = VALUES(text_xp_max),
         text_cooldown_seconds = VALUES(text_cooldown_seconds),
         text_max_per_cooldown = VALUES(text_max_per_cooldown),
         voice_xp_enabled = VALUES(voice_xp_enabled),
         voice_xp_min = VALUES(voice_xp_min),
         voice_xp_max = VALUES(voice_xp_max),
         voice_cooldown_seconds = VALUES(voice_cooldown_seconds),
         voice_max_per_cooldown = VALUES(voice_max_per_cooldown),
         level_up_notification_enabled = VALUES(level_up_notification_enabled),
         level_up_channel_id = VALUES(level_up_channel_id),
         level_up_message = VALUES(level_up_message),
         updated_at = VALUES(updated_at)`,
        [
          settings.guildId,
          settings.enabled,
          settings.textXpEnabled,
          settings.textXpMin,
          settings.textXpMax,
          settings.textCooldownSeconds,
          settings.textMaxPerCooldown,
          settings.voiceXpEnabled,
          settings.voiceXpMin,
          settings.voiceXpMax,
          settings.voiceCooldownSeconds,
          settings.voiceMaxPerCooldown,
          settings.levelUpNotificationEnabled,
          settings.levelUpChannelId,
          settings.levelUpMessage,
          settings.createdAt,
          settings.updatedAt,
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

  async getExcludedChannels(guildId: string): Promise<Result<string[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ExclusionRow[]>(
        "SELECT target_id FROM xp_exclusions WHERE guild_id = ? AND target_type = 'channel'",
        [guildId]
      );

      return Result.ok(rows.map(r => r.target_id));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getExcludedRoles(guildId: string): Promise<Result<string[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ExclusionRow[]>(
        "SELECT target_id FROM xp_exclusions WHERE guild_id = ? AND target_type = 'role'",
        [guildId]
      );

      return Result.ok(rows.map(r => r.target_id));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getHotTimes(guildId: string, type: 'text' | 'voice' | 'all'): Promise<Result<HotTimeConfig[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<HotTimeRow[]>(
        `SELECT start_time, end_time, multiplier, enabled
         FROM xp_hot_times
         WHERE guild_id = ? AND (type = ? OR type = 'all')`,
        [guildId, type]
      );

      return Result.ok(rows.map(r => ({
        startTime: r.start_time,
        endTime: r.end_time,
        multiplier: Number(r.multiplier),
        enabled: Boolean(r.enabled),
      })));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getLevelRewards(guildId: string, xpType: XpType): Promise<Result<LevelReward[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<LevelRewardRow[]>(
        `SELECT id, guild_id, type, level, role_id, remove_on_higher_level, created_at
         FROM xp_level_rewards
         WHERE guild_id = ? AND type = ?
         ORDER BY level`,
        [guildId, xpType]
      );

      return Result.ok(rows.map(r => ({
        id: r.id,
        guildId: r.guild_id,
        type: r.type,
        level: r.level,
        roleId: r.role_id,
        removeOnHigherLevel: Boolean(r.remove_on_higher_level),
        createdAt: r.created_at,
      })));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getLevelChannels(guildId: string, xpType: XpType): Promise<Result<LevelChannel[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<LevelChannelRow[]>(
        `SELECT id, guild_id, type, level, channel_id
         FROM xp_level_channels
         WHERE guild_id = ? AND type = ?
         ORDER BY level`,
        [guildId, xpType]
      );

      return Result.ok(rows.map(r => ({
        id: r.id,
        guildId: r.guild_id,
        type: r.type,
        level: r.level,
        channelId: r.channel_id,
      })));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getLevelRequirements(guildId: string, xpType: XpType): Promise<Result<LevelRequirement[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<LevelRequirementRow[]>(
        `SELECT guild_id, type, level, required_xp, created_at, updated_at
         FROM xp_level_requirements
         WHERE guild_id = ? AND type = ?
         ORDER BY level`,
        [guildId, xpType]
      );

      return Result.ok(rows.map(r => ({
        guildId: r.guild_id,
        type: r.type,
        level: r.level,
        requiredXp: r.required_xp,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async saveLevelRequirement(guildId: string, xpType: XpType, level: number, requiredXp: number): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO xp_level_requirements (guild_id, type, level, required_xp)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE required_xp = VALUES(required_xp), updated_at = NOW()`,
        [guildId, xpType, level, requiredXp]
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteLevelRequirement(guildId: string, xpType: XpType, level: number): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `DELETE FROM xp_level_requirements WHERE guild_id = ? AND type = ? AND level = ?`,
        [guildId, xpType, level]
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteAllLevelRequirements(guildId: string, xpType: XpType): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `DELETE FROM xp_level_requirements WHERE guild_id = ? AND type = ?`,
        [guildId, xpType]
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getMultipliers(guildId: string, targetType?: 'channel' | 'role'): Promise<Result<XpMultiplier[], RepositoryError>> {
    try {
      const query = targetType
        ? 'SELECT * FROM xp_multipliers WHERE guild_id = ? AND target_type = ?'
        : 'SELECT * FROM xp_multipliers WHERE guild_id = ?';
      const params = targetType ? [guildId, targetType] : [guildId];

      const [rows] = await this.pool.execute<MultiplierRow[]>(query, params);

      return Result.ok(rows.map(r => ({
        id: r.id,
        guildId: r.guild_id,
        targetType: r.target_type,
        targetId: r.target_id,
        multiplier: Number(r.multiplier),
      })));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getHotTimesWithChannels(guildId: string, type: 'text' | 'voice' | 'all'): Promise<Result<HotTimeConfig[], RepositoryError>> {
    try {
      // 핫타임 조회
      const [hotTimeRows] = await this.pool.execute<HotTimeRow[]>(
        `SELECT id, start_time, end_time, multiplier, enabled
         FROM xp_hot_times
         WHERE guild_id = ? AND (type = ? OR type = 'all')`,
        [guildId, type]
      );

      // 각 핫타임의 채널 목록 조회
      const hotTimes: HotTimeConfig[] = [];
      for (const row of hotTimeRows) {
        const [channelRows] = await this.pool.execute<HotTimeChannelRow[]>(
          `SELECT channel_id FROM xp_hot_time_channels WHERE hot_time_id = ?`,
          [row.id]
        );

        hotTimes.push({
          id: row.id,
          startTime: row.start_time,
          endTime: row.end_time,
          multiplier: Number(row.multiplier),
          enabled: Boolean(row.enabled),
          channelIds: channelRows.map(c => c.channel_id),
        });
      }

      return Result.ok(hotTimes);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getHotTimeChannels(hotTimeId: number): Promise<Result<string[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<HotTimeChannelRow[]>(
        `SELECT channel_id FROM xp_hot_time_channels WHERE hot_time_id = ?`,
        [hotTimeId]
      );

      return Result.ok(rows.map(r => r.channel_id));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async setHotTimeChannels(hotTimeId: number, channelIds: string[]): Promise<Result<void, RepositoryError>> {
    try {
      // 기존 채널 삭제
      await this.pool.execute(
        `DELETE FROM xp_hot_time_channels WHERE hot_time_id = ?`,
        [hotTimeId]
      );

      // 새 채널 추가
      if (channelIds.length > 0) {
        const values = channelIds.map(channelId => [hotTimeId, channelId]);
        await this.pool.query(
          `INSERT INTO xp_hot_time_channels (hot_time_id, channel_id) VALUES ?`,
          [values]
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
}
