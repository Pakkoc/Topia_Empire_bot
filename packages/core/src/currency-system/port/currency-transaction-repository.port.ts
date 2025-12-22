import type { Result } from '../../shared/types/result';
import type { CurrencyTransaction, CurrencyType, TransactionType } from '../domain/currency-transaction';
import type { RepositoryError } from '../errors';

export interface CurrencyTransactionRepositoryPort {
  save(transaction: Omit<CurrencyTransaction, 'id' | 'createdAt'>): Promise<Result<CurrencyTransaction, RepositoryError>>;

  findByUser(
    guildId: string,
    userId: string,
    options?: {
      currencyType?: CurrencyType;
      transactionType?: TransactionType;
      limit?: number;
      offset?: number;
    }
  ): Promise<Result<CurrencyTransaction[], RepositoryError>>;

  findByGuild(
    guildId: string,
    options?: {
      currencyType?: CurrencyType;
      transactionType?: TransactionType;
      limit?: number;
      offset?: number;
    }
  ): Promise<Result<CurrencyTransaction[], RepositoryError>>;
}
