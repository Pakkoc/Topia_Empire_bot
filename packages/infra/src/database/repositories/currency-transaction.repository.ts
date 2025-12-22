import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  CurrencyTransactionRepositoryPort,
  CurrencyTransaction,
  CurrencyType,
  TransactionType,
  RepositoryError,
} from '@topia/core';
import { Result } from '@topia/core';

interface TransactionRow extends RowDataPacket {
  id: string;
  guild_id: string;
  user_id: string;
  currency_type: CurrencyType;
  transaction_type: TransactionType;
  amount: string;
  balance_after: string;
  fee: string;
  related_user_id: string | null;
  description: string | null;
  created_at: Date;
}

function toTransaction(row: TransactionRow): CurrencyTransaction {
  return {
    id: BigInt(row.id),
    guildId: row.guild_id,
    userId: row.user_id,
    currencyType: row.currency_type,
    transactionType: row.transaction_type,
    amount: BigInt(row.amount),
    balanceAfter: BigInt(row.balance_after),
    fee: BigInt(row.fee),
    relatedUserId: row.related_user_id,
    description: row.description,
    createdAt: row.created_at,
  };
}

export class CurrencyTransactionRepository implements CurrencyTransactionRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async save(
    transaction: Omit<CurrencyTransaction, 'id' | 'createdAt'>
  ): Promise<Result<CurrencyTransaction, RepositoryError>> {
    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `INSERT INTO currency_transactions
         (guild_id, user_id, currency_type, transaction_type, amount, balance_after, fee, related_user_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.guildId,
          transaction.userId,
          transaction.currencyType,
          transaction.transactionType,
          transaction.amount.toString(),
          transaction.balanceAfter.toString(),
          transaction.fee.toString(),
          transaction.relatedUserId,
          transaction.description,
        ]
      );

      const [rows] = await this.pool.execute<TransactionRow[]>(
        'SELECT * FROM currency_transactions WHERE id = ?',
        [result.insertId]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.err({ type: 'NOT_FOUND', message: 'Transaction not found after insert' });
      }

      return Result.ok(toTransaction(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findByUser(
    guildId: string,
    userId: string,
    options?: {
      currencyType?: CurrencyType;
      transactionType?: TransactionType;
      limit?: number;
      offset?: number;
    }
  ): Promise<Result<CurrencyTransaction[], RepositoryError>> {
    try {
      let query = 'SELECT * FROM currency_transactions WHERE guild_id = ? AND user_id = ?';
      const params: unknown[] = [guildId, userId];

      if (options?.currencyType) {
        query += ' AND currency_type = ?';
        params.push(options.currencyType);
      }

      if (options?.transactionType) {
        query += ' AND transaction_type = ?';
        params.push(options.transactionType);
      }

      query += ' ORDER BY created_at DESC';

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }

      if (options?.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }

      const [rows] = await this.pool.execute<TransactionRow[]>(query, params);

      return Result.ok(rows.map(toTransaction));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findByGuild(
    guildId: string,
    options?: {
      currencyType?: CurrencyType;
      transactionType?: TransactionType;
      limit?: number;
      offset?: number;
    }
  ): Promise<Result<CurrencyTransaction[], RepositoryError>> {
    try {
      let query = 'SELECT * FROM currency_transactions WHERE guild_id = ?';
      const params: unknown[] = [guildId];

      if (options?.currencyType) {
        query += ' AND currency_type = ?';
        params.push(options.currencyType);
      }

      if (options?.transactionType) {
        query += ' AND transaction_type = ?';
        params.push(options.transactionType);
      }

      query += ' ORDER BY created_at DESC';

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }

      if (options?.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }

      const [rows] = await this.pool.execute<TransactionRow[]>(query, params);

      return Result.ok(rows.map(toTransaction));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
