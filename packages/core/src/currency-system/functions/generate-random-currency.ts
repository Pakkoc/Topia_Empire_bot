/**
 * 랜덤 화폐 생성 (순수함수)
 * @param min - 최소값
 * @param max - 최대값
 * @param randomValue - 0~1 사이 랜덤값 (주입)
 */
export function generateRandomCurrency(min: number, max: number, randomValue: number): number {
  if (min > max) {
    [min, max] = [max, min];
  }
  return Math.floor(min + randomValue * (max - min + 1));
}

/**
 * 배율 적용 화폐 계산
 */
export function applyMultiplier(amount: number, multiplier: number): number {
  return Math.floor(amount * multiplier);
}
