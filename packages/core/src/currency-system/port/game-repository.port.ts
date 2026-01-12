import type {
  GameSettings,
  CreateGameSettingsDto,
  UpdateGameSettingsDto,
} from '../domain/game-settings';
import type { Game, CreateGameDto, GameStatus, GameResult } from '../domain/game';
import type {
  GameParticipant,
  CreateParticipantDto,
  ParticipantStatus,
} from '../domain/game-participant';
import type {
  GameCategory,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../domain/game-category';

/**
 * 내전 시스템 레포지토리 포트
 */
export interface GameRepositoryPort {
  // ========== 내전 설정 ==========

  /**
   * 길드의 내전 설정 조회
   */
  findSettingsByGuildId(guildId: string): Promise<GameSettings | null>;

  /**
   * 내전 설정 생성 또는 업데이트 (upsert)
   */
  upsertSettings(dto: CreateGameSettingsDto): Promise<GameSettings>;

  /**
   * 내전 설정 업데이트
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

  // ========== 카테고리 ==========

  /**
   * 카테고리 생성
   */
  createCategory(dto: CreateCategoryDto): Promise<GameCategory>;

  /**
   * 카테고리 ID로 조회
   */
  findCategoryById(categoryId: number): Promise<GameCategory | null>;

  /**
   * 길드의 모든 카테고리 조회
   */
  findCategoriesByGuildId(guildId: string): Promise<GameCategory[]>;

  /**
   * 길드의 활성화된 카테고리 조회
   */
  findEnabledCategoriesByGuildId(guildId: string): Promise<GameCategory[]>;

  /**
   * 카테고리 업데이트
   */
  updateCategory(categoryId: number, dto: UpdateCategoryDto): Promise<GameCategory | null>;

  /**
   * 카테고리 삭제
   */
  deleteCategory(categoryId: number): Promise<void>;

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
   * 총 상금 풀 업데이트
   */
  updateTotalPool(gameId: bigint, amount: bigint): Promise<void>;

  /**
   * 게임 상태 변경
   */
  updateGameStatus(gameId: bigint, status: GameStatus): Promise<void>;

  /**
   * 게임 종료
   */
  finishGame(gameId: bigint): Promise<Game | null>;

  /**
   * 게임 취소
   */
  cancelGame(gameId: bigint): Promise<Game | null>;

  // ========== 참가자 ==========

  /**
   * 참가자 등록
   */
  createParticipant(dto: CreateParticipantDto): Promise<GameParticipant>;

  /**
   * 참가자 ID로 조회
   */
  findParticipantById(participantId: bigint): Promise<GameParticipant | null>;

  /**
   * 유저의 특정 게임 참가 조회
   */
  findParticipantByGameAndUser(gameId: bigint, userId: string): Promise<GameParticipant | null>;

  /**
   * 게임의 모든 참가자 조회
   */
  findParticipantsByGameId(gameId: bigint): Promise<GameParticipant[]>;

  /**
   * 게임의 특정 팀 참가자 조회
   */
  findParticipantsByTeam(gameId: bigint, teamNumber: number): Promise<GameParticipant[]>;

  /**
   * 팀 배정
   */
  assignTeam(participantId: bigint, teamNumber: number): Promise<void>;

  /**
   * 여러 참가자에게 팀 배정
   */
  assignTeamBulk(participantIds: bigint[], teamNumber: number): Promise<void>;

  /**
   * 팀 배정 해제 (미배정 상태로 변경)
   */
  unassignTeam(participantId: bigint): Promise<void>;

  /**
   * 참가자 상태 업데이트
   */
  updateParticipantStatus(participantId: bigint, status: ParticipantStatus): Promise<void>;

  /**
   * 보상 지급 (reward, status 업데이트)
   */
  settleParticipant(participantId: bigint, reward: bigint): Promise<void>;

  /**
   * 참가 취소 (삭제)
   */
  deleteParticipant(participantId: bigint): Promise<void>;

  // ========== 결과 ==========

  /**
   * 게임 결과 저장 (팀별 순위)
   */
  saveGameResult(
    gameId: bigint,
    teamNumber: number,
    rank: number,
    rewardPercent: number,
    totalReward: bigint
  ): Promise<GameResult>;

  /**
   * 게임 결과 조회
   */
  findGameResults(gameId: bigint): Promise<GameResult[]>;
}
