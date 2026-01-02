/**
 * 내전 게임 상태
 */
export type GameStatus = 'open' | 'team_assign' | 'in_progress' | 'finished' | 'cancelled';

/**
 * 내전 게임 엔티티
 */
export interface Game {
  id: bigint;
  guildId: string;
  channelId: string;
  messageId: string | null;
  categoryId: number | null;
  title: string;
  teamCount: number;
  entryFee: bigint;
  totalPool: bigint;
  status: GameStatus;
  createdBy: string;
  createdAt: Date;
  finishedAt: Date | null;
}

/**
 * 게임 생성 DTO
 */
export interface CreateGameDto {
  guildId: string;
  channelId: string;
  categoryId?: number;
  title: string;
  teamCount: number;
  entryFee: bigint;
  createdBy: string;
}

/**
 * 게임 결과 (팀별 순위)
 */
export interface GameResult {
  id: bigint;
  gameId: bigint;
  teamNumber: number;
  rank: number;
  rewardPercent: number;
  totalReward: bigint;
  createdAt: Date;
}

/**
 * 순위별 보상 비율
 */
export interface RankRewards {
  rank1Percent: number;
  rank2Percent: number;
  rank3Percent: number;
  rank4Percent: number;
}

/**
 * 순위별 보상 계산
 */
export function calculateRankReward(
  totalPool: bigint,
  rankPercent: number
): bigint {
  return (totalPool * BigInt(rankPercent)) / BigInt(100);
}

/**
 * 팀당 보상 계산 (팀 보상 / 팀원 수)
 */
export function calculatePerPlayerReward(
  teamReward: bigint,
  teamMemberCount: number
): bigint {
  if (teamMemberCount === 0) return BigInt(0);
  return teamReward / BigInt(teamMemberCount);
}
