/**
 * 디토뱅크 구독 티어 (레거시, vault_subscription 사용 권장)
 */
export type BankTier = 'silver' | 'gold';

/**
 * 디토뱅크 구독
 */
export interface BankSubscription {
  id: bigint;
  guildId: string;
  userId: string;
  tier: BankTier | null;          // 레거시 티어 (null이면 동적 등급)
  tierName: string | null;        // 표시용 등급명 (실버, 골드, 플래티넘 등)
  shopItemId: number | null;      // 연결된 상점 아이템 ID
  vaultLimit: bigint | null;      // 금고 한도 (null이면 기본값)
  interestRate: number | null;    // 월 이자율 (null이면 기본값)
  minDepositDays: number | null;  // 최소 예치 기간 (null이면 기본값)
  transferFeeExempt: boolean;     // 이체 수수료 면제 여부
  purchaseFeePercent: number | null;  // 구매 수수료율 (%)
  startsAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * 디토뱅크 혜택
 */
export interface BankBenefits {
  tier: BankTier | null;       // 레거시 티어
  tierName: string | null;     // 표시용 등급명
  storageLimit: bigint;
  transferFeeExempt: boolean;
  purchaseFeePercent: number;  // 0 = 면제
  interestRate: number;        // 월 이자율 (%) - 금고 예금에 적용
  minDepositDays: number;      // 최소 예치 기간 (일)
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
 * 티어별 혜택 조회 (레거시, getBankBenefitsFromSubscription 사용 권장)
 */
export function getBankBenefits(tier: BankTier | null): BankBenefits {
  if (tier === 'gold') {
    return {
      tier: 'gold',
      tierName: '골드',
      storageLimit: BigInt(200000),
      transferFeeExempt: true,
      purchaseFeePercent: 0,      // 면제
      interestRate: 2,            // 월 2%
      minDepositDays: 7,          // 최소 7일 예치
    };
  }

  if (tier === 'silver') {
    return {
      tier: 'silver',
      tierName: '실버',
      storageLimit: BigInt(100000),
      transferFeeExempt: true,
      purchaseFeePercent: 1.2,    // 1.2%
      interestRate: 1,            // 월 1%
      minDepositDays: 7,          // 최소 7일 예치
    };
  }

  // 일반 유저 (구독 없음)
  return {
    tier: null,
    tierName: null,
    storageLimit: BigInt(50000),
    transferFeeExempt: false,
    purchaseFeePercent: 1.2,      // 1.2%
    interestRate: 0,              // 이자 없음
    minDepositDays: 0,            // 이자 없으므로 의미 없음
  };
}

/**
 * 구독 정보에서 혜택 조회 (동적 등급 시스템)
 */
export function getBankBenefitsFromSubscription(subscription: BankSubscription | null): BankBenefits {
  if (!subscription) {
    return getBankBenefits(null);
  }

  // 동적 등급 (vault_subscription) - 구독에 저장된 값 사용
  if (subscription.tierName || subscription.shopItemId) {
    return {
      tier: subscription.tier,
      tierName: subscription.tierName,
      storageLimit: subscription.vaultLimit ?? BigInt(0),
      transferFeeExempt: subscription.transferFeeExempt,
      purchaseFeePercent: subscription.purchaseFeePercent ?? 1.2,
      interestRate: subscription.interestRate ?? 0,
      minDepositDays: subscription.minDepositDays ?? 0,
    };
  }

  // 레거시 티어 - 기본값에 커스텀 값 오버라이드
  const baseBenefits = getBankBenefits(subscription.tier);
  return {
    ...baseBenefits,
    storageLimit: subscription.vaultLimit ?? baseBenefits.storageLimit,
    interestRate: subscription.interestRate ?? baseBenefits.interestRate,
    minDepositDays: subscription.minDepositDays ?? baseBenefits.minDepositDays,
  };
}

/**
 * 레거시 구독 생성 옵션
 */
export interface LegacySubscriptionOptions {
  tier: BankTier;
  vaultLimit?: bigint | null;
  interestRate?: number | null;
  minDepositDays?: number | null;
}

/**
 * 동적 등급 구독 생성 옵션
 */
export interface DynamicSubscriptionOptions {
  tierName: string;
  shopItemId: number;
  vaultLimit: bigint;
  interestRate: number;
  minDepositDays?: number | null;
  transferFeeExempt?: boolean;
  purchaseFeePercent?: number | null;
}

/**
 * 구독 생성 (레거시)
 */
export function createBankSubscription(
  guildId: string,
  userId: string,
  tier: BankTier,
  startsAt: Date,
  vaultLimit?: bigint | null,
  interestRate?: number | null,
  minDepositDays?: number | null
): Omit<BankSubscription, 'id' | 'createdAt'> {
  const expiresAt = new Date(startsAt.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const benefits = getBankBenefits(tier);

  return {
    guildId,
    userId,
    tier,
    tierName: benefits.tierName,
    shopItemId: null,
    vaultLimit: vaultLimit ?? null,
    interestRate: interestRate ?? null,
    minDepositDays: minDepositDays ?? null,
    transferFeeExempt: benefits.transferFeeExempt,
    purchaseFeePercent: benefits.purchaseFeePercent,
    startsAt,
    expiresAt,
  };
}

/**
 * 동적 등급 구독 생성 (vault_subscription)
 */
export function createDynamicBankSubscription(
  guildId: string,
  userId: string,
  options: DynamicSubscriptionOptions,
  startsAt: Date,
  durationDays: number = SUBSCRIPTION_DURATION_DAYS
): Omit<BankSubscription, 'id' | 'createdAt'> {
  const expiresAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

  return {
    guildId,
    userId,
    tier: null,
    tierName: options.tierName,
    shopItemId: options.shopItemId,
    vaultLimit: options.vaultLimit,
    interestRate: options.interestRate,
    minDepositDays: options.minDepositDays ?? null,
    transferFeeExempt: options.transferFeeExempt ?? false,
    purchaseFeePercent: options.purchaseFeePercent ?? null,
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
