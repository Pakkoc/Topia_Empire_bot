import type { Pool, RowDataPacket } from 'mysql2/promise';
import type {
  CurrencySettingsRepositoryPort,
  CurrencySettings,
  CurrencyHotTimeConfig,
  CurrencyMultiplier,
  ChannelCategory,
  ChannelCategoryConfig,
  CategoryMultiplierConfig,
  RepositoryError,
} from '@topia/core';
import { Result } from '@topia/core';

interface CurrencySettingsRow extends RowDataPacket {
  guild_id: string;
  enabled: number;
  topy_name: string;
  ruby_name: string;
  topy_manager_enabled: number;
  ruby_manager_enabled: number;
  text_earn_enabled: number;
  text_earn_min: number;
  text_earn_max: number;
  text_min_length: number;
  text_cooldown_seconds: number;
  text_max_per_cooldown: number;
  text_daily_limit: number;
  voice_earn_enabled: number;
  voice_earn_min: number;
  voice_earn_max: number;
  voice_cooldown_seconds: number;
  voice_daily_limit: number;
  min_transfer_topy: number;
  min_transfer_ruby: number;
  transfer_fee_topy_percent: string;
  transfer_fee_ruby_percent: string;
  shop_fee_topy_percent: string;
  shop_fee_ruby_percent: string;
  monthly_tax_enabled: number;
  monthly_tax_percent: string;
  shop_channel_id: string | null;
  shop_message_id: string | null;
  currency_log_channel_id: string | null;
  item_manager_role_id: string | null;
  item_log_channel_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface HotTimeRow extends RowDataPacket {
  id: number;
  guild_id: string;
  type: 'text' | 'voice' | 'all';
  start_time: string;
  end_time: string;
  multiplier: string;
  enabled: number;
  channel_ids: string | null;
}

interface MultiplierRow extends RowDataPacket {
  id: number;
  guild_id: string;
  target_type: 'channel' | 'role';
  target_id: string;
  multiplier: string;
}

interface ExclusionRow extends RowDataPacket {
  target_id: string;
}

interface ChannelCategoryRow extends RowDataPacket {
  id: number;
  guild_id: string;
  channel_id: string;
  category: ChannelCategory;
  created_at: Date;
}

interface CategoryMultiplierRow extends RowDataPacket {
  id: number;
  guild_id: string;
  category: ChannelCategory;
  multiplier: string;
  created_at: Date;
  updated_at: Date;
}

function toCurrencySettings(row: CurrencySettingsRow): CurrencySettings {
  return {
    guildId: row.guild_id,
    enabled: row.enabled === 1,
    topyName: row.topy_name ?? '토피',
    rubyName: row.ruby_name ?? '루비',
    topyManagerEnabled: row.topy_manager_enabled !== 0,
    rubyManagerEnabled: row.ruby_manager_enabled !== 0,
    textEarnEnabled: row.text_earn_enabled === 1,
    textEarnMin: row.text_earn_min,
    textEarnMax: row.text_earn_max,
    textMinLength: row.text_min_length,
    textCooldownSeconds: row.text_cooldown_seconds,
    textMaxPerCooldown: row.text_max_per_cooldown,
    textDailyLimit: row.text_daily_limit,
    voiceEarnEnabled: row.voice_earn_enabled === 1,
    voiceEarnMin: row.voice_earn_min,
    voiceEarnMax: row.voice_earn_max,
    voiceCooldownSeconds: row.voice_cooldown_seconds,
    voiceDailyLimit: row.voice_daily_limit,
    minTransferTopy: row.min_transfer_topy ?? 100,
    minTransferRuby: row.min_transfer_ruby ?? 1,
    transferFeeTopyPercent: parseFloat(row.transfer_fee_topy_percent) || 1.2,
    transferFeeRubyPercent: parseFloat(row.transfer_fee_ruby_percent) || 0,
    shopFeeTopyPercent: parseFloat(row.shop_fee_topy_percent) || 0,
    shopFeeRubyPercent: parseFloat(row.shop_fee_ruby_percent) || 0,
    monthlyTaxEnabled: row.monthly_tax_enabled === 1,
    monthlyTaxPercent: parseFloat(row.monthly_tax_percent) || 3.3,
    shopChannelId: row.shop_channel_id ?? null,
    shopMessageId: row.shop_message_id ?? null,
    currencyLogChannelId: row.currency_log_channel_id ?? null,
    itemManagerRoleId: row.item_manager_role_id ?? null,
    itemLogChannelId: row.item_log_channel_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CurrencySettingsRepository implements CurrencySettingsRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findByGuild(guildId: string): Promise<Result<CurrencySettings | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<CurrencySettingsRow[]>(
        'SELECT * FROM currency_settings WHERE guild_id = ?',
        [guildId]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toCurrencySettings(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async save(settings: CurrencySettings): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO currency_settings
         (guild_id, enabled, topy_name, ruby_name, topy_manager_enabled, ruby_manager_enabled,
          text_earn_enabled, text_earn_min, text_earn_max,
          text_min_length, text_cooldown_seconds, text_max_per_cooldown, text_daily_limit,
          voice_earn_enabled, voice_earn_min, voice_earn_max, voice_cooldown_seconds,
          voice_daily_limit, min_transfer_topy, min_transfer_ruby,
          transfer_fee_topy_percent, transfer_fee_ruby_percent,
          shop_fee_topy_percent, shop_fee_ruby_percent,
          monthly_tax_enabled, monthly_tax_percent,
          shop_channel_id, shop_message_id, currency_log_channel_id,
          item_manager_role_id, item_log_channel_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         enabled = VALUES(enabled),
         topy_name = VALUES(topy_name),
         ruby_name = VALUES(ruby_name),
         topy_manager_enabled = VALUES(topy_manager_enabled),
         ruby_manager_enabled = VALUES(ruby_manager_enabled),
         text_earn_enabled = VALUES(text_earn_enabled),
         text_earn_min = VALUES(text_earn_min),
         text_earn_max = VALUES(text_earn_max),
         text_min_length = VALUES(text_min_length),
         text_cooldown_seconds = VALUES(text_cooldown_seconds),
         text_max_per_cooldown = VALUES(text_max_per_cooldown),
         text_daily_limit = VALUES(text_daily_limit),
         voice_earn_enabled = VALUES(voice_earn_enabled),
         voice_earn_min = VALUES(voice_earn_min),
         voice_earn_max = VALUES(voice_earn_max),
         voice_cooldown_seconds = VALUES(voice_cooldown_seconds),
         voice_daily_limit = VALUES(voice_daily_limit),
         min_transfer_topy = VALUES(min_transfer_topy),
         min_transfer_ruby = VALUES(min_transfer_ruby),
         transfer_fee_topy_percent = VALUES(transfer_fee_topy_percent),
         transfer_fee_ruby_percent = VALUES(transfer_fee_ruby_percent),
         shop_fee_topy_percent = VALUES(shop_fee_topy_percent),
         shop_fee_ruby_percent = VALUES(shop_fee_ruby_percent),
         monthly_tax_enabled = VALUES(monthly_tax_enabled),
         monthly_tax_percent = VALUES(monthly_tax_percent),
         shop_channel_id = VALUES(shop_channel_id),
         shop_message_id = VALUES(shop_message_id),
         currency_log_channel_id = VALUES(currency_log_channel_id),
         item_manager_role_id = VALUES(item_manager_role_id),
         item_log_channel_id = VALUES(item_log_channel_id),
         updated_at = VALUES(updated_at)`,
        [
          settings.guildId,
          settings.enabled ? 1 : 0,
          settings.topyName,
          settings.rubyName,
          settings.topyManagerEnabled ? 1 : 0,
          settings.rubyManagerEnabled ? 1 : 0,
          settings.textEarnEnabled ? 1 : 0,
          settings.textEarnMin,
          settings.textEarnMax,
          settings.textMinLength,
          settings.textCooldownSeconds,
          settings.textMaxPerCooldown,
          settings.textDailyLimit,
          settings.voiceEarnEnabled ? 1 : 0,
          settings.voiceEarnMin,
          settings.voiceEarnMax,
          settings.voiceCooldownSeconds,
          settings.voiceDailyLimit,
          settings.minTransferTopy,
          settings.minTransferRuby,
          settings.transferFeeTopyPercent,
          settings.transferFeeRubyPercent,
          settings.shopFeeTopyPercent,
          settings.shopFeeRubyPercent,
          settings.monthlyTaxEnabled ? 1 : 0,
          settings.monthlyTaxPercent,
          settings.shopChannelId,
          settings.shopMessageId,
          settings.currencyLogChannelId,
          settings.itemManagerRoleId,
          settings.itemLogChannelId,
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
        "SELECT target_id FROM currency_exclusions WHERE guild_id = ? AND target_type = 'channel'",
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
        "SELECT target_id FROM currency_exclusions WHERE guild_id = ? AND target_type = 'role'",
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

  async getHotTimes(guildId: string, type: 'text' | 'voice' | 'all'): Promise<Result<CurrencyHotTimeConfig[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<HotTimeRow[]>(
        `SELECT * FROM currency_hot_times
         WHERE guild_id = ? AND (type = ? OR type = 'all') AND enabled = 1`,
        [guildId, type]
      );

      return Result.ok(rows.map(r => ({
        id: r.id,
        type: r.type,
        startTime: r.start_time,
        endTime: r.end_time,
        multiplier: parseFloat(r.multiplier),
        enabled: r.enabled === 1,
        channelIds: r.channel_ids ? JSON.parse(r.channel_ids) : [],
      })));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getMultipliers(guildId: string, targetType?: 'channel' | 'role'): Promise<Result<CurrencyMultiplier[], RepositoryError>> {
    try {
      let query = 'SELECT * FROM currency_multipliers WHERE guild_id = ?';
      const params: unknown[] = [guildId];

      if (targetType) {
        query += ' AND target_type = ?';
        params.push(targetType);
      }

      const [rows] = await this.pool.execute<MultiplierRow[]>(query, params);

      return Result.ok(rows.map(r => ({
        id: r.id,
        guildId: r.guild_id,
        targetType: r.target_type,
        targetId: r.target_id,
        multiplier: parseFloat(r.multiplier),
      })));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getChannelCategory(guildId: string, channelId: string): Promise<Result<ChannelCategory, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ChannelCategoryRow[]>(
        'SELECT category FROM currency_channel_categories WHERE guild_id = ? AND channel_id = ?',
        [guildId, channelId]
      );

      const firstRow = rows[0];
      // 설정이 없으면 기본값 'normal'
      return Result.ok(firstRow?.category ?? 'normal');
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getChannelCategories(guildId: string): Promise<Result<ChannelCategoryConfig[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ChannelCategoryRow[]>(
        'SELECT * FROM currency_channel_categories WHERE guild_id = ?',
        [guildId]
      );

      return Result.ok(rows.map(r => ({
        id: r.id,
        guildId: r.guild_id,
        channelId: r.channel_id,
        category: r.category,
        createdAt: r.created_at,
      })));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getCategoryMultipliers(guildId: string): Promise<Result<CategoryMultiplierConfig[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<CategoryMultiplierRow[]>(
        'SELECT * FROM currency_category_multipliers WHERE guild_id = ?',
        [guildId]
      );

      return Result.ok(rows.map(r => ({
        id: r.id,
        guildId: r.guild_id,
        category: r.category,
        multiplier: parseFloat(r.multiplier),
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

  async getCategoryMultiplier(guildId: string, category: ChannelCategory): Promise<Result<number | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<CategoryMultiplierRow[]>(
        'SELECT multiplier FROM currency_category_multipliers WHERE guild_id = ? AND category = ?',
        [guildId, category]
      );

      const firstRow = rows[0];
      return Result.ok(firstRow ? parseFloat(firstRow.multiplier) : null);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async saveCategoryMultiplier(guildId: string, category: ChannelCategory, multiplier: number): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO currency_category_multipliers (guild_id, category, multiplier)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE multiplier = VALUES(multiplier), updated_at = NOW()`,
        [guildId, category, multiplier]
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteCategoryMultiplier(guildId: string, category: ChannelCategory): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        'DELETE FROM currency_category_multipliers WHERE guild_id = ? AND category = ?',
        [guildId, category]
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
