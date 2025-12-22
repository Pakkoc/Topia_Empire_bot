export interface DailyLimitResult {
  canEarn: boolean;
  remainingToday: number;
  earnedToday: number;
}

/**
 * 일일 상한 체크 (순수함수)
 * @param dailyEarned - 오늘 획득한 양
 * @param dailyLimit - 일일 상한
 * @param amountToEarn - 획득하려는 양
 */
export function checkDailyLimit(
  dailyEarned: number,
  dailyLimit: number,
  amountToEarn: number
): DailyLimitResult {
  const remainingToday = Math.max(0, dailyLimit - dailyEarned);

  if (remainingToday <= 0) {
    return {
      canEarn: false,
      remainingToday: 0,
      earnedToday: dailyEarned,
    };
  }

  return {
    canEarn: true,
    remainingToday,
    earnedToday: dailyEarned,
  };
}

/**
 * 일일 상한을 고려하여 실제 획득량 계산
 */
export function calculateActualEarning(
  dailyEarned: number,
  dailyLimit: number,
  baseAmount: number
): number {
  const remaining = Math.max(0, dailyLimit - dailyEarned);
  return Math.min(baseAmount, remaining);
}
