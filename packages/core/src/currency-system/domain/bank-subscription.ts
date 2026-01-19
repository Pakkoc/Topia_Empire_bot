/**
 * 금고 구독 (디토뱅크)
 */
export interface BankSubscription {
  id: bigint;
  guildId: string;
  userId: string;
  tier: string | null;              // DB 호환용 (사용하지 않음)
  tierName: string | null;          // 표시용 등급명 (실버, 골드, 플래티넘 등)
  shopItemId: number | null;        // 연결된 상점 아이템 ID
  vaultLimit: bigint | null;        // 금고 한도
  interestRate: number | null;      // 월 이자율 (%)
  minDepositDays: number | null;    // 최소 예치 기간 (일)
  transferFeeExempt: boolean;       // 이체 수수료 면제 여부
  purchaseFeePercent: number | null;  // 구매 수수료율 (%)
  startsAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * 금고 혜택
 */
export interface BankBenefits {
  tierName: string | null;     // 표시용 등급명
  storageLimit: bigint;
  transferFeeExempt: boolean;
  purchaseFeePercent: number;  // 0 = 면제
  interestRate: number;        // 월 이자율 (%) - 금고 예금에 적용
  minDepositDays: number;      // 최소 예치 기간 (일)
}

/**
 * 기본 구독 기간 (일)
 */
export const SUBSCRIPTION_DURATION_DAYS = 30;

/**
 * 일반 유저 기본 혜택 (구독 없음)
 */
export const DEFAULT_BANK_BENEFITS: BankBenefits = {
  tierName: null,
  storageLimit: BigInt(50000),
  transferFeeExempt: false,
  purchaseFeePercent: 1.2,
  interestRate: 0,
  minDepositDays: 0,
};

/**
 * 구독 정보에서 혜택 조회
 */
export function getBankBenefitsFromSubscription(subscription: BankSubscription | null): BankBenefits {
  if (!subscription) {
    return DEFAULT_BANK_BENEFITS;
  }

  return {
    tierName: subscription.tierName,
    storageLimit: subscription.vaultLimit ?? DEFAULT_BANK_BENEFITS.storageLimit,
    transferFeeExempt: subscription.transferFeeExempt,
    purchaseFeePercent: subscription.purchaseFeePercent ?? DEFAULT_BANK_BENEFITS.purchaseFeePercent,
    interestRate: subscription.interestRate ?? 0,
    minDepositDays: subscription.minDepositDays ?? 0,
  };
}

/**
 * 구독 생성 옵션
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
 * 구독 생성
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
 * 구독 연장
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
