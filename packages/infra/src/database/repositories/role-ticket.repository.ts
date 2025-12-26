import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  RoleTicketRepositoryPort,
  RoleTicket,
  CreateRoleTicketInput,
  UpdateRoleTicketInput,
  TicketRoleOption,
  CreateTicketRoleOptionInput,
  UpdateTicketRoleOptionInput,
  RepositoryError,
} from '@topia/core';
import { Result } from '@topia/core';

// ========== Row Interfaces ==========

interface RoleTicketRow extends RowDataPacket {
  id: number;
  guild_id: string;
  name: string;
  description: string | null;
  shop_item_id: number;
  consume_quantity: number;
  remove_previous_role: number;
  effect_duration_seconds: string | null; // BIGINT as string
  enabled: number;
  created_at: Date;
}

interface TicketRoleOptionRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  role_id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: Date;
}

// ========== Mappers ==========

function toRoleTicket(row: RoleTicketRow, roleOptions?: TicketRoleOption[]): RoleTicket {
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    description: row.description,
    shopItemId: row.shop_item_id,
    consumeQuantity: row.consume_quantity,
    removePreviousRole: row.remove_previous_role === 1,
    effectDurationSeconds: row.effect_duration_seconds
      ? Number(row.effect_duration_seconds)
      : null,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    roleOptions,
  };
}

function toTicketRoleOption(row: TicketRoleOptionRow): TicketRoleOption {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    roleId: row.role_id,
    name: row.name,
    description: row.description,
    displayOrder: row.display_order,
    createdAt: row.created_at,
  };
}

// ========== Repository ==========

export class RoleTicketRepository implements RoleTicketRepositoryPort {
  constructor(private readonly pool: Pool) {}

  // ========== 선택권 CRUD ==========

