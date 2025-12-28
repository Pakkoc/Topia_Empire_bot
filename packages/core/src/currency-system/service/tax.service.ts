import type { ClockPort } from '../../shared/port/clock.port';
import type { CurrencyError } from '../errors';
import type { CurrencySettingsRepositoryPort } from '../port/currency-settings-repository.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type { TaxHistoryRepositoryPort, CreateTaxHistoryInput } from '../port/tax-history-repository.port';
import { Result } from '../../shared/types/result';
import { createTransaction } from '../domain/currency-transaction';

export interface TaxResult {
  userId: string;
  balanceBefore: bigint;
  taxAmount: bigint;
  balanceAfter: bigint;
  exempted: boolean;
  exemptionReason?: string;
}

export interface MonthlyTaxSummary {
  guildId: string;
  processedAt: Date;
  totalUsers: number;
  taxedUsers: number;
  exemptedUsers: number;
  totalTaxAmount: bigint;
  results: TaxResult[];
}

/**
 * 월말 세금 계산 함수
 */
export function calculateMonthlyTax(balance: bigint, taxPercent: number): bigint {
  if (balance <= BigInt(0) || taxPercent <= 0) {
    return BigInt(0);
  }
  // taxPercent를 1000분율로 변환 (3.3% = 33/1000)
  const rate = Math.round(taxPercent * 10);
  return (balance * BigInt(rate)) / BigInt(1000);
}

export class TaxService {
  constructor(
    private readonly settingsRepo: CurrencySettingsRepositoryPort,
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort,
    private readonly taxHistoryRepo: TaxHistoryRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  /**
   * 월말 세금 미리보기 (실제 차감 없음)
   */
  async previewMonthlyTax(guildId: string): Promise<Result<TaxResult[], CurrencyError>> {
    // 설정 조회
    const settingsResult = await this.settingsRepo.findByGuild(guildId);
    if (!settingsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: settingsResult.error } };
    }
    const settings = settingsResult.data;
    if (!settings?.monthlyTaxEnabled) {
      return { success: true, data: [] };
    }

    // 모든 지갑 조회
    const walletsResult = await this.topyWalletRepo.getAllByGuild(guildId);
    if (!walletsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: walletsResult.error } };
    }

    const results: TaxResult[] = [];
    for (const wallet of walletsResult.data) {
      if (wallet.balance <= BigInt(0)) continue;

      const taxAmount = calculateMonthlyTax(wallet.balance, settings.monthlyTaxPercent);

      // TODO: 세금 면제권 확인 로직 추가 예정
      const exempted = false;
      const exemptionReason = undefined;

      results.push({
        userId: wallet.userId,
        balanceBefore: wallet.balance,
        taxAmount: exempted ? BigInt(0) : taxAmount,
        balanceAfter: exempted ? wallet.balance : wallet.balance - taxAmount,
        exempted,
        exemptionReason,
      });
    }

    return { success: true, data: results };
  }

  /**
   * 월말 세금 처리 (실제 차감)
   */
  async processMonthlyTax(guildId: string): Promise<Result<MonthlyTaxSummary, CurrencyError>> {
    const now = this.clock.now();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 이미 이번 달에 처리되었는지 확인
    const alreadyProcessedResult = await this.taxHistoryRepo.hasProcessedForMonth(guildId, year, month);
    if (!alreadyProcessedResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: alreadyProcessedResult.error } };
    }
    if (alreadyProcessedResult.data) {
      return { success: false, error: { type: 'ALREADY_PROCESSED' as const } };
    }

    // 설정 조회
    const settingsResult = await this.settingsRepo.findByGuild(guildId);
    if (!settingsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: settingsResult.error } };
    }
    const settings = settingsResult.data;
    if (!settings?.monthlyTaxEnabled) {
      return {
        success: true,
        data: {
          guildId,
          processedAt: now,
          totalUsers: 0,
          taxedUsers: 0,
          exemptedUsers: 0,
          totalTaxAmount: BigInt(0),
          results: [],
        },
      };
    }

    // 모든 지갑 조회
    const walletsResult = await this.topyWalletRepo.getAllByGuild(guildId);
    if (!walletsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: walletsResult.error } };
    }

    const results: TaxResult[] = [];
    let totalTaxAmount = BigInt(0);
    let taxedUsers = 0;
    let exemptedUsers = 0;

    for (const wallet of walletsResult.data) {
      if (wallet.balance <= BigInt(0)) continue;

      const taxAmount = calculateMonthlyTax(wallet.balance, settings.monthlyTaxPercent);

      // TODO: 세금 면제권 확인 로직 추가 예정
      const exempted = false;
      const exemptionReason: string | undefined = undefined;

      const balanceAfter = exempted ? wallet.balance : wallet.balance - taxAmount;
      const actualTaxAmount = exempted ? BigInt(0) : taxAmount;

      // 세금 차감
      if (!exempted && taxAmount > BigInt(0)) {
        await this.topyWalletRepo.updateBalance(guildId, wallet.userId, taxAmount, 'subtract');

        // 거래 기록 저장
        await this.transactionRepo.save(
          createTransaction(guildId, wallet.userId, 'topy', 'tax', -taxAmount, balanceAfter)
        );

        taxedUsers++;
        totalTaxAmount += taxAmount;
      } else if (exempted) {
        exemptedUsers++;
      }

      // 세금 이력 저장
      const historyInput: CreateTaxHistoryInput = {
        guildId,
        userId: wallet.userId,
        taxType: 'monthly',
        taxPercent: settings.monthlyTaxPercent,
        amount: actualTaxAmount,
        balanceBefore: wallet.balance,
        balanceAfter,
        exempted,
        exemptionReason: exemptionReason ?? null,
        processedAt: now,
      };
      await this.taxHistoryRepo.save(historyInput);

      results.push({
        userId: wallet.userId,
        balanceBefore: wallet.balance,
        taxAmount: actualTaxAmount,
        balanceAfter,
        exempted,
        exemptionReason,
      });
    }

    return {
      success: true,
      data: {
        guildId,
        processedAt: now,
        totalUsers: walletsResult.data.length,
        taxedUsers,
        exemptedUsers,
        totalTaxAmount,
        results,
      },
    };
  }

  /**
   * 특정 유저의 세금 이력 조회
   */
  async getUserTaxHistory(guildId: string, userId: string, limit: number = 12): Promise<Result<TaxResult[], CurrencyError>> {
    const result = await this.taxHistoryRepo.findByUser(guildId, userId, limit);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }

    return {
      success: true,
      data: result.data.map(h => ({
        userId: h.userId,
        balanceBefore: h.balanceBefore,
        taxAmount: h.amount,
        balanceAfter: h.balanceAfter,
        exempted: h.exempted,
        exemptionReason: h.exemptionReason ?? undefined,
      })),
    };
  }
}
