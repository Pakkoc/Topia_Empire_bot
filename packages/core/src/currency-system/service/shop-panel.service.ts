import type { Result } from '../../shared/types/result';
import type { CurrencyError } from '../errors';
import type { ShopPanelSettingsRepositoryPort } from '../port/shop-panel-settings-repository.port';
import type {
  ShopPanelSettings,
  ShopPanelCurrencyType,
} from '../domain/shop-panel-settings';
import { createDefaultShopPanelSettings } from '../domain/shop-panel-settings';

/**
 * 상점 패널 서비스
 * - 토피/루비 상점 패널 설정 관리
 */
export class ShopPanelService {
  constructor(
    private readonly shopPanelSettingsRepo: ShopPanelSettingsRepositoryPort
  ) {}

  /**
   * 상점 패널 설정 조회
   */
  async getSettings(
    guildId: string,
    currencyType: ShopPanelCurrencyType
  ): Promise<Result<ShopPanelSettings, CurrencyError>> {
    const result = await this.shopPanelSettingsRepo.findByGuildAndType(guildId, currencyType);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }

    // 설정이 없으면 기본값 반환
    const settings = result.data ?? createDefaultShopPanelSettings(guildId, currencyType);
    return { success: true, data: settings };
  }

  /**
   * 길드의 모든 상점 패널 설정 조회
   */
  async getAllSettings(guildId: string): Promise<Result<ShopPanelSettings[], CurrencyError>> {
    const result = await this.shopPanelSettingsRepo.findAllByGuild(guildId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  /**
   * 패널 위치 업데이트 (채널 ID, 메시지 ID)
   */
  async updatePanel(
    guildId: string,
    currencyType: ShopPanelCurrencyType,
    channelId: string | null,
    messageId: string | null
  ): Promise<Result<void, CurrencyError>> {
    // 먼저 설정이 존재하는지 확인하고 없으면 생성
    const existsResult = await this.shopPanelSettingsRepo.findByGuildAndType(guildId, currencyType);
    if (!existsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: existsResult.error } };
    }

    if (!existsResult.data) {
      // 설정이 없으면 생성
      const upsertResult = await this.shopPanelSettingsRepo.upsert({
        guildId,
        currencyType,
        channelId,
        messageId,
      });
      if (!upsertResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: upsertResult.error } };
      }
      return { success: true, data: undefined };
    }

    // 설정 업데이트
    const updateResult = await this.shopPanelSettingsRepo.updatePanel(
      guildId,
      currencyType,
      channelId,
      messageId
    );
    if (!updateResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: updateResult.error } };
    }

    return { success: true, data: undefined };
  }
}
