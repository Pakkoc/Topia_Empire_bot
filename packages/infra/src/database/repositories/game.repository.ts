import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  GameRepositoryPort,
  GameSettings,
  CreateGameSettingsDto,
  UpdateGameSettingsDto,
  Game,
  CreateGameDto,
  GameTeam,
  GameStatus,
  GameBet,
  CreateGameBetDto,
  GameBetStatus,
} from '@topia/core';

// ========== Row Types ==========

interface GameSettingsRow extends RowDataPacket {
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  manager_role_id: string | null;
  bet_fee_percent: number;
  min_bet: string; // bigint as string
  max_bet: string;
  created_at: Date;
  updated_at: Date;
}

interface GameRow extends RowDataPacket {
  id: string; // bigint as string
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  title: string;
  team_a: string;
  team_b: string;
  team_a_pool: string;
  team_b_pool: string;
  status: GameStatus;
  winner: GameTeam | null;
  created_by: string;
  created_at: Date;
  finished_at: Date | null;
}

interface GameBetRow extends RowDataPacket {
  id: string;
  game_id: string;
  guild_id: string;
  user_id: string;
  team: GameTeam;
  amount: string;
  odds: string;
  payout: string;
  fee: string;
  status: GameBetStatus;
  created_at: Date;
  settled_at: Date | null;
}

// ========== Row to Entity ==========

