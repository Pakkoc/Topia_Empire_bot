import type { ClockPort } from '../../shared/port/clock.port';
import type { BankSubscriptionRepositoryPort } from '../port/bank-subscription-repository.port';
import type { BankSubscription, BankTier, BankBenefits } from '../domain/bank-subscription';
import type { CurrencyError } from '../errors';
import { Result } from '../../shared/types/result';
import {
  getBankBenefitsFromSubscription,
  createBankSubscription,
  SUBSCRIPTION_DURATION_DAYS,
} from '../domain/bank-subscription';

export interface ActivateSubscriptionResult {
  subscription: BankSubscription;
  action: 'created' | 'extended' | 'queued';
  startsAt: Date;
  expiresAt: Date;
}

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
   * 구독 활성화 (상점 구매 시 호출)
   *
   * 규칙:
   * 1. 구독 없음 → 즉시 30일 적용
   * 2. 같은 티어 구독 중 → 만료일 +30일 연장
   * 3. 다른 티어 구독 중 → 현재 만료 후 새 티어 30일 시작
   */
  async activateSubscription(
    guildId: string,
    userId: string,
    tier: BankTier
  ): Promise<Result<ActivateSubscriptionResult, CurrencyError>> {
    const now = this.clock.now();

    // 1. 유저의 모든 구독 조회
    const allSubscriptionsResult = await this.bankSubscriptionRepo.findAllByUser(guildId, userId);

    if (!allSubscriptionsResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: allSubscriptionsResult.error });
    }

    const subscriptions = allSubscriptionsResult.data;

    // 현재 활성 구독 찾기
    const activeSubscription = subscriptions.find(
      (s) => s.startsAt <= now && s.expiresAt > now
    );

    // 미래 예약된 구독 중 같은 티어 찾기
    const sameTierFuture = subscriptions.find(
      (s) => s.tier === tier && s.startsAt > now
    );

    // 2. 같은 티어가 이미 있는 경우 (활성 또는 예약)
    if (activeSubscription?.tier === tier) {
      // 활성 구독 연장
      const newExpiresAt = new Date(
        activeSubscription.expiresAt.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000
      );

      const extendResult = await this.bankSubscriptionRepo.extendExpiration(
        activeSubscription.id,
        newExpiresAt
      );

      if (!extendResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: extendResult.error });
      }

      return Result.ok({
        subscription: { ...activeSubscription, expiresAt: newExpiresAt },
        action: 'extended',
        startsAt: activeSubscription.startsAt,
        expiresAt: newExpiresAt,
      });
    }

    if (sameTierFuture) {
      // 예약된 같은 티어 구독 연장
      const newExpiresAt = new Date(
        sameTierFuture.expiresAt.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000
      );

      const extendResult = await this.bankSubscriptionRepo.extendExpiration(
        sameTierFuture.id,
        newExpiresAt
      );

      if (!extendResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: extendResult.error });
      }

      return Result.ok({
        subscription: { ...sameTierFuture, expiresAt: newExpiresAt },
        action: 'extended',
        startsAt: sameTierFuture.startsAt,
        expiresAt: newExpiresAt,
      });
    }

    // 3. 다른 티어가 활성화 중인 경우 → 현재 만료 후 시작
    if (activeSubscription && activeSubscription.tier !== tier) {
      // 현재 활성 구독 만료 후 시작
      const startsAt = activeSubscription.expiresAt;
      const newSubscription = createBankSubscription(guildId, userId, tier, startsAt);

      const saveResult = await this.bankSubscriptionRepo.save(newSubscription);

      if (!saveResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: saveResult.error });
      }

      return Result.ok({
        subscription: saveResult.data,
        action: 'queued',
        startsAt: saveResult.data.startsAt,
        expiresAt: saveResult.data.expiresAt,
      });
    }

    // 4. 구독이 없는 경우 → 즉시 시작
    const newSubscription = createBankSubscription(guildId, userId, tier, now);

    const saveResult = await this.bankSubscriptionRepo.save(newSubscription);

    if (!saveResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: saveResult.error });
    }

    return Result.ok({
      subscription: saveResult.data,
      action: 'created',
      startsAt: saveResult.data.startsAt,
      expiresAt: saveResult.data.expiresAt,
    });
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
