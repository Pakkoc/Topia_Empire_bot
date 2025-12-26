import { Result } from '../../shared/types/result';
import type { CurrencyError } from '../errors';
import type { RoleTicketRepositoryPort } from '../port/role-ticket-repository.port';
import type { ShopV2RepositoryPort } from '../port/shop-v2-repository.port';
import type {
  RoleTicket,
  CreateRoleTicketInput,
  UpdateRoleTicketInput,
} from '../domain/role-ticket';
import type {
  TicketRoleOption,
  CreateTicketRoleOptionInput,
  UpdateTicketRoleOptionInput,
} from '../domain/ticket-role-option';

export class RoleTicketService {
  constructor(
    private readonly ticketRepo: RoleTicketRepositoryPort,
    private readonly shopRepo: ShopV2RepositoryPort
  ) {}

  // ========== 선택권 CRUD ==========

  async getTickets(guildId: string): Promise<Result<RoleTicket[], CurrencyError>> {
    const result = await this.ticketRepo.findAllByGuild(guildId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async getEnabledTickets(guildId: string): Promise<Result<RoleTicket[], CurrencyError>> {
    const result = await this.ticketRepo.findEnabledByGuild(guildId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async getTicket(id: number): Promise<Result<RoleTicket | null, CurrencyError>> {
    const result = await this.ticketRepo.findById(id);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async getTicketWithOptions(id: number): Promise<Result<RoleTicket | null, CurrencyError>> {
    const result = await this.ticketRepo.findWithOptions(id);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async getTicketByShopItem(shopItemId: number): Promise<Result<RoleTicket | null, CurrencyError>> {
    const result = await this.ticketRepo.findByShopItemId(shopItemId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async createTicket(input: CreateRoleTicketInput): Promise<Result<RoleTicket, CurrencyError>> {
    // 연결된 상점 아이템 존재 확인
    const shopItemResult = await this.shopRepo.findById(input.shopItemId);
    if (!shopItemResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: shopItemResult.error } };
    }
    if (!shopItemResult.data) {
      return { success: false, error: { type: 'ITEM_NOT_FOUND' } };
    }

    // 이미 연결된 선택권이 있는지 확인
    const existingResult = await this.ticketRepo.findByShopItemId(input.shopItemId);
    if (!existingResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: existingResult.error } };
    }
    if (existingResult.data) {
      return { success: false, error: { type: 'TICKET_ALREADY_EXISTS' } };
    }

    const result = await this.ticketRepo.create(input);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async updateTicket(
    id: number,
    input: UpdateRoleTicketInput
  ): Promise<Result<void, CurrencyError>> {
    const result = await this.ticketRepo.update(id, input);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async deleteTicket(id: number): Promise<Result<void, CurrencyError>> {
    const result = await this.ticketRepo.delete(id);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  // ========== 역할 옵션 CRUD ==========

  async getRoleOptions(ticketId: number): Promise<Result<TicketRoleOption[], CurrencyError>> {
    const result = await this.ticketRepo.findRoleOptions(ticketId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async getRoleOption(id: number): Promise<Result<TicketRoleOption | null, CurrencyError>> {
    const result = await this.ticketRepo.findRoleOptionById(id);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async createRoleOption(
    input: CreateTicketRoleOptionInput
  ): Promise<Result<TicketRoleOption, CurrencyError>> {
    // 선택권 존재 확인
    const ticketResult = await this.ticketRepo.findById(input.ticketId);
    if (!ticketResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: ticketResult.error } };
    }
    if (!ticketResult.data) {
      return { success: false, error: { type: 'TICKET_NOT_FOUND' } };
    }

    const result = await this.ticketRepo.createRoleOption(input);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async updateRoleOption(
    id: number,
    input: UpdateTicketRoleOptionInput
  ): Promise<Result<void, CurrencyError>> {
    const result = await this.ticketRepo.updateRoleOption(id, input);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async deleteRoleOption(id: number): Promise<Result<void, CurrencyError>> {
    const result = await this.ticketRepo.deleteRoleOption(id);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async reorderRoleOptions(
    ticketId: number,
    optionIds: number[]
  ): Promise<Result<void, CurrencyError>> {
    const result = await this.ticketRepo.reorderRoleOptions(ticketId, optionIds);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  // ========== 유틸리티 ==========

  async getAllRoleIds(ticketId: number): Promise<Result<string[], CurrencyError>> {
    const result = await this.ticketRepo.getAllRoleIds(ticketId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }
}