  async findAllByGuild(guildId: string): Promise<Result<RoleTicket[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<RoleTicketRow[]>(
        'SELECT * FROM role_tickets WHERE guild_id = ? ORDER BY id ASC',
        [guildId]
      );
      return Result.ok(rows.map((row) => toRoleTicket(row)));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findEnabledByGuild(guildId: string): Promise<Result<RoleTicket[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<RoleTicketRow[]>(
        'SELECT * FROM role_tickets WHERE guild_id = ? AND enabled = 1 ORDER BY id ASC',
        [guildId]
      );
      return Result.ok(rows.map((row) => toRoleTicket(row)));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findById(id: number): Promise<Result<RoleTicket | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<RoleTicketRow[]>(
        'SELECT * FROM role_tickets WHERE id = ?',
        [id]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toRoleTicket(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findByShopItemId(shopItemId: number): Promise<Result<RoleTicket | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<RoleTicketRow[]>(
        'SELECT * FROM role_tickets WHERE shop_item_id = ?',
        [shopItemId]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toRoleTicket(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findWithOptions(id: number): Promise<Result<RoleTicket | null, RepositoryError>> {
    try {
      const [ticketRows] = await this.pool.execute<RoleTicketRow[]>(
        'SELECT * FROM role_tickets WHERE id = ?',
        [id]
      );

      const ticketRow = ticketRows[0];
      if (!ticketRow) {
        return Result.ok(null);
      }

      const [optionRows] = await this.pool.execute<TicketRoleOptionRow[]>(
        'SELECT * FROM ticket_role_options WHERE ticket_id = ? ORDER BY display_order ASC',
        [id]
      );

      const roleOptions = optionRows.map(toTicketRoleOption);
      return Result.ok(toRoleTicket(ticketRow, roleOptions));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async create(input: CreateRoleTicketInput): Promise<Result<RoleTicket, RepositoryError>> {
    try {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `INSERT INTO role_tickets
         (guild_id, name, description, shop_item_id, consume_quantity, remove_previous_role, effect_duration_seconds, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.guildId,
          input.name,
          input.description ?? null,
          input.shopItemId,
          input.consumeQuantity ?? 1,
          input.removePreviousRole !== false ? 1 : 0,
          input.effectDurationSeconds ?? null,
          input.enabled !== false ? 1 : 0,
        ]
      );

      const ticketResult = await this.findById(result.insertId);
      if (!ticketResult.success || !ticketResult.data) {
        return Result.err({
          type: 'QUERY_ERROR',
          message: 'Failed to retrieve created ticket',
        });
      }

      return Result.ok(ticketResult.data);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async update(id: number, input: UpdateRoleTicketInput): Promise<Result<void, RepositoryError>> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (input.name !== undefined) {
        fields.push('name = ?');
        values.push(input.name);
      }
      if (input.description !== undefined) {
        fields.push('description = ?');
        values.push(input.description);
      }
      if (input.consumeQuantity !== undefined) {
        fields.push('consume_quantity = ?');
        values.push(input.consumeQuantity);
      }
      if (input.removePreviousRole !== undefined) {
        fields.push('remove_previous_role = ?');
        values.push(input.removePreviousRole ? 1 : 0);
      }
      if (input.effectDurationSeconds !== undefined) {
        fields.push('effect_duration_seconds = ?');
        values.push(input.effectDurationSeconds);
      }
      if (input.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(input.enabled ? 1 : 0);
      }

      if (fields.length === 0) {
        return Result.ok(undefined);
      }

      values.push(id);
      await this.pool.execute(
        `UPDATE role_tickets SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async delete(id: number): Promise<Result<void, RepositoryError>> {
    try {
      // 역할 옵션 먼저 삭제
      await this.pool.execute('DELETE FROM ticket_role_options WHERE ticket_id = ?', [id]);
      // 선택권 삭제
      await this.pool.execute('DELETE FROM role_tickets WHERE id = ?', [id]);
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ========== 역할 옵션 CRUD ==========

  async findRoleOptions(ticketId: number): Promise<Result<TicketRoleOption[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<TicketRoleOptionRow[]>(
        'SELECT * FROM ticket_role_options WHERE ticket_id = ? ORDER BY display_order ASC',
        [ticketId]
      );
      return Result.ok(rows.map(toTicketRoleOption));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async findRoleOptionById(id: number): Promise<Result<TicketRoleOption | null, RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<TicketRoleOptionRow[]>(
        'SELECT * FROM ticket_role_options WHERE id = ?',
        [id]
      );

      const firstRow = rows[0];
      if (!firstRow) {
        return Result.ok(null);
      }

      return Result.ok(toTicketRoleOption(firstRow));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createRoleOption(
    input: CreateTicketRoleOptionInput
  ): Promise<Result<TicketRoleOption, RepositoryError>> {
    try {
      // 현재 최대 display_order 조회
      const [maxOrderRows] = await this.pool.execute<(RowDataPacket & { max_order: number | null })[]>(
        'SELECT MAX(display_order) as max_order FROM ticket_role_options WHERE ticket_id = ?',
        [input.ticketId]
      );
      const maxOrder = maxOrderRows[0]?.max_order ?? -1;
      const displayOrder = input.displayOrder ?? maxOrder + 1;

      const [result] = await this.pool.execute<ResultSetHeader>(
        `INSERT INTO ticket_role_options
         (ticket_id, role_id, name, description, display_order)
         VALUES (?, ?, ?, ?, ?)`,
        [
          input.ticketId,
          input.roleId,
          input.name,
          input.description ?? null,
          displayOrder,
        ]
      );

      const optionResult = await this.findRoleOptionById(result.insertId);
      if (!optionResult.success || !optionResult.data) {
        return Result.err({
          type: 'QUERY_ERROR',
          message: 'Failed to retrieve created role option',
        });
      }

      return Result.ok(optionResult.data);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateRoleOption(
    id: number,
    input: UpdateTicketRoleOptionInput
  ): Promise<Result<void, RepositoryError>> {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (input.roleId !== undefined) {
        fields.push('role_id = ?');
        values.push(input.roleId);
      }
      if (input.name !== undefined) {
        fields.push('name = ?');
        values.push(input.name);
      }
      if (input.description !== undefined) {
        fields.push('description = ?');
        values.push(input.description);
      }
      if (input.displayOrder !== undefined) {
        fields.push('display_order = ?');
        values.push(input.displayOrder);
      }

      if (fields.length === 0) {
        return Result.ok(undefined);
      }

      values.push(id);
      await this.pool.execute(
        `UPDATE ticket_role_options SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteRoleOption(id: number): Promise<Result<void, RepositoryError>> {
    try {
      await this.pool.execute('DELETE FROM ticket_role_options WHERE id = ?', [id]);
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async reorderRoleOptions(
    ticketId: number,
    optionIds: number[]
  ): Promise<Result<void, RepositoryError>> {
    try {
      // 트랜잭션으로 순서 업데이트
      for (let i = 0; i < optionIds.length; i++) {
        await this.pool.execute(
          'UPDATE ticket_role_options SET display_order = ? WHERE id = ? AND ticket_id = ?',
          [i, optionIds[i], ticketId]
        );
      }
      return Result.ok(undefined);
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAllRoleIds(ticketId: number): Promise<Result<string[], RepositoryError>> {
    try {
      const [rows] = await this.pool.execute<(RowDataPacket & { role_id: string })[]>(
        'SELECT role_id FROM ticket_role_options WHERE ticket_id = ?',
        [ticketId]
      );
      return Result.ok(rows.map((row) => row.role_id));
    } catch (error) {
      return Result.err({
        type: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
