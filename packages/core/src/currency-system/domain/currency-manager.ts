/**
 * 화폐 관리자
 * 웹에서 지정된 유저가 다른 유저에게 무제한으로 화폐를 지급할 수 있음
 */
export interface CurrencyManager {
  id: number;
  guildId: string;
  userId: string;
  createdAt: Date;
}

export interface CreateCurrencyManagerInput {
  guildId: string;
  userId: string;
}
