import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  TaxHistoryRepositoryPort,
  TaxHistory,
  TaxType,
  CreateTaxHistoryInput,
  RepositoryError,
} from '@topia/core';
import { Result } from '@topia/core';

interface TaxHistoryRow extends RowDataPacket {
  id: string; // BIGINT as string
  guild_id: string;
  user_id: string;
  tax_type: TaxType;
  tax_percent: string;
  amount: string;
  balance_before: string;
  balance_after: string;
  exempted: number;
  exemption_reason: string | null;
  processed_at: Date;
  created_at: Date;
}

function toTaxHistory(row: TaxHistoryRow): TaxHistory {
  return {
    id: BigInt(row.id),
    guildId: row.guild_id,
    userId: row.user_id,
    taxType: row.tax_type,
    taxPercent: parseFloat(row.tax_percent),
    amount: BigInt(row.amount),
    balanceBefore: BigInt(row.balance_before),
    balanceAfter: BigInt(row.balance_after),
    exempted: row.exempted === 1,
    exemptionReason: row.exemption_reason,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}

export class TaxHistoryRepository implements TaxHistoryRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async save(input: CreateTaxHistoryInput): Promise<Result<TaxHistory, RepositoryError>> {
    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `INSERT INTO tax_history
         (guild_id, user_id, tax_type, tax_percent, amount, balance_before, balance_after, exempted, exemption_reason, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.guildId,
          input.userId,
          input.taxType,
          input.taxPercent,
          input.amount.toString(),
          input.balanceBefore.toString(),
          input.balanceAfter.toString(),
          input.exempted ? 1 : 0,
          input.exemptionReason ?? null,
          input.processedAt,
        ]
      );

      const [rows] = await this.pool.execute<TaxHistoryRow[]>(
        'SELECT * FROM tax_history WHERE id = ?',
        [result.insertId]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.err({
          type: 'QUERY_ERROR',
          message: 'Failed to retrieve saved tax history',
        });
      }

      return Result.ok(toTaxHistory(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findByUser(guildId: string, userId: string, limit: number = 12): Promise<Result<TaxHistory[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<TaxHistoryRow[]>(
        `SELECT * FROM tax_history
         WHERE guild_id = ? AND user_id = ?
         ORDER BY processed_at DESC
         LIMIT ?`,
        [guildId, userId, limit]
      );

      return Result.ok(rows.map(toTaxHistory));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findByMonth(guildId: string, year: number, month: number): Promise<Result<TaxHistory[], RepositoryError>> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const [rows] = await this.pool.execute<TaxHistoryRow[]>(
        `SELECT * FROM tax_history
         WHERE guild_id = ? AND processed_at BETWEEN ? AND ?
         ORDER BY processed_at DESC`,
        [guildId, startDate, endDate]
      );

      return Result.ok(rows.map(toTaxHistory));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async hasProcessedForMonth(guildId: string, year: number, month: number): Promise<Result<boolean, RepositoryError>> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const [rows] = await this.pool.execute<(RowDataPacket & { count: number })[]>(
        `SELECT COUNT(*) as count FROM tax_history
         WHERE guild_id = ? AND tax_type = 'monthly' AND processed_at BETWEEN ? AND ?`,
        [guildId, startDate, endDate]
      );

      return Result.ok((rows[0]?.count ?? 0) > 0);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
