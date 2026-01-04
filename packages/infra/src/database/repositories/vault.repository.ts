import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  VaultRepositoryPort,
  UserVault,
  CreateVaultInput,
  RepositoryError,
} from '@topia/core';
import type { Result } from '@topia/core';

interface VaultRow extends RowDataPacket {
  id: bigint;
  guild_id: string;
  user_id: string;
  deposited_amount: bigint;
  last_interest_at: Date;
  created_at: Date;
  updated_at: Date;
}

function rowToEntity(row: VaultRow): UserVault {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    depositedAmount: row.deposited_amount,
    lastInterestAt: row.last_interest_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRepositoryError(error: unknown): RepositoryError {
  const message = error instanceof Error ? error.message : String(error);
  return { type: 'QUERY_ERROR', message };
}

export class VaultRepository implements VaultRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async findByUser(
    guildId: string,
    userId: string
  ): Promise<Result<UserVault | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.query<VaultRow[]>(
        `SELECT * FROM user_vaults WHERE guild_id = ? AND user_id = ?`,
        [guildId, userId]
      );

      if (rows.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: rowToEntity(rows[0]!) };
    } catch (error) {
      return { success: false, error: toRepositoryError(error) };
    }
  }

  async findOrCreate(input: CreateVaultInput): Promise<Result<UserVault, RepositoryError>> {
    try {
      // 먼저 기존 금고 확인
      const [existingRows] = await this.pool.query<VaultRow[]>(
        `SELECT * FROM user_vaults WHERE guild_id = ? AND user_id = ?`,
        [input.guildId, input.userId]
      );

      if (existingRows.length > 0) {
        return { success: true, data: rowToEntity(existingRows[0]!) };
      }

      // 없으면 생성
      const [result] = await this.pool.query<ResultSetHeader>(
        `INSERT INTO user_vaults (guild_id, user_id, deposited_amount, last_interest_at)
         VALUES (?, ?, 0, NOW())`,
        [input.guildId, input.userId]
      );

      const [rows] = await this.pool.query<VaultRow[]>(
        `SELECT * FROM user_vaults WHERE id = ?`,
        [result.insertId]
      );

      return { success: true, data: rowToEntity(rows[0]!) };
    } catch (error) {
      return { success: false, error: toRepositoryError(error) };
    }
  }

  async updateDepositedAmount(
    guildId: string,
    userId: string,
    amount: bigint,
    operation: 'add' | 'subtract'
  ): Promise<Result<UserVault, RepositoryError>> {
    try {
      const op = operation === 'add' ? '+' : '-';
      await this.pool.query<ResultSetHeader>(
        `UPDATE user_vaults
         SET deposited_amount = deposited_amount ${op} ?
         WHERE guild_id = ? AND user_id = ?`,
        [amount, guildId, userId]
      );

      const [rows] = await this.pool.query<VaultRow[]>(
        `SELECT * FROM user_vaults WHERE guild_id = ? AND user_id = ?`,
        [guildId, userId]
      );

      return { success: true, data: rowToEntity(rows[0]!) };
    } catch (error) {
      return { success: false, error: toRepositoryError(error) };
    }
  }

  async addInterest(
    guildId: string,
    userId: string,
    interestAmount: bigint
  ): Promise<Result<UserVault, RepositoryError>> {
    try {
      await this.pool.query<ResultSetHeader>(
        `UPDATE user_vaults
         SET deposited_amount = deposited_amount + ?, last_interest_at = NOW()
         WHERE guild_id = ? AND user_id = ?`,
        [interestAmount, guildId, userId]
      );

      const [rows] = await this.pool.query<VaultRow[]>(
        `SELECT * FROM user_vaults WHERE guild_id = ? AND user_id = ?`,
        [guildId, userId]
      );

      return { success: true, data: rowToEntity(rows[0]!) };
    } catch (error) {
      return { success: false, error: toRepositoryError(error) };
    }
  }

  async getAllByGuild(guildId: string): Promise<Result<UserVault[], RepositoryError>> {
    try {
      const [rows] = await this.pool.query<VaultRow[]>(
        `SELECT * FROM user_vaults WHERE guild_id = ? AND deposited_amount > 0`,
        [guildId]
      );

      return { success: true, data: rows.map(rowToEntity) };
    } catch (error) {
      return { success: false, error: toRepositoryError(error) };
    }
  }

  async hasReceivedInterestThisMonth(
    guildId: string,
    userId: string,
    year: number,
    month: number
  ): Promise<Result<boolean, RepositoryError>> {
    try {
      const [rows] = await this.pool.query<VaultRow[]>(
        `SELECT * FROM user_vaults
         WHERE guild_id = ? AND user_id = ?
           AND YEAR(last_interest_at) = ? AND MONTH(last_interest_at) = ?`,
        [guildId, userId, year, month]
      );

      return { success: true, data: rows.length > 0 };
    } catch (error) {
      return { success: false, error: toRepositoryError(error) };
    }
  }
}
