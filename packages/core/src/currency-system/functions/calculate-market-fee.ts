/**
 * 장터 수수료 계산 (판매자 부담)
 * 기본값: 토피 5%, 루비 3%
 */
export function calculateMarketFee(
  amount: bigint,
  currencyType: 'topy' | 'ruby',
  feePercent?: number
): bigint {
  const percent = feePercent ?? (currencyType === 'ruby' ? 3 : 5);
  return (amount * BigInt(percent)) / BigInt(100);
}

/**
 * 장터 최소 가격 확인
 * - 토피: 100 이상
 * - 루비: 1 이상
 */
export function getMinMarketPrice(currencyType: 'topy' | 'ruby'): bigint {
  return currencyType === 'topy' ? BigInt(100) : BigInt(1);
}

/**
 * 유효한 가격인지 확인
 */
export function isValidMarketPrice(
  price: bigint,
  currencyType: 'topy' | 'ruby'
): boolean {
  return price >= getMinMarketPrice(currencyType);
}

/**
 * 판매자 실수령액 계산
 */
export function calculateSellerReceiveAmount(
  price: bigint,
  currencyType: 'topy' | 'ruby',
  feePercent?: number
): bigint {
  const fee = calculateMarketFee(price, currencyType, feePercent);
  return price - fee;
}
