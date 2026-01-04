/**
 * 금고 (Vault) - 디토 실버/골드 구독자 전용 예금 시스템
 */

export interface UserVault {
  id: bigint;
  guildId: string;
  userId: string;
  depositedAmount: bigint;
  lastInterestAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVaultInput {
  guildId: string;
  userId: string;
}

export interface VaultDepositResult {
  vault: UserVault;
  depositedAmount: bigint;
  newTotal: bigint;
}

export interface VaultWithdrawResult {
  vault: UserVault;
  withdrawnAmount: bigint;
  newTotal: bigint;
}

export interface VaultInterestResult {
  userId: string;
  depositedAmount: bigint;
  interestRate: number; // percent
  interestAmount: bigint;
  newTotal: bigint;
}

/**
 * 이자 계산 함수
 * @param depositedAmount 예치 금액
 * @param interestRate 이자율 (퍼센트)
 * @returns 이자 금액
 */
export function calculateInterest(depositedAmount: bigint, interestRate: number): bigint {
  if (depositedAmount <= BigInt(0) || interestRate <= 0) {
    return BigInt(0);
  }
  // interestRate를 1000분율로 변환 (1% = 10/1000, 2% = 20/1000)
  const rate = Math.round(interestRate * 10);
  return (depositedAmount * BigInt(rate)) / BigInt(1000);
}
