import type { GameRepositoryPort } from '../port/game-repository.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type {
  GameSettings,
  UpdateGameSettingsDto,
} from '../domain/game-settings';
import {
  DEFAULT_BET_FEE_PERCENT,
  DEFAULT_MIN_BET,
  DEFAULT_MAX_BET,
  createDefaultGameSettings,
} from '../domain/game-settings';
import type { Game, CreateGameDto, GameTeam } from '../domain/game';
import { calculateTeamOdds } from '../domain/game';
import type { GameBet } from '../domain/game-bet';
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
   * 길드의 게임센터 설정 조회
   */
  async getSettings(guildId: string): Promise<Result<GameSettings, CurrencyError>> {
    try {
      const result = await this.gameRepo.findSettingsByGuildId(guildId);

      if (result) {
        return Result.ok(result);
      }

      // 기본 설정 반환
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
   * 게임센터 설정 저장
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
        betFeePercent: dto.betFeePercent,
        minBet: dto.minBet,
        maxBet: dto.maxBet,
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

  // ========== 게임 관리 ==========

  /**
   * 게임 생성
   */
  async createGame(dto: CreateGameDto): Promise<Result<Game, CurrencyError>> {
    try {
      const game = await this.gameRepo.createGame(dto);
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
   * 메시지 ID로 게임 조회
   */
  async getGameByMessageId(messageId: string): Promise<Result<Game, CurrencyError>> {
    try {
      const game = await this.gameRepo.findGameByMessageId(messageId);

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

  // ========== 배팅 관련 ==========

  /**
   * 배팅하기
   */
  async placeBet(
    guildId: string,
    gameId: bigint,
    userId: string,
    team: GameTeam,
    amount: bigint
  ): Promise<Result<GameBet, CurrencyError>> {
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

      // 3. 이미 배팅했는지 확인
      const existingBet = await this.gameRepo.findBetByGameAndUser(gameId, userId);
      if (existingBet) {
        return Result.err({ type: 'ALREADY_BET' });
      }

      // 4. 설정 조회 (배팅 제한)
      const settings = await this.gameRepo.findSettingsByGuildId(guildId);
      const minBet = settings?.minBet ?? DEFAULT_MIN_BET;
      const maxBet = settings?.maxBet ?? DEFAULT_MAX_BET;

      // 5. 배팅 금액 검증
      if (amount < minBet) {
        return Result.err({ type: 'BET_AMOUNT_TOO_LOW', minBet });
      }
      if (amount > maxBet) {
        return Result.err({ type: 'BET_AMOUNT_TOO_HIGH', maxBet });
      }

      // 6. 잔액 확인
      const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return Result.err({
          type: 'REPOSITORY_ERROR',
          cause: walletResult.error,
        });
      }

      const balance = walletResult.data?.balance ?? BigInt(0);
      if (balance < amount) {
        return Result.err({
          type: 'INSUFFICIENT_BALANCE',
          required: amount,
          available: balance,
        });
      }

      // 7. 잔액 차감
      const deductResult = await this.topyWalletRepo.updateBalance(
        guildId,
        userId,
        amount,
        'subtract'
      );
      if (!deductResult.success) {
        return Result.err({
          type: 'REPOSITORY_ERROR',
          cause: deductResult.error,
        });
      }

      // 8. 배팅 생성
      const bet = await this.gameRepo.createBet({
        gameId,
        guildId,
        userId,
        team,
        amount,
      });

      // 9. 게임 풀 업데이트
      await this.gameRepo.updateGamePool(gameId, team, amount);

      // 10. 거래 기록
      await this.transactionRepo.save({
        guildId,
        userId,
        currencyType: 'topy',
        transactionType: 'game_bet',
        amount: -amount,
        balanceAfter: deductResult.data.balance,
        fee: BigInt(0),
        relatedUserId: null,
        description: `게임 배팅: ${game.title} - ${team === 'A' ? game.teamA : game.teamB}`,
      });

      return Result.ok(bet);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 유저의 배팅 조회
   */
  async getUserBet(gameId: bigint, userId: string): Promise<Result<GameBet | null, CurrencyError>> {
    try {
      const bet = await this.gameRepo.findBetByGameAndUser(gameId, userId);
      return Result.ok(bet);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }

  /**
   * 게임의 모든 배팅 조회
   */
  async getGameBets(gameId: bigint): Promise<Result<GameBet[], CurrencyError>> {
    try {
      const bets = await this.gameRepo.findBetsByGameId(gameId);
      return Result.ok(bets);
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
   * 게임 종료 및 정산
   */
  async finishGame(
    guildId: string,
    gameId: bigint,
    winner: GameTeam
  ): Promise<Result<{ game: Game; winningBets: GameBet[]; losingBets: GameBet[] }, CurrencyError>> {
    try {
      // 1. 게임 조회
      const game = await this.gameRepo.findGameById(gameId);
      if (!game) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 2. 게임 상태 확인
      if (game.status === 'finished' || game.status === 'cancelled') {
        return Result.err({ type: 'GAME_ALREADY_FINISHED' });
      }

      // 3. 설정 조회 (수수료)
      const settings = await this.gameRepo.findSettingsByGuildId(guildId);
      const feePercent = settings?.betFeePercent ?? DEFAULT_BET_FEE_PERCENT;

      // 4. 게임 종료 처리
      const finishedGame = await this.gameRepo.finishGame(gameId, winner);
      if (!finishedGame) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 5. 모든 배팅 조회
      const allBets = await this.gameRepo.findBetsByGameId(gameId);

      // 6. 승자/패자 배팅 분류
      const winningBets = allBets.filter(bet => bet.team === winner);
      const losingBets = allBets.filter(bet => bet.team !== winner);

      // 7. 배당률 계산
      const { teamAOdds, teamBOdds } = calculateTeamOdds(game);
      const winningOdds = winner === 'A' ? teamAOdds : teamBOdds;

      // 8. 승자 배팅 정산
      for (const bet of winningBets) {
        // 당첨금 = 배팅금 * 배당률
        const grossPayout = BigInt(Math.floor(Number(bet.amount) * winningOdds));
        // 수수료 = 당첨금 * 수수료율
        const fee = grossPayout * BigInt(feePercent) / BigInt(100);
        // 실수령액 = 당첨금 - 수수료
        const netPayout = grossPayout - fee;

        // 배팅 정산 처리
        await this.gameRepo.settleBet(bet.id, 'won', grossPayout, fee);

        // 잔액 지급
        const addResult = await this.topyWalletRepo.updateBalance(
          guildId,
          bet.userId,
          netPayout,
          'add'
        );

        if (addResult.success) {
          // 거래 기록
          await this.transactionRepo.save({
            guildId,
            userId: bet.userId,
            currencyType: 'topy',
            transactionType: 'game_win',
            amount: netPayout,
            balanceAfter: addResult.data.balance,
            fee,
            relatedUserId: null,
            description: `게임 당첨: ${game.title} (배당 ${winningOdds.toFixed(2)}배, 수수료 ${feePercent}%)`,
          });
        }

        // bet 객체 업데이트 (반환용)
        bet.status = 'won';
        bet.odds = winningOdds;
        bet.payout = grossPayout;
        bet.fee = fee;
      }

      // 9. 패자 배팅 정산
      for (const bet of losingBets) {
        await this.gameRepo.settleBet(bet.id, 'lost', BigInt(0), BigInt(0));
        bet.status = 'lost';
      }

      return Result.ok({
        game: finishedGame,
        winningBets,
        losingBets,
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
  ): Promise<Result<{ game: Game; refundedBets: GameBet[] }, CurrencyError>> {
    try {
      // 1. 게임 조회
      const game = await this.gameRepo.findGameById(gameId);
      if (!game) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 2. 게임 상태 확인
      if (game.status === 'finished' || game.status === 'cancelled') {
        return Result.err({ type: 'GAME_ALREADY_FINISHED' });
      }

      // 3. 게임 취소 처리
      const cancelledGame = await this.gameRepo.cancelGame(gameId);
      if (!cancelledGame) {
        return Result.err({ type: 'GAME_NOT_FOUND' });
      }

      // 4. 모든 배팅 조회
      const allBets = await this.gameRepo.findBetsByGameId(gameId);

      // 5. 모든 배팅 환불
      for (const bet of allBets) {
        // 배팅 환불 처리
        await this.gameRepo.settleBet(bet.id, 'refunded', bet.amount, BigInt(0));

        // 잔액 환불
        const addResult = await this.topyWalletRepo.updateBalance(
          guildId,
          bet.userId,
          bet.amount,
          'add'
        );

        if (addResult.success) {
          // 거래 기록
          await this.transactionRepo.save({
            guildId,
            userId: bet.userId,
            currencyType: 'topy',
            transactionType: 'game_refund',
            amount: bet.amount,
            balanceAfter: addResult.data.balance,
            fee: BigInt(0),
            relatedUserId: null,
            description: `게임 취소 환불: ${game.title}`,
          });
        }

        bet.status = 'refunded';
        bet.payout = bet.amount;
      }

      return Result.ok({
        game: cancelledGame,
        refundedBets: allBets,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err({
        type: 'REPOSITORY_ERROR',
        cause: { type: 'QUERY_ERROR', message },
      });
    }
  }
}
