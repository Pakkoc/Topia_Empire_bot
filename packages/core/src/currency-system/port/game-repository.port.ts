import type {
  GameSettings,
  CreateGameSettingsDto,
  UpdateGameSettingsDto,
} from '../domain/game-settings';
import type { Game, CreateGameDto, GameTeam, GameStatus } from '../domain/game';
import type { GameBet, CreateGameBetDto, GameBetStatus } from '../domain/game-bet';

/**
 * 게임센터 레포지토리 포트
 */
export interface GameRepositoryPort {
  // ========== 게임센터 설정 ==========

  /**
   * 길드의 게임센터 설정 조회
   */
  findSettingsByGuildId(guildId: string): Promise<GameSettings | null>;

  /**
   * 게임센터 설정 생성 또는 업데이트 (upsert)
   */
  upsertSettings(dto: CreateGameSettingsDto): Promise<GameSettings>;

  /**
   * 게임센터 설정 업데이트
   */
  updateSettings(guildId: string, dto: UpdateGameSettingsDto): Promise<GameSettings | null>;

  /**
   * 패널 정보 업데이트 (채널, 메시지 ID)
   */
  updatePanel(
    guildId: string,
    channelId: string | null,
    messageId: string | null
  ): Promise<void>;

  // ========== 게임 ==========

  /**
   * 게임 생성
   */
  createGame(dto: CreateGameDto): Promise<Game>;

  /**
   * 게임 ID로 조회
   */
  findGameById(gameId: bigint): Promise<Game | null>;

  /**
   * 메시지 ID로 게임 조회
   */
  findGameByMessageId(messageId: string): Promise<Game | null>;

  /**
   * 길드의 열린 게임 목록 조회
   */
  findOpenGamesByGuildId(guildId: string): Promise<Game[]>;

  /**
   * 게임 메시지 ID 업데이트
   */
  updateGameMessageId(gameId: bigint, messageId: string): Promise<void>;

  /**
   * 게임 풀 금액 업데이트
   */
  updateGamePool(gameId: bigint, team: GameTeam, amount: bigint): Promise<void>;

  /**
   * 게임 상태 변경
   */
  updateGameStatus(gameId: bigint, status: GameStatus): Promise<void>;

  /**
   * 게임 종료 (승자 설정)
   */
  finishGame(gameId: bigint, winner: GameTeam): Promise<Game | null>;

  /**
   * 게임 취소 (환불)
   */
  cancelGame(gameId: bigint): Promise<Game | null>;

  // ========== 배팅 ==========

  /**
   * 배팅 생성
   */
  createBet(dto: CreateGameBetDto): Promise<GameBet>;

  /**
   * 배팅 ID로 조회
   */
  findBetById(betId: bigint): Promise<GameBet | null>;

  /**
   * 유저의 특정 게임 배팅 조회
   */
  findBetByGameAndUser(gameId: bigint, userId: string): Promise<GameBet | null>;

  /**
   * 게임의 모든 배팅 조회
   */
  findBetsByGameId(gameId: bigint): Promise<GameBet[]>;

  /**
   * 게임의 특정 팀 배팅 조회
   */
  findBetsByGameAndTeam(gameId: bigint, team: GameTeam): Promise<GameBet[]>;

  /**
   * 배팅 상태 업데이트
   */
  updateBetStatus(betId: bigint, status: GameBetStatus): Promise<void>;

  /**
   * 배팅 정산 (payout, fee, status 업데이트)
   */
  settleBet(
    betId: bigint,
    status: GameBetStatus,
    payout: bigint,
    fee: bigint
  ): Promise<void>;

  /**
   * 게임의 모든 배팅 일괄 정산
   */
  settleBetsByGame(
    gameId: bigint,
    winnerTeam: GameTeam,
    feePercent: number
  ): Promise<{ winningBets: GameBet[]; losingBets: GameBet[] }>;
}
