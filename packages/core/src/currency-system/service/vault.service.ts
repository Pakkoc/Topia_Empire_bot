import type { ClockPort } from '../../shared/port/clock.port';
import type { CurrencyError } from '../errors';
import type { VaultRepositoryPort } from '../port/vault-repository.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type { BankSubscriptionRepositoryPort } from '../port/bank-subscription-repository.port';
import type { UserVault, VaultDepositResult, VaultWithdrawResult, VaultInterestResult } from '../domain/user-vault';
import { calculateInterest } from '../domain/user-vault';
import { getBankBenefits, type BankSubscription } from '../domain/bank-subscription';
import { Result } from '../../shared/types/result';
import { createTransaction } from '../domain/currency-transaction';

/**
 * 구독에서 실제 적용될 금고 한도 계산
 * (커스텀 값이 있으면 사용, 없으면 기본값)
 */
function getEffectiveStorageLimit(subscription: BankSubscription): bigint {
  if (subscription.vaultLimit != null) {
    return subscription.vaultLimit;
  }
  return getBankBenefits(subscription.tier).storageLimit;
}

/**
 * 구독에서 실제 적용될 이자율 계산
 * (커스텀 값이 있으면 사용, 없으면 기본값)
 */
function getEffectiveInterestRate(subscription: BankSubscription): number {
  if (subscription.interestRate != null) {
    return subscription.interestRate;
  }
  return getBankBenefits(subscription.tier).interestRate;
}

export interface VaultSummary {
  vault: UserVault | null;
  storageLimit: bigint;
  interestRate: number;
  tierName: string;
}

export interface MonthlyInterestSummary {
  guildId: string;
  processedAt: Date;
  totalUsers: number;
  totalInterestPaid: bigint;
  results: VaultInterestResult[];
}

export class VaultService {
  constructor(
    private readonly vaultRepo: VaultRepositoryPort,
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort,
    private readonly bankSubscriptionRepo: BankSubscriptionRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  /**
   * 금고 정보 조회 (구독 혜택 포함)
   */
  async getVaultSummary(guildId: string, userId: string): Promise<Result<VaultSummary, CurrencyError>> {
    const now = this.clock.now();

    // 구독 정보 확인
    const subscriptionResult = await this.bankSubscriptionRepo.findActiveByUser(guildId, userId, now);
    if (!subscriptionResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: subscriptionResult.error } };
    }

    const subscription = subscriptionResult.data;

    // 구독이 없으면 기본값 반환
    if (!subscription) {
      return {
        success: true,
        data: {
          vault: null,
          storageLimit: BigInt(0),
          interestRate: 0,
          tierName: '없음',
        },
      };
    }

    // 커스텀 값 또는 기본값 사용
    const storageLimit = getEffectiveStorageLimit(subscription);
    const interestRate = getEffectiveInterestRate(subscription);

