/**
 * 랜덤 XP 생성 (순수함수)
 * @param min - 최소 XP
 * @param max - 최대 XP
 * @param randomValue - 0~1 사이 랜덤값 (주입)
 */
export function generateRandomXp(min: number, max: number, randomValue: number): number {
  if (min > max) {
    [min, max] = [max, min];
  }
  return Math.floor(min + randomValue * (max - min + 1));
}

/**
 * 배율 적용 XP 계산
 */
export function applyMultiplier(xp: number, multiplier: number): number {
  return Math.floor(xp * multiplier);
}
