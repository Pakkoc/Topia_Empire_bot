import type { Result } from '../../shared/types/result';
import type { RepositoryError } from '../errors';

export type TaxType = 'monthly';

export interface TaxHistory {
  id: bigint;
  guildId: string;
  userId: string;
  taxType: TaxType;
  taxPercent: number;
  amount: bigint;
  balanceBefore: bigint;
  balanceAfter: bigint;
  exempted: boolean;
  exemptionReason: string | null;
  processedAt: Date;
  createdAt: Date;
}

export interface CreateTaxHistoryInput {
  guildId: string;
  userId: string;
  taxType: TaxType;
  taxPercent: number;
  amount: bigint;
  balanceBefore: bigint;
  balanceAfter: bigint;
  exempted: boolean;
  exemptionReason?: string | null;
  processedAt: Date;
}

export interface TaxHistoryRepositoryPort {
  /**
   * 세금 이력 저장
   */
  save(input: CreateTaxHistoryInput): Promise<Result<TaxHistory, RepositoryError>>;

  /**
   * 특정 유저의 세금 이력 조회
   */
  findByUser(guildId: string, userId: string, limit?: number): Promise<Result<TaxHistory[], RepositoryError>>;

  /**
   * 특정 월의 세금 처리 내역 조회
   */
  findByMonth(guildId: string, year: number, month: number): Promise<Result<TaxHistory[], RepositoryError>>;

  /**
   * 특정 월에 이미 세금이 처리되었는지 확인
   */
  hasProcessedForMonth(guildId: string, year: number, month: number): Promise<Result<boolean, RepositoryError>>;
}
