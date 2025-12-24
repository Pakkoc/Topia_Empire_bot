import type { CurrencyType } from '../domain/currency-transaction';

/**
 * 이체 수수료 계산
 * - 토피: 1.2% 수수료
 * - 루비: 수수료 면제
 */
export function calculateTransferFee(
  amount: bigint,
  currencyType: CurrencyType
): bigint {
  if (currencyType === 'ruby') {
    return BigInt(0);
  }
  // 토피: 1.2% = 12/1000
  return (amount * BigInt(12)) / BigInt(1000);
}

/**
 * 최소 이체 금액 확인
 * - 토피: 100
 * - 루비: 1
 */
export function getMinTransferAmount(currencyType: CurrencyType): bigint {
  return currencyType === 'topy' ? BigInt(100) : BigInt(1);
}
