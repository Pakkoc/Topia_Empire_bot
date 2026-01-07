/**
 * 상점 아이템 화폐 타입
 * - topy: 토피 상점에만 표시
 * - ruby: 루비 상점에만 표시
 * - both: 두 상점 모두에 표시
 */
export type ShopItemCurrencyType = 'topy' | 'ruby' | 'both';

/**
 * 상점 아이템 타입 (특수 로직이 필요한 아이템 식별)
 * - custom: 일반 (기본값)
 * - warning_reduction: 경고차감권
 * - tax_exemption: 세금면제권
 * - transfer_fee_reduction: 이체수수료감면권
 * - activity_boost: 활동부스트권
 * - premium_afk: 프리미엄잠수방
 * - vip_lounge: VIP라운지입장권
 * - dito_silver: 디토실버
 * - dito_gold: 디토골드
 * - color_basic: 색상선택권(기본)
 * - color_premium: 색상선택권(프리미엄)
 */
export type ShopItemType =
  | 'custom'
  | 'warning_reduction'
  | 'tax_exemption'
  | 'transfer_fee_reduction'
  | 'activity_boost'
  | 'premium_afk'
  | 'vip_lounge'
  | 'dito_silver'
  | 'dito_gold'
  | 'color_basic'
  | 'color_premium';

/**
 * 상점 아이템 - 티켓 판매
 */
export interface ShopItem {
  id: number;
  guildId: string;
  name: string;
  description: string | null;
  topyPrice: bigint | null;  // 토피 가격 (topy 또는 both일 때 사용)
  rubyPrice: bigint | null;  // 루비 가격 (ruby 또는 both일 때 사용)
  currencyType: ShopItemCurrencyType;
  itemType: ShopItemType;  // 아이템 타입
  durationDays: number; // 0=영구, 양수=기간제
  stock: number | null; // null=무제한
  maxPerUser: number | null; // null=무제한
  enabled: boolean;
  createdAt: Date;
}

export interface CreateShopItemInput {
  guildId: string;
  name: string;
  description?: string | null;
  topyPrice?: bigint | null;
  rubyPrice?: bigint | null;
  currencyType: ShopItemCurrencyType;
  itemType?: ShopItemType;
  durationDays?: number;
  stock?: number | null;
  maxPerUser?: number | null;
  enabled?: boolean;
}

export interface UpdateShopItemInput {
  name?: string;
  description?: string | null;
  topyPrice?: bigint | null;
  rubyPrice?: bigint | null;
  currencyType?: ShopItemCurrencyType;
  itemType?: ShopItemType;
  durationDays?: number;
  stock?: number | null;
  maxPerUser?: number | null;
  enabled?: boolean;
}

/**
 * 아이템의 가격을 화폐 타입에 따라 반환
 */
export function getItemPrice(item: ShopItem, forCurrency: 'topy' | 'ruby'): bigint | null {
  if (forCurrency === 'topy') {
    return item.topyPrice;
  }
  return item.rubyPrice;
}

/**
 * 기간제 아이템인지 확인
 */
export function isPeriodItem(item: ShopItem): boolean {
  return item.durationDays > 0;
}

// Backward compatibility aliases
export type ShopItemV2 = ShopItem;
export type CreateShopItemV2Input = CreateShopItemInput;
export type UpdateShopItemV2Input = UpdateShopItemInput;
