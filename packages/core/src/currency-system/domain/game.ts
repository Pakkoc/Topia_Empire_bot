/**
 * 게임(배팅) 상태
 */
export type GameStatus = 'open' | 'closed' | 'finished' | 'cancelled';

/**
 * 팀 타입
 */
export type GameTeam = 'A' | 'B';

/**
 * 게임(배팅) 엔티티
 */
export interface Game {
  id: bigint;
  guildId: string;
  channelId: string;
  messageId: string | null;
  title: string;
  teamA: string;
  teamB: string;
  teamAPool: bigint;
  teamBPool: bigint;
  status: GameStatus;
  winner: GameTeam | null;
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
  title: string;
  teamA: string;
  teamB: string;
  createdBy: string;
}

/**
 * 배당률 계산
 * 총 배팅 풀 / 해당 팀 배팅 풀
 */
export function calculateOdds(totalPool: bigint, teamPool: bigint): number {
  if (teamPool === BigInt(0)) return 1;
  return Number(totalPool) / Number(teamPool);
}

/**
 * 팀별 배당률 계산
 */
export function calculateTeamOdds(game: Game): { teamAOdds: number; teamBOdds: number } {
  const totalPool = game.teamAPool + game.teamBPool;

  return {
    teamAOdds: calculateOdds(totalPool, game.teamAPool),
    teamBOdds: calculateOdds(totalPool, game.teamBPool),
  };
}