    // 금고 조회
    const vaultResult = await this.vaultRepo.findByUser(guildId, userId);
    if (!vaultResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: vaultResult.error } };
    }

    const tierName = subscription.tier === 'gold' ? '골드' : '실버';

    return {
      success: true,
      data: {
        vault: vaultResult.data,
        storageLimit,
        interestRate,
        tierName,
      },
    };
  }

  /**
   * 예금
   */
  async deposit(
    guildId: string,
    userId: string,
    amount: bigint
  ): Promise<Result<VaultDepositResult, CurrencyError>> {
    if (amount <= BigInt(0)) {
      return { success: false, error: { type: 'INVALID_AMOUNT', message: '예금 금액은 0보다 커야 합니다.' } };
    }

    const now = this.clock.now();

    // 구독 확인
    const subscriptionResult = await this.bankSubscriptionRepo.findActiveByUser(guildId, userId, now);
    if (!subscriptionResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: subscriptionResult.error } };
    }

    const subscription = subscriptionResult.data;
    if (!subscription) {
      return { success: false, error: { type: 'NO_SUBSCRIPTION' as const } };
    }

    // 커스텀 값 또는 기본값 사용
    const storageLimit = getEffectiveStorageLimit(subscription);
    if (storageLimit === BigInt(0)) {
      return { success: false, error: { type: 'NO_SUBSCRIPTION' as const } };
    }

    // 현재 금고 확인
    const vaultResult = await this.vaultRepo.findOrCreate({ guildId, userId });
    if (!vaultResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: vaultResult.error } };
    }

    const currentVault = vaultResult.data;
    const newTotal = currentVault.depositedAmount + amount;

    // 한도 확인
    if (newTotal > storageLimit) {
      return {
        success: false,
        error: {
          type: 'VAULT_LIMIT_EXCEEDED' as const,
          limit: storageLimit,
          current: currentVault.depositedAmount,
          requested: amount,
        },
      };
    }

    // 잔액 확인
    const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
    if (!walletResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: walletResult.error } };
    }

    const balance = walletResult.data?.balance ?? BigInt(0);
    if (balance < amount) {
      return {
        success: false,
        error: { type: 'INSUFFICIENT_BALANCE', required: amount, available: balance },
      };
    }

    // 지갑에서 차감
    await this.topyWalletRepo.updateBalance(guildId, userId, amount, 'subtract');
    const newBalance = balance - amount;

    // 금고에 추가
    const updatedVaultResult = await this.vaultRepo.updateDepositedAmount(guildId, userId, amount, 'add');
    if (!updatedVaultResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: updatedVaultResult.error } };
    }

    // 거래 기록
    await this.transactionRepo.save(
      createTransaction(guildId, userId, 'topy', 'vault_deposit', -amount, newBalance)
    );

    return {
      success: true,
      data: {
        vault: updatedVaultResult.data,
        depositedAmount: amount,
        newTotal,
      },
    };
  }

  /**
   * 출금
   */
  async withdraw(
    guildId: string,
    userId: string,
    amount: bigint
  ): Promise<Result<VaultWithdrawResult, CurrencyError>> {
    if (amount <= BigInt(0)) {
      return { success: false, error: { type: 'INVALID_AMOUNT', message: '출금 금액은 0보다 커야 합니다.' } };
    }

    // 금고 확인
    const vaultResult = await this.vaultRepo.findByUser(guildId, userId);
    if (!vaultResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: vaultResult.error } };
    }

    const vault = vaultResult.data;
    if (!vault || vault.depositedAmount < amount) {
      return {
        success: false,
        error: {
          type: 'INSUFFICIENT_VAULT_BALANCE' as const,
          required: amount,
          available: vault?.depositedAmount ?? BigInt(0),
        },
      };
    }

    // 금고에서 차감
    const updatedVaultResult = await this.vaultRepo.updateDepositedAmount(guildId, userId, amount, 'subtract');
    if (!updatedVaultResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: updatedVaultResult.error } };
    }

    // 지갑에 추가
    await this.topyWalletRepo.updateBalance(guildId, userId, amount, 'add');

    // 현재 잔액 조회
    const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
    const newBalance = walletResult.success ? (walletResult.data?.balance ?? BigInt(0)) : BigInt(0);

    // 거래 기록
    await this.transactionRepo.save(
      createTransaction(guildId, userId, 'topy', 'vault_withdraw', amount, newBalance)
    );

    return {
      success: true,
      data: {
        vault: updatedVaultResult.data,
        withdrawnAmount: amount,
        newTotal: vault.depositedAmount - amount,
      },
    };
  }

  /**
   * 월간 이자 지급 처리
   */
  async processMonthlyInterest(guildId: string): Promise<Result<MonthlyInterestSummary, CurrencyError>> {
    const now = this.clock.now();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 모든 금고 조회
    const vaultsResult = await this.vaultRepo.getAllByGuild(guildId);
    if (!vaultsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: vaultsResult.error } };
    }

    const results: VaultInterestResult[] = [];
    let totalInterestPaid = BigInt(0);

    for (const vault of vaultsResult.data) {
      if (vault.depositedAmount <= BigInt(0)) continue;

      // 이번 달에 이미 이자 받았는지 확인
      const alreadyReceivedResult = await this.vaultRepo.hasReceivedInterestThisMonth(
        guildId,
        vault.userId,
        year,
        month
      );
      if (alreadyReceivedResult.success && alreadyReceivedResult.data) {
        continue;
      }

      // 구독 확인
      const subscriptionResult = await this.bankSubscriptionRepo.findActiveByUser(guildId, vault.userId, now);
      if (!subscriptionResult.success || !subscriptionResult.data) {
        continue;
      }

      // 커스텀 값 또는 기본값 사용
      const interestRate = getEffectiveInterestRate(subscriptionResult.data);
      if (interestRate <= 0) continue;

      // 이자 계산
      const interestAmount = calculateInterest(vault.depositedAmount, interestRate);
      if (interestAmount <= BigInt(0)) continue;

      // 이자 지급 (금고에 추가)
      const addResult = await this.vaultRepo.addInterest(guildId, vault.userId, interestAmount);
      if (!addResult.success) continue;

      const newTotal = vault.depositedAmount + interestAmount;

      // 거래 기록
      await this.transactionRepo.save(
        createTransaction(guildId, vault.userId, 'topy', 'vault_interest', interestAmount, newTotal)
      );

      totalInterestPaid += interestAmount;
      results.push({
        userId: vault.userId,
        depositedAmount: vault.depositedAmount,
        interestRate,
        interestAmount,
        newTotal,
      });
    }

    return {
      success: true,
      data: {
        guildId,
        processedAt: now,
        totalUsers: results.length,
        totalInterestPaid,
        results,
      },
    };
  }
}
