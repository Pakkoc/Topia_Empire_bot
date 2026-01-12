import type { GameRepositoryPort } from '../port/game-repository.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type {
  GameSettings,
  UpdateGameSettingsDto,
} from '../domain/game-settings';
import {
  DEFAULT_ENTRY_FEE,
  DEFAULT_RANK_REWARDS,
  createDefaultGameSettings,
} from '../domain/game-settings';
import type { RankRewards } from '../domain/game-category';
import type { Game, CreateGameDto, GameResult } from '../domain/game';
import { calculateRankReward, calculatePerPlayerReward } from '../domain/game';
import type { GameParticipant, RewardResult } from '../domain/game-participant';
import type { GameCategory, CreateCategoryDto, UpdateCategoryDto } from '../domain/game-category';
import type { CurrencyError } from '../errors';
import { Result } from '../../shared/types/result';

export class GameService {
  constructor(
    private readonly gameRepo: GameRepositoryPort,
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort
  ) {}

  // ========== 설정 관련 ==========

  /**
   * 길드의 내전 설정 조회
   */
  async getSettings(guildId: string): Promise<Result<GameSettings, CurrencyError>> {
    try {
      const result = await this.gameRepo.findSettingsByGuildId(guildId);

      if (result) {
        return Result.ok(result);
      }

      return Result.ok(createDefaultGameSettings(guildId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 내전 설정 저장
   */
  async saveSettings(
    guildId: string,
    dto: UpdateGameSettingsDto
  ): Promise<Result<GameSettings, CurrencyError>> {
    try {
      const result = await this.gameRepo.upsertSettings({
        guildId,
        channelId: dto.channelId ?? undefined,
        messageId: dto.messageId ?? undefined,
        entryFee: dto.entryFee,
        rankRewards: dto.rankRewards,
      });

      return Result.ok(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 패널 정보 업데이트
   */
  async updatePanel(
    guildId: string,
    channelId: string | null,
    messageId: string | null
  ): Promise<Result<void, CurrencyError>> {
    try {
      await this.gameRepo.updatePanel(guildId, channelId, messageId);
      return Result.ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  // ========== 카테고리 관련 ==========

  /**
   * 카테고리 생성
   */
  async createCategory(dto: CreateCategoryDto): Promise<Result<GameCategory, CurrencyError>> {
    try {
      const category = await this.gameRepo.createCategory(dto);
      return Result.ok(category);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 카테고리 조회
   */
  async getCategories(guildId: string): Promise<Result<GameCategory[], CurrencyError>> {
    try {
      const categories = await this.gameRepo.findCategoriesByGuildId(guildId);
      return Result.ok(categories);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 활성화된 카테고리 조회
   */
  async getEnabledCategories(guildId: string): Promise<Result<GameCategory[], CurrencyError>> {
    try {
      const categories = await this.gameRepo.findEnabledCategoriesByGuildId(guildId);
      return Result.ok(categories);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 카테고리 업데이트
   */
  async updateCategory(
    categoryId: number,
    dto: UpdateCategoryDto
  ): Promise<Result<GameCategory, CurrencyError>> {
    try {
      const category = await this.gameRepo.updateCategory(categoryId, dto);
      if (!category) {
        return Result.err({ type: 'CATEGORY_NOT_FOUND' });
      }
      return Result.ok(category);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 카테고리 삭제
   */
  async deleteCategory(categoryId: number): Promise<Result<void, CurrencyError>> {
    try {
      await this.gameRepo.deleteCategory(categoryId);
      return Result.ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  // ========== 게임 관리 ==========

  /**
   * 게임 생성
   */
  async createGame(dto: CreateGameDto): Promise<Result<Game, CurrencyError>> {
    try {
      // 카테고리가 지정된 경우 maxPlayersPerTeam 가져오기
      let maxPlayersPerTeam: number | null = dto.maxPlayersPerTeam ?? null;

      if (dto.categoryId) {
        const category = await this.gameRepo.findCategoryById(dto.categoryId);
        if (category) {
          maxPlayersPerTeam = maxPlayersPerTeam ?? category.maxPlayersPerTeam;
        }
      }

      // 실제 참가비 결정: 커스텀 참가비 > dto.entryFee (전역 설정)
      const actualEntryFee = dto.customEntryFee ?? dto.entryFee;

      const game = await this.gameRepo.createGame({
        ...dto,
        entryFee: actualEntryFee,
        maxPlayersPerTeam,
        customRankRewards: dto.customRankRewards ?? null,
        customWinnerTakesAll: dto.customWinnerTakesAll ?? null,
        customEntryFee: dto.customEntryFee ?? null,
      });
      return Result.ok(game);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 게임 조회 (ID)
   */
  async getGameById(gameId: bigint): Promise<Result<Game, CurrencyError>> {
    try {
      const game = await this.gameRepo.findGameById(gameId);

      if (!game) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      return Result.ok(game);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 게임 메시지 ID 업데이트
   */
  async updateGameMessageId(gameId: bigint, messageId: string): Promise<Result<void, CurrencyError>> {
    try {
      await this.gameRepo.updateGameMessageId(gameId, messageId);
      return Result.ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 열린 게임 목록 조회
   */
  async getOpenGames(guildId: string): Promise<Result<Game[], CurrencyError>> {
    try {
      const games = await this.gameRepo.findOpenGamesByGuildId(guildId);
      return Result.ok(games);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  // ========== 참가 관련 ==========

  /**
   * 게임 참가
   */
  async joinGame(
    guildId: string,
    gameId: bigint,
    userId: string
  ): Promise<Result<GameParticipant, CurrencyError>> {
    try {
      // 1. 게임 조회
      const game = await this.gameRepo.findGameById(gameId);
      if (!game) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 2. 게임 상태 확인
      if (game.status !== 'open') {
        return Result.err({ type: 'GAME_NOT_OPEN' });
      }

      // 3. 이미 참가했는지 확인
      const existingParticipant = await this.gameRepo.findParticipantByGameAndUser(gameId, userId);
      if (existingParticipant) {
        return Result.err({ type: 'ALREADY_JOINED' });
      }

      // 4. 정원 제한 확인
      if (game.maxPlayersPerTeam !== null) {
        const participants = await this.gameRepo.findParticipantsByGameId(gameId);
        const maxTotalPlayers = game.maxPlayersPerTeam * game.teamCount;
        if (participants.length >= maxTotalPlayers) {
          return Result.err({
            type: 'GAME_FULL',
            maxPlayers: maxTotalPlayers,
            currentPlayers: participants.length,
          });
        }
      }

      // 5. 잔액 확인
      const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return Result.err({
          type: 'REPOSITORY_ERROR',
          cause: walletResult.error,
        });
      }

      const balance = walletResult.data?.balance ?? BigInt(0);
      if (balance < game.entryFee) {
        return Result.err({
          type: 'INSUFFICIENT_BALANCE',
          required: game.entryFee,
          available: balance,
        });
      }

      // 5. 참가비 차감
      const deductResult = await this.topyWalletRepo.updateBalance(
        guildId,
        userId,
        game.entryFee,
        'subtract'
      );
      if (!deductResult.success) {
        return Result.err({
          type: 'REPOSITORY_ERROR',
          cause: deductResult.error,
        });
      }

      // 6. 참가자 등록
      const participant = await this.gameRepo.createParticipant({
        gameId,
        guildId,
        userId,
        entryFeePaid: game.entryFee,
      });

      // 7. 총 상금 풀 업데이트
      await this.gameRepo.updateTotalPool(gameId, game.entryFee);

      // 8. 거래 기록
      await this.transactionRepo.save({
        guildId,
        userId,
        currencyType: 'topy',
        transactionType: 'game_entry',
        amount: -game.entryFee,
        balanceAfter: deductResult.data.balance,
        fee: BigInt(0),
        relatedUserId: null,
        description: `내전 참가: ${game.title}`,
      });

      return Result.ok(participant);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 참가 취소
   */
  async leaveGame(
    guildId: string,
    gameId: bigint,
    userId: string
  ): Promise<Result<void, CurrencyError>> {
    try {
      // 1. 게임 조회
      const game = await this.gameRepo.findGameById(gameId);
      if (!game) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 2. 게임 상태 확인 (open일 때만 취소 가능)
      if (game.status !== 'open') {
        return Result.err({ type: 'GAME_NOT_OPEN' });
      }

      // 3. 참가자 조회
      const participant = await this.gameRepo.findParticipantByGameAndUser(gameId, userId);
      if (!participant) {
        return Result.err({ type: 'NOT_PARTICIPANT' });
      }

      // 4. 참가비 환불
      const addResult = await this.topyWalletRepo.updateBalance(
        guildId,
        userId,
        participant.entryFeePaid,
        'add'
      );
      if (!addResult.success) {
        return Result.err({
          type: 'REPOSITORY_ERROR',
          cause: addResult.error,
        });
      }

      // 5. 참가자 삭제
      await this.gameRepo.deleteParticipant(participant.id);

      // 6. 총 상금 풀 감소
      await this.gameRepo.updateTotalPool(gameId, -participant.entryFeePaid);

      // 7. 거래 기록
      await this.transactionRepo.save({
        guildId,
        userId,
        currencyType: 'topy',
        transactionType: 'game_refund',
        amount: participant.entryFeePaid,
        balanceAfter: addResult.data.balance,
        fee: BigInt(0),
        relatedUserId: null,
        description: `내전 참가 취소: ${game.title}`,
      });

      return Result.ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 게임 참가자 조회
   */
  async getParticipants(gameId: bigint): Promise<Result<GameParticipant[], CurrencyError>> {
    try {
      const participants = await this.gameRepo.findParticipantsByGameId(gameId);
      return Result.ok(participants);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 유저의 참가 정보 조회
   */
  async getParticipant(
    gameId: bigint,
    userId: string
  ): Promise<Result<GameParticipant | null, CurrencyError>> {
    try {
      const participant = await this.gameRepo.findParticipantByGameAndUser(gameId, userId);
      return Result.ok(participant);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  // ========== 팀 배정 ==========

  /**
   * 팀 배정 (관리자)
   */
  async assignTeam(
    gameId: bigint,
    teamNumber: number,
    userIds: string[]
  ): Promise<Result<void, CurrencyError>> {
    try {
      // 1. 게임 조회
      const game = await this.gameRepo.findGameById(gameId);
      if (!game) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 2. 팀 번호 유효성 확인
      if (teamNumber < 1 || teamNumber > game.teamCount) {
        return Result.err({ type: 'INVALID_TEAM_NUMBER' });
      }

      // 3. 팀당 인원 제한 확인
      if (game.maxPlayersPerTeam !== null) {
        const currentTeamMembers = await this.gameRepo.findParticipantsByTeam(gameId, teamNumber);
        // 이미 해당 팀에 배정된 유저는 제외하고 새로 추가될 유저만 계산
        const newUserIds = userIds.filter(
          (userId) => !currentTeamMembers.some((m) => m.userId === userId)
        );
        const newTeamSize = currentTeamMembers.length + newUserIds.length;
        if (newTeamSize > game.maxPlayersPerTeam) {
          return Result.err({
            type: 'TEAM_FULL',
            teamNumber,
            maxPlayers: game.maxPlayersPerTeam,
            currentPlayers: currentTeamMembers.length,
          });
        }
      }

      // 4. 각 유저가 참가자인지 확인하고 팀 배정
      for (const userId of userIds) {
        const participant = await this.gameRepo.findParticipantByGameAndUser(gameId, userId);
        if (!participant) {
          return Result.err({ type: 'NOT_PARTICIPANT', userId });
        }
        await this.gameRepo.assignTeam(participant.id, teamNumber);
      }

      return Result.ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 팀 배정 해제 (미배정 상태로 변경)
   */
  async unassignTeam(
    gameId: bigint,
    userIds: string[]
  ): Promise<Result<void, CurrencyError>> {
    try {
      // 게임 조회
      const game = await this.gameRepo.findGameById(gameId);
      if (!game) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 각 유저에 대해 팀 해제
      for (const userId of userIds) {
        const participant = await this.gameRepo.findParticipantByGameAndUser(gameId, userId);
        if (participant) {
          await this.gameRepo.unassignTeam(participant.id);
        }
      }

      return Result.ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 팀 배정 완료 → 경기 시작
   */
  async startGame(gameId: bigint): Promise<Result<Game, CurrencyError>> {
    try {
      // 1. 게임 조회
      const game = await this.gameRepo.findGameById(gameId);
      if (!game) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 2. 상태 확인
      if (game.status !== 'open' && game.status !== 'team_assign') {
        return Result.err({ type: 'GAME_NOT_OPEN' });
      }

      // 3. 모든 참가자가 팀 배정되었는지 확인
      const participants = await this.gameRepo.findParticipantsByGameId(gameId);
      const unassigned = participants.filter(p => p.teamNumber === null);
      if (unassigned.length > 0) {
        return Result.err({ type: 'UNASSIGNED_PARTICIPANTS', count: unassigned.length });
      }

      // 4. 상태 변경
      await this.gameRepo.updateGameStatus(gameId, 'in_progress');

      // 5. 참가자 상태 업데이트
      for (const p of participants) {
        await this.gameRepo.updateParticipantStatus(p.id, 'assigned');
      }

      return Result.ok({ ...game, status: 'in_progress' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  // ========== 게임 종료/정산 ==========

  /**
   * 게임 종료 및 순위별 정산
   */
  async finishGame(
    guildId: string,
    gameId: bigint,
    results: { teamNumber: number; rank: number }[]
  ): Promise<Result<{ game: Game; rewards: RewardResult[] }, CurrencyError>> {
    try {
      // 1. 게임 조회
      const game = await this.gameRepo.findGameById(gameId);
      if (!game) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 2. 상태 확인
      if (game.status === 'finished' || game.status === 'cancelled') {
        return Result.err({ type: 'GAME_ALREADY_FINISHED' });
      }

      // 3. 카테고리 조회 (카테고리별 보상 비율 확인)
      let category = null;
      if (game.categoryId) {
        category = await this.gameRepo.findCategoryById(game.categoryId);
      }

      // 4. 순위 비율 결정 (우선순위: 일회성 설정 > 카테고리 설정 > 전역 설정)
      let rankPercents: RankRewards;

      // Case 1: 일회성 커스텀 순위보상 (최우선)
      if (game.customRankRewards) {
        rankPercents = this.normalizeRankPercents(game.customRankRewards, results);
      }
      // Case 2: 일회성 승자독식 설정
      else if (game.customWinnerTakesAll === true && game.teamCount === 2) {
        rankPercents = { 1: 100, 2: 0 };
      }
      // Case 3: 카테고리에 커스텀 비율이 설정된 경우
      else if (category?.rankRewards) {
        rankPercents = this.normalizeRankPercents(category.rankRewards, results);
      }
      // Case 4: 카테고리 승자독식 모드 (2팀 게임, 기본값: true)
      else if (game.teamCount === 2 && (category?.winnerTakesAll ?? true)) {
        rankPercents = { 1: 100, 2: 0 };
      }
      // Case 5: 전역 설정 사용
      else {
        const settings = await this.gameRepo.findSettingsByGuildId(guildId);
        const rawRankRewards = settings?.rankRewards ?? { ...DEFAULT_RANK_REWARDS };
        rankPercents = this.normalizeRankPercents(rawRankRewards, results);
      }

      // 4. 게임 종료 처리
      const finishedGame = await this.gameRepo.finishGame(gameId);
      if (!finishedGame) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 5. 순위별 보상 계산 및 지급
      const allRewards: RewardResult[] = [];

      for (const result of results) {
        const { teamNumber, rank } = result;
        const rewardPercent = rankPercents[rank] || 0;

        if (rewardPercent === 0) continue;

        // 팀 보상 계산
        const teamReward = calculateRankReward(game.totalPool, rewardPercent);

        // 팀원 조회
        const teamMembers = await this.gameRepo.findParticipantsByTeam(gameId, teamNumber);
        if (teamMembers.length === 0) continue;

        // 1인당 보상 계산
        const perPlayerReward = calculatePerPlayerReward(teamReward, teamMembers.length);

        // 결과 저장
        await this.gameRepo.saveGameResult(gameId, teamNumber, rank, rewardPercent, teamReward);

        // 각 팀원에게 보상 지급
        for (const member of teamMembers) {
          // 보상 지급
          const addResult = await this.topyWalletRepo.updateBalance(
            guildId,
            member.userId,
            perPlayerReward,
            'add'
          );

          if (addResult.success) {
            // 참가자 정산 처리
            await this.gameRepo.settleParticipant(member.id, perPlayerReward);

            // 거래 기록
            await this.transactionRepo.save({
              guildId,
              userId: member.userId,
              currencyType: 'topy',
              transactionType: 'game_reward',
              amount: perPlayerReward,
              balanceAfter: addResult.data.balance,
              fee: BigInt(0),
              relatedUserId: null,
              description: `내전 ${rank}등 보상: ${game.title}`,
            });

            allRewards.push({
              participant: { ...member, reward: perPlayerReward, status: 'rewarded' },
              reward: perPlayerReward,
            });
          }
        }
      }

      return Result.ok({
        game: finishedGame,
        rewards: allRewards,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 게임 취소 (전액 환불)
   */
  async cancelGame(
    guildId: string,
    gameId: bigint
  ): Promise<Result<{ game: Game; refundedCount: number }, CurrencyError>> {
    try {
      // 1. 게임 조회
      const game = await this.gameRepo.findGameById(gameId);
      if (!game) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 2. 상태 확인
      if (game.status === 'finished' || game.status === 'cancelled') {
        return Result.err({ type: 'GAME_ALREADY_FINISHED' });
      }

      // 3. 게임 취소 처리
      const cancelledGame = await this.gameRepo.cancelGame(gameId);
      if (!cancelledGame) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 4. 모든 참가자에게 환불
      const participants = await this.gameRepo.findParticipantsByGameId(gameId);
      let refundedCount = 0;

      for (const participant of participants) {
        // 환불
        const addResult = await this.topyWalletRepo.updateBalance(
          guildId,
          participant.userId,
          participant.entryFeePaid,
          'add'
        );

        if (addResult.success) {
          // 참가자 상태 업데이트
          await this.gameRepo.updateParticipantStatus(participant.id, 'refunded');

          // 거래 기록
          await this.transactionRepo.save({
            guildId,
            userId: participant.userId,
            currencyType: 'topy',
            transactionType: 'game_refund',
            amount: participant.entryFeePaid,
            balanceAfter: addResult.data.balance,
            fee: BigInt(0),
            relatedUserId: null,
            description: `내전 취소 환불: ${game.title}`,
          });

          refundedCount++;
        }
      }

      return Result.ok({
        game: cancelledGame,
        refundedCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  // ========== 헬퍼 메서드 ==========

  /**
   * 사용되는 순위만 합산하여 정규화 (합계 100%)
   */
  private normalizeRankPercents(
    rawPercents: Record<number, number>,
    results: { teamNumber: number; rank: number }[]
  ): Record<number, number> {
    const usedRanks = results.map((r) => r.rank);
    const totalUsedPercent = usedRanks.reduce(
      (sum, rank) => sum + (rawPercents[rank] || 0),
      0
    );

    const normalized: Record<number, number> = {};
    for (const rank of usedRanks) {
      const rawPercent = rawPercents[rank] || 0;
      normalized[rank] = totalUsedPercent > 0 ? (rawPercent * 100) / totalUsedPercent : 0;
    }
    return normalized;
  }
}
