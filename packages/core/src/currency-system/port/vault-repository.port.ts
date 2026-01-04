import type { Result } from '../../shared/types/result';
import type { UserVault, CreateVaultInput } from '../domain/user-vault';
import type { RepositoryError } from '../errors';

export interface VaultRepositoryPort {
  /**
   * 유저의 금고 조회
   */
  findByUser(guildId: string, userId: string): Promise<Result<UserVault | null, RepositoryError>>;

  /**
   * 금고 생성 또는 조회
   */
  findOrCreate(input: CreateVaultInput): Promise<Result<UserVault, RepositoryError>>;

  /**
   * 예금 금액 업데이트
   */
  updateDepositedAmount(
    guildId: string,
    userId: string,
    amount: bigint,
    operation: 'add' | 'subtract'
  ): Promise<Result<UserVault, RepositoryError>>;

  /**
   * 이자 지급 시 금액 및 lastInterestAt 업데이트
   */
  addInterest(
    guildId: string,
    userId: string,
    interestAmount: bigint
  ): Promise<Result<UserVault, RepositoryError>>;

  /**
   * 길드 내 모든 금고 조회 (이자 지급용)
   */
  getAllByGuild(guildId: string): Promise<Result<UserVault[], RepositoryError>>;

  /**
   * 특정 월에 이자가 지급되었는지 확인
   */
  hasReceivedInterestThisMonth(
    guildId: string,
    userId: string,
    year: number,
    month: number
  ): Promise<Result<boolean, RepositoryError>>;
}
