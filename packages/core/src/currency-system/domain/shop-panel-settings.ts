/**
 * 상점 패널 화폐 타입
 */
export type ShopPanelCurrencyType = 'topy' | 'ruby';

/**
 * 상점 패널 설정 엔티티
 */
export interface ShopPanelSettings {
  guildId: string;
  currencyType: ShopPanelCurrencyType;
  channelId: string | null;
  messageId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 상점 패널 설정 생성 DTO
 */
export interface CreateShopPanelSettingsDto {
  guildId: string;
  currencyType: ShopPanelCurrencyType;
  channelId?: string | null;
  messageId?: string | null;
}

/**
 * 상점 패널 설정 업데이트 DTO
 */
export interface UpdateShopPanelSettingsDto {
  channelId?: string | null;
  messageId?: string | null;
}

/**
 * 기본 상점 패널 설정 생성
 */
export function createDefaultShopPanelSettings(
  guildId: string,
  currencyType: ShopPanelCurrencyType
): ShopPanelSettings {
  const now = new Date();
  return {
    guildId,
    currencyType,
    channelId: null,
    messageId: null,
    createdAt: now,
    updatedAt: now,
  };
}
