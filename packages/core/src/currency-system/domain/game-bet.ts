import type { GameTeam } from './game';

/**
 * 배팅 상태
 */
export type GameBetStatus = 'pending' | 'won' | 'lost' | 'refunded';

/**
 * 게임 배팅 엔티티
 */
export interface GameBet {
  id: bigint;
  gameId: bigint;
  guildId: string;
  userId: string;
  team: GameTeam;
  amount: bigint;
  odds: number;
  payout: bigint;
  fee: bigint;
  status: GameBetStatus;
  createdAt: Date;
  settledAt: Date | null;
}

/**
 * 배팅 생성 DTO
 */
export interface CreateGameBetDto {
  gameId: bigint;
  guildId: string;
  userId: string;
  team: GameTeam;
  amount: bigint;
}

/**
 * 배팅 정산 결과
 */
export interface BetSettlementResult {
  bet: GameBet;
  payout: bigint;
  fee: bigint;
  netPayout: bigint;
}

/**
 * 게임 정산 결과
 */
export interface GameSettlementResult {
  game: Game;
  winningBets: BetSettlementResult[];
  losingBets: GameBet[];
  totalPayout: bigint;
  totalFee: bigint;
}

// Game import for GameSettlementResult
import type { Game } from './game';
