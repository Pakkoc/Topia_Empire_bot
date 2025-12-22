import type { Result } from '../../shared/types/result';
import type { RubyWallet } from '../domain/ruby-wallet';
import type { RepositoryError } from '../errors';

export interface RubyWalletRepositoryPort {
  findByUser(guildId: string, userId: string): Promise<Result<RubyWallet | null, RepositoryError>>;
  save(wallet: RubyWallet): Promise<Result<void, RepositoryError>>;
  getLeaderboard(guildId: string, limit: number, offset: number): Promise<Result<RubyWallet[], RepositoryError>>;

  /**
   * 잔액 업데이트 (원자적 연산)
   */
  updateBalance(
    guildId: string,
    userId: string,
    amount: bigint,
    operation: 'add' | 'subtract'
  ): Promise<Result<RubyWallet, RepositoryError>>;
}
