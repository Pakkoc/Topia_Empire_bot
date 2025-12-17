import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { XpSettingsRepositoryPort, XpSettings, RepositoryError } from '@topia/core';
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
  level_up_channel_id: string | null;
  level_up_message: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ExclusionRow extends RowDataPacket {
  target_id: string;
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

      if (rows.length === 0) {
        return Result.ok(null);
      }

      return Result.ok(toXpSettings(rows[0]));
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
          level_up_channel_id, level_up_message, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
}
