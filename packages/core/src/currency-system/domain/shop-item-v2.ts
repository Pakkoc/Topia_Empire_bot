/**
 * 상점 아이템 V2 - 단순화된 티켓 판매
 */
export interface ShopItemV2 {
  id: number;
  guildId: string;
  name: string;
  description: string | null;
  price: bigint;
  currencyType: 'topy' | 'ruby';
  durationDays: number; // 0=영구, 양수=기간제
  stock: number | null; // null=무제한
  maxPerUser: number | null; // null=무제한
  enabled: boolean;
  createdAt: Date;
}

export interface CreateShopItemV2Input {
  guildId: string;
  name: string;
  description?: string | null;
  price: bigint;
  currencyType: 'topy' | 'ruby';
  durationDays?: number;
  stock?: number | null;
  maxPerUser?: number | null;
  enabled?: boolean;
}

export interface UpdateShopItemV2Input {
  name?: string;
  description?: string | null;
  price?: bigint;
  currencyType?: 'topy' | 'ruby';
  durationDays?: number;
  stock?: number | null;
  maxPerUser?: number | null;
  enabled?: boolean;
}

/**
 * 기간제 아이템인지 확인
 */
export function isPeriodItem(item: ShopItemV2): boolean {
  return item.durationDays > 0;
}
