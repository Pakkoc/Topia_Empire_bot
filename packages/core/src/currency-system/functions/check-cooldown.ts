export interface CooldownResult {
  canEarn: boolean;
  remainingSeconds: number;
  countInCooldown: number;
  isNewCooldownPeriod: boolean;
}

/**
 * 쿨다운 체크 (순수함수)
 * @param lastActionAt - 마지막 획득 시간
 * @param cooldownSeconds - 쿨다운 시간 (초)
 * @param maxPerCooldown - 쿨다운 내 최대 획득 횟수
 * @param currentCount - 현재 쿨다운 내 획득 횟수
 * @param now - 현재 시간 (주입)
 */
export function checkCooldown(
  lastActionAt: Date | null,
  cooldownSeconds: number,
  maxPerCooldown: number,
  currentCount: number,
  now: Date
): CooldownResult {
  // 첫 획득
  if (!lastActionAt) {
    return {
      canEarn: true,
      remainingSeconds: 0,
      countInCooldown: 0,
      isNewCooldownPeriod: true,
    };
  }

  const elapsedMs = now.getTime() - lastActionAt.getTime();
  const elapsedSeconds = elapsedMs / 1000;

  // 쿨다운이 지났으면 새로운 쿨다운 시작
  if (elapsedSeconds >= cooldownSeconds) {
    return {
      canEarn: true,
      remainingSeconds: 0,
      countInCooldown: 0,
      isNewCooldownPeriod: true,
    };
  }

  // 쿨다운 중이지만 최대 횟수 미만
  if (currentCount < maxPerCooldown) {
    return {
      canEarn: true,
      remainingSeconds: Math.ceil(cooldownSeconds - elapsedSeconds),
      countInCooldown: currentCount,
      isNewCooldownPeriod: false,
    };
  }

  // 쿨다운 중이고 최대 횟수 도달
  return {
    canEarn: false,
    remainingSeconds: Math.ceil(cooldownSeconds - elapsedSeconds),
    countInCooldown: currentCount,
    isNewCooldownPeriod: false,
  };
}
