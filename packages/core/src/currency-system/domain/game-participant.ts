/**
 * 참가자 상태
 */
export type ParticipantStatus = 'registered' | 'assigned' | 'rewarded' | 'refunded';

/**
 * 내전 참가자 엔티티
 */
export interface GameParticipant {
  id: bigint;
  gameId: bigint;
  guildId: string;
  userId: string;
  teamNumber: number | null;
  entryFeePaid: bigint;
  reward: bigint;
  status: ParticipantStatus;
  createdAt: Date;
  settledAt: Date | null;
}

/**
 * 참가자 등록 DTO
 */
export interface CreateParticipantDto {
  gameId: bigint;
  guildId: string;
  userId: string;
  entryFeePaid: bigint;
}

/**
 * 팀 배정 DTO
 */
export interface AssignTeamDto {
  participantId: bigint;
  teamNumber: number;
}

/**
 * 보상 지급 결과
 */
export interface RewardResult {
  participant: GameParticipant;
  reward: bigint;
}

/**
 * 게임 정산 결과
 */
export interface GameSettlementResult {
  game: Game;
  rewards: RewardResult[];
  totalRewarded: bigint;
}

import type { Game } from './game';
