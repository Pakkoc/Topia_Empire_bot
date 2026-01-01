import type { Result } from '../../shared/types/result';
import type { RepositoryError } from '../errors';
import type {
  ShopPanelSettings,
  ShopPanelCurrencyType,
  CreateShopPanelSettingsDto,
} from '../domain/shop-panel-settings';

/**
 * 상점 패널 설정 Repository 포트
 */
export interface ShopPanelSettingsRepositoryPort {
  /**
   * 길드와 화폐 타입으로 설정 조회
   */
  findByGuildAndType(
    guildId: string,
    currencyType: ShopPanelCurrencyType
  ): Promise<Result<ShopPanelSettings | null, RepositoryError>>;

  /**
   * 길드의 모든 상점 패널 설정 조회
   */
  findAllByGuild(guildId: string): Promise<Result<ShopPanelSettings[], RepositoryError>>;

  /**
   * 상점 패널 설정 생성 또는 업데이트
   */
  upsert(dto: CreateShopPanelSettingsDto): Promise<Result<void, RepositoryError>>;

  /**
   * 패널 위치 업데이트 (channelId, messageId)
   */
  updatePanel(
    guildId: string,
    currencyType: ShopPanelCurrencyType,
    channelId: string | null,
    messageId: string | null
  ): Promise<Result<void, RepositoryError>>;
}
