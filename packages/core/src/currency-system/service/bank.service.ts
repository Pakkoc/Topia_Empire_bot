import type { ClockPort } from '../../shared/port/clock.port';
import type { BankSubscriptionRepositoryPort } from '../port/bank-subscription-repository.port';
import type { BankSubscription, BankBenefits } from '../domain/bank-subscription';
import type { CurrencyError } from '../errors';
import { Result } from '../../shared/types/result';
import { getBankBenefitsFromSubscription } from '../domain/bank-subscription';

export class BankService {
  constructor(
    private readonly bankSubscriptionRepo: BankSubscriptionRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  /**
   * 유저의 현재 활성 구독 조회
   */
  async getActiveSubscription(
    guildId: string,
    userId: string
  ): Promise<Result<BankSubscription | null, CurrencyError>> {
    const now = this.clock.now();
    const result = await this.bankSubscriptionRepo.findActiveByUser(guildId, userId, now);

    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }

    return Result.ok(result.data);
  }

  /**
   * 유저의 현재 뱅크 혜택 조회
   */
  async getUserBenefits(
    guildId: string,
    userId: string
  ): Promise<Result<BankBenefits, CurrencyError>> {
    const subscriptionResult = await this.getActiveSubscription(guildId, userId);

    if (!subscriptionResult.success) {
      return Result.err(subscriptionResult.error);
    }

    return Result.ok(getBankBenefitsFromSubscription(subscriptionResult.data));
  }

  /**
   * 유저의 모든 구독 조회 (활성 + 예약)
   */
  async getAllSubscriptions(
    guildId: string,
    userId: string
  ): Promise<Result<BankSubscription[], CurrencyError>> {
    const result = await this.bankSubscriptionRepo.findAllByUser(guildId, userId);

    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }

    return Result.ok(result.data);
  }

  /**
   * 이체 수수료 면제 여부 확인
   */
  async isTransferFeeExempt(
    guildId: string,
    userId: string
  ): Promise<boolean> {
    const benefitsResult = await this.getUserBenefits(guildId, userId);

    if (!benefitsResult.success) {
      return false;
    }

    return benefitsResult.data.transferFeeExempt;
  }
}
