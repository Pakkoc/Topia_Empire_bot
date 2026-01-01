import type { Pool, RowDataPacket } from 'mysql2/promise';
import type {
  ShopPanelSettingsRepositoryPort,
  ShopPanelSettings,
  ShopPanelCurrencyType,
  CreateShopPanelSettingsDto,
  RepositoryError,
} from '@topia/core';
import { Result } from '@topia/core';

// ========== Row Interface ==========

interface ShopPanelSettingsRow extends RowDataPacket {
  guild_id: string;
  currency_type: 'topy' | 'ruby';
  channel_id: string | null;
  message_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ========== Mapper ==========

function toShopPanelSettings(row: ShopPanelSettingsRow): ShopPanelSettings {
  return {
    guildId: row.guild_id,
    currencyType: row.currency_type,
    channelId: row.channel_id,
    messageId: row.message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ========== Repository ==========

export class ShopPanelSettingsRepository implements ShopPanelSettingsRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findByGuildAndType(
    guildId: string,
    currencyType: ShopPanelCurrencyType
  ): Promise<Result<ShopPanelSettings | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ShopPanelSettingsRow[]>(
        'SELECT * FROM shop_panel_settings WHERE guild_id = ? AND currency_type = ?',
        [guildId, currencyType]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toShopPanelSettings(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findAllByGuild(guildId: string): Promise<Result<ShopPanelSettings[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<ShopPanelSettingsRow[]>(
        'SELECT * FROM shop_panel_settings WHERE guild_id = ? ORDER BY currency_type ASC',
        [guildId]
      );
      return Result.ok(rows.map(toShopPanelSettings));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async upsert(dto: CreateShopPanelSettingsDto): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `INSERT INTO shop_panel_settings (guild_id, currency_type, channel_id, message_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         channel_id = VALUES(channel_id),
         message_id = VALUES(message_id),
         updated_at = NOW()`,
        [
          dto.guildId,
          dto.currencyType,
          dto.channelId ?? null,
          dto.messageId ?? null,
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

  async updatePanel(
    guildId: string,
    currencyType: ShopPanelCurrencyType,
    channelId: string | null,
    messageId: string | null
  ): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute(
        `UPDATE shop_panel_settings
         SET channel_id = ?, message_id = ?, updated_at = NOW()
         WHERE guild_id = ? AND currency_type = ?`,
        [channelId, messageId, guildId, currencyType]
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
