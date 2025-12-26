import type { Result } from '../../shared/types/result';
import type { RepositoryError } from '../errors';
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

export interface RoleTicketRepositoryPort {
  // 선택권 CRUD
  findAllByGuild(guildId: string): Promise<Result<RoleTicket[], RepositoryError>>;
  findEnabledByGuild(guildId: string): Promise<Result<RoleTicket[], RepositoryError>>;
  findById(id: number): Promise<Result<RoleTicket | null, RepositoryError>>;
  findByShopItemId(shopItemId: number): Promise<Result<RoleTicket | null, RepositoryError>>;
  findWithOptions(id: number): Promise<Result<RoleTicket | null, RepositoryError>>;
  create(input: CreateRoleTicketInput): Promise<Result<RoleTicket, RepositoryError>>;
  update(id: number, input: UpdateRoleTicketInput): Promise<Result<void, RepositoryError>>;
  delete(id: number): Promise<Result<void, RepositoryError>>;

  // 역할 옵션 CRUD
  findRoleOptions(ticketId: number): Promise<Result<TicketRoleOption[], RepositoryError>>;
  findRoleOptionById(id: number): Promise<Result<TicketRoleOption | null, RepositoryError>>;
  createRoleOption(input: CreateTicketRoleOptionInput): Promise<Result<TicketRoleOption, RepositoryError>>;
  updateRoleOption(id: number, input: UpdateTicketRoleOptionInput): Promise<Result<void, RepositoryError>>;
  deleteRoleOption(id: number): Promise<Result<void, RepositoryError>>;
  reorderRoleOptions(ticketId: number, optionIds: number[]): Promise<Result<void, RepositoryError>>;

  // 특정 선택권의 모든 역할 ID 조회
  getAllRoleIds(ticketId: number): Promise<Result<string[], RepositoryError>>;
}
