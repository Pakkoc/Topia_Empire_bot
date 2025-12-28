import type { ShopItemV2 } from './shop-item';
import type { TicketRoleOption } from './ticket-role-option';

/**
 * 역할선택권 정의
 */
export interface RoleTicket {
  id: number;
  guildId: string;
  name: string;
  description: string | null;
  shopItemId: number;
  consumeQuantity: number; // 소모 개수 (0=기간제 무제한)
  removePreviousRole: boolean; // 이전 역할 제거 여부
  fixedRoleId: string | null; // 고정 역할 ID (만료 시 교환 역할도 함께 제거)
  effectDurationSeconds: number | null; // 효과 지속 기간 (null/0=영구, 양수=초 단위)
  enabled: boolean;
  createdAt: Date;
  // 조인 데이터
  shopItem?: ShopItemV2;
  roleOptions?: TicketRoleOption[];
}

export interface CreateRoleTicketInput {
  guildId: string;
  name: string;
  description?: string | null;
  shopItemId: number;
  consumeQuantity?: number;
  removePreviousRole?: boolean;
  fixedRoleId?: string | null;
  effectDurationSeconds?: number | null;
  enabled?: boolean;
}

export interface UpdateRoleTicketInput {
  name?: string;
  description?: string | null;
  shopItemId?: number;
  consumeQuantity?: number;
  removePreviousRole?: boolean;
  fixedRoleId?: string | null;
  effectDurationSeconds?: number | null;
  enabled?: boolean;
}

/**
 * 기간제 선택권인지 확인 (소모 개수가 0이면 기간제)
 */
export function isPeriodTicket(ticket: RoleTicket): boolean {
  return ticket.consumeQuantity === 0;
}

/**
 * 효과가 영구인지 확인
 */
export function isEffectPermanent(ticket: RoleTicket): boolean {
  return (
    ticket.effectDurationSeconds === null ||
    ticket.effectDurationSeconds === 0
  );
}

/**
 * 역할 효과 만료 시각 계산
 */
export function calculateRoleExpiresAt(
  ticket: RoleTicket,
  now: Date
): Date | null {
  if (isEffectPermanent(ticket)) {
    return null;
  }
  return new Date(now.getTime() + ticket.effectDurationSeconds! * 1000);
}
