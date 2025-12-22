import type { Result } from '../../shared/types/result';
import type { TopyWallet } from '../domain/topy-wallet';
import type { RepositoryError } from '../errors';

export interface TopyWalletRepositoryPort {
  findByUser(guildId: string, userId: string): Promise<Result<TopyWallet | null, RepositoryError>>;
  save(wallet: TopyWallet): Promise<Result<void, RepositoryError>>;
  getLeaderboard(guildId: string, limit: number, offset: number): Promise<Result<TopyWallet[], RepositoryError>>;
  getAllByGuild(guildId: string): Promise<Result<TopyWallet[], RepositoryError>>;

  /**
   * 잔액 업데이트 (원자적 연산)
   */
  updateBalance(
    guildId: string,
    userId: string,
    amount: bigint,
    operation: 'add' | 'subtract'
  ): Promise<Result<TopyWallet, RepositoryError>>;
}
