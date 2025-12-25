/**
 * 장터 상품 카테고리
 */
export type MarketCategory = 'design' | 'music' | 'video' | 'coding' | 'other';

/**
 * 장터 상품 상태
 */
export type MarketStatus = 'active' | 'sold' | 'cancelled' | 'expired';

/**
 * 장터 상품
 */
export interface MarketListing {
  id: bigint;
  guildId: string;
  sellerId: string;
  title: string;
  description: string | null;
  category: MarketCategory;
  price: bigint;
  currencyType: 'topy' | 'ruby';
  status: MarketStatus;
  buyerId: string | null;
  createdAt: Date;
  expiresAt: Date;
  soldAt: Date | null;
}

/**
 * 장터 상품 생성 데이터
 */
export interface CreateMarketListing {
  guildId: string;
  sellerId: string;
  title: string;
  description?: string;
  category: MarketCategory;
  price: bigint;
  currencyType: 'topy' | 'ruby';
}

/**
 * 장터 상품 생성
 */
export function createMarketListing(
  data: CreateMarketListing,
  now: Date
): Omit<MarketListing, 'id'> {
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30일 후

  return {
    guildId: data.guildId,
    sellerId: data.sellerId,
    title: data.title,
    description: data.description ?? null,
    category: data.category,
    price: data.price,
    currencyType: data.currencyType,
    status: 'active',
    buyerId: null,
    createdAt: now,
    expiresAt,
    soldAt: null,
  };
}

/**
 * 카테고리 라벨
 */
export const CATEGORY_LABELS: Record<MarketCategory, string> = {
  design: '🎨 디자인',
  music: '🎵 음악',
  video: '🎬 영상',
  coding: '💻 코딩',
  other: '✨ 기타',
};

/**
 * 상태 라벨
 */
export const STATUS_LABELS: Record<MarketStatus, string> = {
  active: '🟢 판매중',
  sold: '🔴 판매완료',
  cancelled: '⚫ 취소됨',
  expired: '⚪ 만료됨',
};
