/**
 * 선택권별 교환 가능한 역할 옵션
 */
export interface TicketRoleOption {
  id: number;
  ticketId: number;
  roleId: string;
  name: string; // 표시 이름 ("빨강", "전사" 등)
  description: string | null;
  displayOrder: number;
  createdAt: Date;
}

export interface CreateTicketRoleOptionInput {
  ticketId: number;
  roleId: string;
  name: string;
  description?: string | null;
  displayOrder?: number;
}

export interface UpdateTicketRoleOptionInput {
  roleId?: string;
  name?: string;
  description?: string | null;
  displayOrder?: number;
}
