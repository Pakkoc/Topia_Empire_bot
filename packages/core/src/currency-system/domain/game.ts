import type { RankRewards } from './game-category';

/**
 * 내전 게임 상태
 */
export type GameStatus = 'pending_approval' | 'open' | 'team_assign' | 'in_progress' | 'finished' | 'cancelled';

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
  maxPlayersPerTeam: number | null; // 팀당 최대 인원
  // 일회성 커스텀 설정 (봇에서 직접 입력)
  customRankRewards: RankRewards | null; // 커스텀 순위보상
  customWinnerTakesAll: boolean | null; // 승자독식 (null = 기본값 사용)
  customEntryFee: bigint | null; // 커스텀 참가비 (null = 전역 설정)
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
  maxPlayersPerTeam?: number | null;
  // 일회성 커스텀 설정 (봇에서 직접 입력)
  customRankRewards?: RankRewards | null;
  customWinnerTakesAll?: boolean | null;
  customEntryFee?: bigint | null;
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
