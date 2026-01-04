/**
 * 디토뱅크 구독 티어
 */
export type BankTier = 'silver' | 'gold';

/**
 * 디토뱅크 구독
 */
export interface BankSubscription {
  id: bigint;
  guildId: string;
  userId: string;
  tier: BankTier;
  startsAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * 디토뱅크 혜택
 */
export interface BankBenefits {
  tier: BankTier | null;
  storageLimit: bigint;
  transferFeeExempt: boolean;
  purchaseFeePercent: number;  // 0 = 면제
  marketFeePercent: number;
  interestRate: number;  // 월 이자율 (%) - 금고 예금에 적용
}

/**
 * 구독 기간 (일)
 */
export const SUBSCRIPTION_DURATION_DAYS = 30;

/**
 * 티어별 가격 (루비)
 */
export const BANK_TIER_PRICES: Record<BankTier, bigint> = {
  silver: BigInt(10),
  gold: BigInt(15),
};

/**
 * 티어별 혜택 조회
 */
export function getBankBenefits(tier: BankTier | null): BankBenefits {
  if (tier === 'gold') {
    return {
      tier: 'gold',
      storageLimit: BigInt(200000),
      transferFeeExempt: true,
      purchaseFeePercent: 0,      // 면제
      marketFeePercent: 3,        // 3%
      interestRate: 2,            // 월 2%
    };
  }

  if (tier === 'silver') {
    return {
      tier: 'silver',
      storageLimit: BigInt(100000),
      transferFeeExempt: true,
      purchaseFeePercent: 1.2,    // 1.2%
      marketFeePercent: 5,        // 5%
      interestRate: 1,            // 월 1%
    };
  }

  // 일반 유저 (구독 없음)
  return {
    tier: null,
    storageLimit: BigInt(50000),
    transferFeeExempt: false,
    purchaseFeePercent: 1.2,      // 1.2%
    marketFeePercent: 5,          // 5%
    interestRate: 0,              // 이자 없음
  };
}

/**
 * 구독 생성
 */
export function createBankSubscription(
  guildId: string,
  userId: string,
  tier: BankTier,
  startsAt: Date
): Omit<BankSubscription, 'id' | 'createdAt'> {
  const expiresAt = new Date(startsAt.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  return {
    guildId,
    userId,
    tier,
    startsAt,
    expiresAt,
  };
}

/**
 * 구독 연장 (같은 티어)
 */
export function extendSubscription(
  subscription: BankSubscription,
  days: number = SUBSCRIPTION_DURATION_DAYS
): BankSubscription {
  const newExpiresAt = new Date(subscription.expiresAt.getTime() + days * 24 * 60 * 60 * 1000);

  return {
    ...subscription,
    expiresAt: newExpiresAt,
  };
}

/**
 * 구독이 현재 활성 상태인지 확인
 */
export function isSubscriptionActive(subscription: BankSubscription, now: Date): boolean {
  return subscription.startsAt <= now && subscription.expiresAt > now;
}

/**
 * 티어 라벨
 */
export const BANK_TIER_LABELS: Record<BankTier, string> = {
  silver: '🥈 실버',
  gold: '🥇 골드',
};
