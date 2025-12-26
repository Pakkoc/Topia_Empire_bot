import type { Result } from '../../shared/types/result';
import type { CurrencyManager, CreateCurrencyManagerInput } from '../domain/currency-manager';
import type { RepositoryError } from '../errors';

export interface CurrencyManagerRepositoryPort {
  /**
   * 길드의 화폐 관리자 목록 조회
   */
  findByGuild(guildId: string): Promise<Result<CurrencyManager[], RepositoryError>>;

  /**
   * 특정 유저가 화폐 관리자인지 확인
   */
  isManager(guildId: string, userId: string): Promise<Result<boolean, RepositoryError>>;

  /**
   * 화폐 관리자 추가
   */
  add(input: CreateCurrencyManagerInput): Promise<Result<CurrencyManager, RepositoryError>>;

  /**
   * 화폐 관리자 제거
   */
  remove(guildId: string, userId: string): Promise<Result<void, RepositoryError>>;
}