function settingsRowToEntity(row: GameSettingsRow): GameSettings {
  return {
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    managerRoleId: row.manager_role_id,
    betFeePercent: row.bet_fee_percent,
    minBet: BigInt(row.min_bet),
    maxBet: BigInt(row.max_bet),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function gameRowToEntity(row: GameRow): Game {
  return {
    id: BigInt(row.id),
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    title: row.title,
    teamA: row.team_a,
    teamB: row.team_b,
    teamAPool: BigInt(row.team_a_pool),
    teamBPool: BigInt(row.team_b_pool),
    status: row.status,
    winner: row.winner,
    createdBy: row.created_by,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

function betRowToEntity(row: GameBetRow): GameBet {
  return {
    id: BigInt(row.id),
    gameId: BigInt(row.game_id),
    guildId: row.guild_id,
    userId: row.user_id,
    team: row.team,
    amount: BigInt(row.amount),
    odds: parseFloat(row.odds),
    payout: BigInt(row.payout),
    fee: BigInt(row.fee),
    status: row.status,
    createdAt: row.created_at,
    settledAt: row.settled_at,
  };
}

// ========== Repository ==========

export class GameRepository implements GameRepositoryPort {
  constructor(private readonly pool: Pool) {}

  // ========== 게임센터 설정 ==========

  async findSettingsByGuildId(guildId: string): Promise<GameSettings | null> {
    const [rows] = await this.pool.query<GameSettingsRow[]>(
      `SELECT * FROM game_settings WHERE guild_id = ?`,
      [guildId]
    );

    if (rows.length === 0) {
      return null;
    }

    return settingsRowToEntity(rows[0]!);
  }

  async upsertSettings(dto: CreateGameSettingsDto): Promise<GameSettings> {
    await this.pool.query<ResultSetHeader>(
      `INSERT INTO game_settings (guild_id, channel_id, message_id, manager_role_id, bet_fee_percent, min_bet, max_bet)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         channel_id = COALESCE(VALUES(channel_id), channel_id),
         message_id = COALESCE(VALUES(message_id), message_id),
         manager_role_id = COALESCE(VALUES(manager_role_id), manager_role_id),
         bet_fee_percent = COALESCE(VALUES(bet_fee_percent), bet_fee_percent),
         min_bet = COALESCE(VALUES(min_bet), min_bet),
         max_bet = COALESCE(VALUES(max_bet), max_bet),
         updated_at = CURRENT_TIMESTAMP`,
      [
        dto.guildId,
        dto.channelId ?? null,
        dto.messageId ?? null,
        dto.managerRoleId ?? null,
        dto.betFeePercent ?? 20,
        dto.minBet?.toString() ?? '100',
        dto.maxBet?.toString() ?? '10000',
      ]
    );

    const result = await this.findSettingsByGuildId(dto.guildId);
    return result!;
  }

  async updateSettings(
    guildId: string,
    dto: UpdateGameSettingsDto
  ): Promise<GameSettings | null> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (dto.channelId !== undefined) {
      updates.push('channel_id = ?');
      values.push(dto.channelId);
    }
    if (dto.messageId !== undefined) {
      updates.push('message_id = ?');
      values.push(dto.messageId);
    }
    if (dto.managerRoleId !== undefined) {
      updates.push('manager_role_id = ?');
      values.push(dto.managerRoleId);
    }
    if (dto.betFeePercent !== undefined) {
      updates.push('bet_fee_percent = ?');
      values.push(dto.betFeePercent);
    }
    if (dto.minBet !== undefined) {
      updates.push('min_bet = ?');
      values.push(dto.minBet.toString());
    }
    if (dto.maxBet !== undefined) {
      updates.push('max_bet = ?');
      values.push(dto.maxBet.toString());
    }

    if (updates.length === 0) {
      return this.findSettingsByGuildId(guildId);
    }

    values.push(guildId);

    await this.pool.query<ResultSetHeader>(
      `UPDATE game_settings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`,
      values
    );

    return this.findSettingsByGuildId(guildId);
  }

  async updatePanel(
    guildId: string,
    channelId: string | null,
    messageId: string | null
  ): Promise<void> {
    const existing = await this.findSettingsByGuildId(guildId);

    if (existing) {
      await this.pool.query<ResultSetHeader>(
        `UPDATE game_settings SET channel_id = ?, message_id = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`,
        [channelId, messageId, guildId]
      );
    } else {
      await this.pool.query<ResultSetHeader>(
        `INSERT INTO game_settings (guild_id, channel_id, message_id) VALUES (?, ?, ?)`,
        [guildId, channelId, messageId]
      );
    }
  }

  // ========== 게임 ==========

  async createGame(dto: CreateGameDto): Promise<Game> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO games (guild_id, channel_id, title, team_a, team_b, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dto.guildId, dto.channelId, dto.title, dto.teamA, dto.teamB, dto.createdBy]
    );

    const game = await this.findGameById(BigInt(result.insertId));
    return game!;
  }

  async findGameById(gameId: bigint): Promise<Game | null> {
    const [rows] = await this.pool.query<GameRow[]>(
      `SELECT * FROM games WHERE id = ?`,
      [gameId.toString()]
    );

    if (rows.length === 0) {
      return null;
    }

    return gameRowToEntity(rows[0]!);
  }

  async findGameByMessageId(messageId: string): Promise<Game | null> {
    const [rows] = await this.pool.query<GameRow[]>(
      `SELECT * FROM games WHERE message_id = ?`,
      [messageId]
    );

    if (rows.length === 0) {
      return null;
    }

    return gameRowToEntity(rows[0]!);
  }

  async findOpenGamesByGuildId(guildId: string): Promise<Game[]> {
    const [rows] = await this.pool.query<GameRow[]>(
      `SELECT * FROM games WHERE guild_id = ? AND status = 'open' ORDER BY created_at DESC`,
      [guildId]
    );

    return rows.map(gameRowToEntity);
  }

  async updateGameMessageId(gameId: bigint, messageId: string): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE games SET message_id = ? WHERE id = ?`,
      [messageId, gameId.toString()]
    );
  }

  async updateGamePool(gameId: bigint, team: GameTeam, amount: bigint): Promise<void> {
    const column = team === 'A' ? 'team_a_pool' : 'team_b_pool';
    await this.pool.query<ResultSetHeader>(
      `UPDATE games SET ${column} = ${column} + ? WHERE id = ?`,
      [amount.toString(), gameId.toString()]
    );
  }

  async updateGameStatus(gameId: bigint, status: GameStatus): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE games SET status = ? WHERE id = ?`,
      [status, gameId.toString()]
    );
  }

  async finishGame(gameId: bigint, winner: GameTeam): Promise<Game | null> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE games SET status = 'finished', winner = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [winner, gameId.toString()]
    );

    return this.findGameById(gameId);
  }

  async cancelGame(gameId: bigint): Promise<Game | null> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE games SET status = 'cancelled', finished_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [gameId.toString()]
    );

    return this.findGameById(gameId);
  }

  // ========== 배팅 ==========

  async createBet(dto: CreateGameBetDto): Promise<GameBet> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO game_bets (game_id, guild_id, user_id, team, amount)
       VALUES (?, ?, ?, ?, ?)`,
      [dto.gameId.toString(), dto.guildId, dto.userId, dto.team, dto.amount.toString()]
    );

    const bet = await this.findBetById(BigInt(result.insertId));
    return bet!;
  }

  async findBetById(betId: bigint): Promise<GameBet | null> {
    const [rows] = await this.pool.query<GameBetRow[]>(
      `SELECT * FROM game_bets WHERE id = ?`,
      [betId.toString()]
    );

    if (rows.length === 0) {
      return null;
    }

    return betRowToEntity(rows[0]!);
  }

  async findBetByGameAndUser(gameId: bigint, userId: string): Promise<GameBet | null> {
    const [rows] = await this.pool.query<GameBetRow[]>(
      `SELECT * FROM game_bets WHERE game_id = ? AND user_id = ?`,
      [gameId.toString(), userId]
    );

    if (rows.length === 0) {
      return null;
    }

    return betRowToEntity(rows[0]!);
  }

  async findBetsByGameId(gameId: bigint): Promise<GameBet[]> {
    const [rows] = await this.pool.query<GameBetRow[]>(
      `SELECT * FROM game_bets WHERE game_id = ? ORDER BY created_at ASC`,
      [gameId.toString()]
    );

    return rows.map(betRowToEntity);
  }

  async findBetsByGameAndTeam(gameId: bigint, team: GameTeam): Promise<GameBet[]> {
    const [rows] = await this.pool.query<GameBetRow[]>(
      `SELECT * FROM game_bets WHERE game_id = ? AND team = ? ORDER BY created_at ASC`,
      [gameId.toString(), team]
    );

    return rows.map(betRowToEntity);
  }

  async updateBetStatus(betId: bigint, status: GameBetStatus): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE game_bets SET status = ?, settled_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, betId.toString()]
    );
  }

  async settleBet(
    betId: bigint,
    status: GameBetStatus,
    payout: bigint,
    fee: bigint
  ): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE game_bets SET status = ?, payout = ?, fee = ?, settled_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, payout.toString(), fee.toString(), betId.toString()]
    );
  }

  async settleBetsByGame(
    gameId: bigint,
    winnerTeam: GameTeam,
    feePercent: number
  ): Promise<{ winningBets: GameBet[]; losingBets: GameBet[] }> {
    // 이 메서드는 GameService에서 개별 처리하므로 여기서는 간단히 조회만
    const allBets = await this.findBetsByGameId(gameId);
    return {
      winningBets: allBets.filter(b => b.team === winnerTeam),
      losingBets: allBets.filter(b => b.team !== winnerTeam),
    };
  }
}
