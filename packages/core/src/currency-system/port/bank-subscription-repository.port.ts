import type { Result } from '../../shared/types/result';
import type { BankSubscription } from '../domain/bank-subscription';
import type { RepositoryError } from '../errors';

/**
 * 금고 구독 레포지토리 포트
 */
export interface BankSubscriptionRepositoryPort {
  /**
   * 유저의 현재 활성 구독 조회
   * (현재 시점에 활성화된 구독)
   */
  findActiveByUser(
    guildId: string,
    userId: string,
    now: Date
  ): Promise<Result<BankSubscription | null, RepositoryError>>;

  /**
   * 유저의 특정 상점 아이템 구독 조회
   * (활성 또는 미래 예약된 구독)
   */
  findByUserAndShopItem(
    guildId: string,
    userId: string,
    shopItemId: number
  ): Promise<Result<BankSubscription | null, RepositoryError>>;

  /**
   * 유저의 모든 구독 조회 (활성 + 예약)
   */
  findAllByUser(
    guildId: string,
    userId: string
  ): Promise<Result<BankSubscription[], RepositoryError>>;

  /**
   * 구독 저장 (생성)
   */
  save(
    subscription: Omit<BankSubscription, 'id' | 'createdAt'>
  ): Promise<Result<BankSubscription, RepositoryError>>;

  /**
   * 구독 연장 (만료일 업데이트)
   */
  extendExpiration(
    id: bigint,
    newExpiresAt: Date
  ): Promise<Result<void, RepositoryError>>;

  /**
   * 기존 구독 종료 (만료일을 현재로 설정)
   */
  terminateSubscription(
    id: bigint,
    terminateAt: Date
  ): Promise<Result<void, RepositoryError>>;

  /**
   * 만료된 구독 정리 (선택적)
   */
  deleteExpired(before: Date): Promise<Result<number, RepositoryError>>;
}
