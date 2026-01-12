import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type {
  GameRepositoryPort,
  GameSettings,
  CreateGameSettingsDto,
  UpdateGameSettingsDto,
  Game,
  CreateGameDto,
  GameStatus,
  GameResult,
  GameParticipant,
  CreateParticipantDto,
  ParticipantStatus,
  GameCategory,
  CreateCategoryDto,
  UpdateCategoryDto,
  RankRewards,
} from '@topia/core';
import { DEFAULT_RANK_REWARDS } from '@topia/core';

// ========== Row Types ==========

interface GameSettingsRow extends RowDataPacket {
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  manager_role_id: string | null;
  entry_fee: string;
  rank_rewards: string | null; // JSON string
  created_at: Date;
  updated_at: Date;
}

interface GameRow extends RowDataPacket {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  category_id: number | null;
  title: string;
  team_count: number;
  entry_fee: string;
  total_pool: string;
  status: GameStatus;
  created_by: string;
  created_at: Date;
  finished_at: Date | null;
  max_players_per_team: number | null;
  // 일회성 커스텀 설정
  custom_rank_rewards: string | null; // JSON string
  custom_winner_takes_all: number | null; // 0 or 1 or null
  custom_entry_fee: string | null;
}

interface GameParticipantRow extends RowDataPacket {
  id: string;
  game_id: string;
  guild_id: string;
  user_id: string;
  team_number: number | null;
  entry_fee_paid: string;
  reward: string;
  status: ParticipantStatus;
  created_at: Date;
  settled_at: Date | null;
}

interface GameCategoryRow extends RowDataPacket {
  id: number;
  guild_id: string;
  name: string;
  team_count: number;
  enabled: number;
  max_players_per_team: number | null;
  rank_rewards: string | null; // JSON string
  winner_takes_all: number;
  created_at: Date;
}

interface GameResultRow extends RowDataPacket {
  id: string;
  game_id: string;
  team_number: number;
  rank: number;
  reward_percent: number;
  total_reward: string;
  created_at: Date;
}

// ========== Row to Entity ==========

function parseRankRewards(json: string | object | null): RankRewards {
  if (!json) return { ...DEFAULT_RANK_REWARDS };
  try {
    // MySQL JSON 타입은 이미 파싱된 객체로 반환될 수 있음
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    // Convert string keys to numbers
    const result: RankRewards = {};
    for (const [key, value] of Object.entries(parsed)) {
      result[parseInt(key, 10)] = value as number;
    }
    return result;
  } catch {
    return { ...DEFAULT_RANK_REWARDS };
  }
}

function settingsRowToEntity(row: GameSettingsRow): GameSettings {
  return {
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    managerRoleId: row.manager_role_id,
    entryFee: BigInt(row.entry_fee),
    rankRewards: parseRankRewards(row.rank_rewards),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseNullableRankRewards(json: string | object | null): RankRewards | null {
  if (!json) return null;
  try {
    // MySQL JSON 타입은 이미 파싱된 객체로 반환될 수 있음
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    const result: RankRewards = {};
    for (const [key, value] of Object.entries(parsed)) {
      result[parseInt(key, 10)] = value as number;
    }
    return result;
  } catch {
    return null;
  }
}

function gameRowToEntity(row: GameRow): Game {
  return {
    id: BigInt(row.id),
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    categoryId: row.category_id,
    title: row.title,
    teamCount: row.team_count,
    entryFee: BigInt(row.entry_fee),
    totalPool: BigInt(row.total_pool),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    maxPlayersPerTeam: row.max_players_per_team,
    // 일회성 커스텀 설정
    customRankRewards: parseNullableRankRewards(row.custom_rank_rewards),
    customWinnerTakesAll: row.custom_winner_takes_all === null ? null : row.custom_winner_takes_all === 1,
    customEntryFee: row.custom_entry_fee ? BigInt(row.custom_entry_fee) : null,
  };
}

function participantRowToEntity(row: GameParticipantRow): GameParticipant {
  return {
    id: BigInt(row.id),
    gameId: BigInt(row.game_id),
    guildId: row.guild_id,
    userId: row.user_id,
    teamNumber: row.team_number,
    entryFeePaid: BigInt(row.entry_fee_paid),
    reward: BigInt(row.reward),
    status: row.status,
    createdAt: row.created_at,
    settledAt: row.settled_at,
  };
}

function categoryRowToEntity(row: GameCategoryRow): GameCategory {
  return {
    id: row.id,
    guildId: row.guild_id,
    name: row.name,
    teamCount: row.team_count,
    enabled: row.enabled === 1,
    maxPlayersPerTeam: row.max_players_per_team,
    rankRewards: row.rank_rewards ? parseRankRewards(row.rank_rewards) : null,
    winnerTakesAll: row.winner_takes_all === 1,
    createdAt: row.created_at,
  };
}

function resultRowToEntity(row: GameResultRow): GameResult {
  return {
    id: BigInt(row.id),
    gameId: BigInt(row.game_id),
    teamNumber: row.team_number,
    rank: row.rank,
    rewardPercent: row.reward_percent,
    totalReward: BigInt(row.total_reward),
    createdAt: row.created_at,
  };
}

// ========== Repository ==========

export class GameRepository implements GameRepositoryPort {
  constructor(private readonly pool: Pool) {}

  // ========== 내전 설정 ==========

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
    const rankRewardsJson = dto.rankRewards
      ? JSON.stringify(dto.rankRewards)
      : JSON.stringify(DEFAULT_RANK_REWARDS);

    await this.pool.query<ResultSetHeader>(
      `INSERT INTO game_settings (guild_id, channel_id, message_id, manager_role_id, entry_fee, rank_rewards)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         channel_id = COALESCE(VALUES(channel_id), channel_id),
         message_id = COALESCE(VALUES(message_id), message_id),
         manager_role_id = COALESCE(VALUES(manager_role_id), manager_role_id),
         entry_fee = COALESCE(VALUES(entry_fee), entry_fee),
         rank_rewards = COALESCE(VALUES(rank_rewards), rank_rewards),
         updated_at = CURRENT_TIMESTAMP`,
      [
        dto.guildId,
        dto.channelId ?? null,
        dto.messageId ?? null,
        dto.managerRoleId ?? null,
        dto.entryFee?.toString() ?? '100',
        rankRewardsJson,
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
    if (dto.entryFee !== undefined) {
      updates.push('entry_fee = ?');
      values.push(dto.entryFee.toString());
    }
    if (dto.rankRewards !== undefined) {
      updates.push('rank_rewards = ?');
      values.push(JSON.stringify(dto.rankRewards));
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

  // ========== 카테고리 ==========

  async createCategory(dto: CreateCategoryDto): Promise<GameCategory> {
    const rankRewardsJson = dto.rankRewards ? JSON.stringify(dto.rankRewards) : null;

    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO game_categories (guild_id, name, team_count, max_players_per_team, rank_rewards, winner_takes_all)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        dto.guildId,
        dto.name,
        dto.teamCount,
        dto.maxPlayersPerTeam ?? null,
        rankRewardsJson,
        dto.winnerTakesAll ? 1 : 0,
      ]
    );

    const category = await this.findCategoryById(result.insertId);
    return category!;
  }

  async findCategoryById(categoryId: number): Promise<GameCategory | null> {
    const [rows] = await this.pool.query<GameCategoryRow[]>(
      `SELECT * FROM game_categories WHERE id = ?`,
      [categoryId]
    );

    if (rows.length === 0) {
      return null;
    }

    return categoryRowToEntity(rows[0]!);
  }

  async findCategoriesByGuildId(guildId: string): Promise<GameCategory[]> {
    const [rows] = await this.pool.query<GameCategoryRow[]>(
      `SELECT * FROM game_categories WHERE guild_id = ? ORDER BY name ASC`,
      [guildId]
    );

    return rows.map(categoryRowToEntity);
  }

  async findEnabledCategoriesByGuildId(guildId: string): Promise<GameCategory[]> {
    const [rows] = await this.pool.query<GameCategoryRow[]>(
      `SELECT * FROM game_categories WHERE guild_id = ? AND enabled = 1 ORDER BY name ASC`,
      [guildId]
    );

    return rows.map(categoryRowToEntity);
  }

  async updateCategory(categoryId: number, dto: UpdateCategoryDto): Promise<GameCategory | null> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (dto.name !== undefined) {
      updates.push('name = ?');
      values.push(dto.name);
    }
    if (dto.teamCount !== undefined) {
      updates.push('team_count = ?');
      values.push(dto.teamCount);
    }
    if (dto.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(dto.enabled ? 1 : 0);
    }
    if (dto.maxPlayersPerTeam !== undefined) {
      updates.push('max_players_per_team = ?');
      values.push(dto.maxPlayersPerTeam);
    }
    if (dto.rankRewards !== undefined) {
      updates.push('rank_rewards = ?');
      values.push(dto.rankRewards ? JSON.stringify(dto.rankRewards) : null);
    }
    if (dto.winnerTakesAll !== undefined) {
      updates.push('winner_takes_all = ?');
      values.push(dto.winnerTakesAll ? 1 : 0);
    }

    if (updates.length === 0) {
      return this.findCategoryById(categoryId);
    }

    values.push(categoryId);

    await this.pool.query<ResultSetHeader>(
      `UPDATE game_categories SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findCategoryById(categoryId);
  }

  async deleteCategory(categoryId: number): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `DELETE FROM game_categories WHERE id = ?`,
      [categoryId]
    );
  }

  // ========== 게임 ==========

  async createGame(dto: CreateGameDto): Promise<Game> {
    const customRankRewardsJson = dto.customRankRewards
      ? JSON.stringify(dto.customRankRewards)
      : null;

    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO games (guild_id, channel_id, category_id, title, team_count, entry_fee, created_by, max_players_per_team, custom_rank_rewards, custom_winner_takes_all, custom_entry_fee)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.guildId,
        dto.channelId,
        dto.categoryId ?? null,
        dto.title,
        dto.teamCount,
        dto.entryFee.toString(),
        dto.createdBy,
        dto.maxPlayersPerTeam ?? null,
        customRankRewardsJson,
        dto.customWinnerTakesAll === undefined || dto.customWinnerTakesAll === null
          ? null
          : dto.customWinnerTakesAll ? 1 : 0,
        dto.customEntryFee?.toString() ?? null,
      ]
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
      `SELECT * FROM games WHERE guild_id = ? AND status IN ('open', 'team_assign', 'in_progress') ORDER BY created_at DESC`,
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

  async updateTotalPool(gameId: bigint, amount: bigint): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE games SET total_pool = total_pool + ? WHERE id = ?`,
      [amount.toString(), gameId.toString()]
    );
  }

  async updateGameStatus(gameId: bigint, status: GameStatus): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE games SET status = ? WHERE id = ?`,
      [status, gameId.toString()]
    );
  }

  async finishGame(gameId: bigint): Promise<Game | null> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE games SET status = 'finished', finished_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [gameId.toString()]
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

  // ========== 참가자 ==========

  async createParticipant(dto: CreateParticipantDto): Promise<GameParticipant> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO game_participants (game_id, guild_id, user_id, entry_fee_paid)
       VALUES (?, ?, ?, ?)`,
      [dto.gameId.toString(), dto.guildId, dto.userId, dto.entryFeePaid.toString()]
    );

    const participant = await this.findParticipantById(BigInt(result.insertId));
    return participant!;
  }

  async findParticipantById(participantId: bigint): Promise<GameParticipant | null> {
    const [rows] = await this.pool.query<GameParticipantRow[]>(
      `SELECT * FROM game_participants WHERE id = ?`,
      [participantId.toString()]
    );

    if (rows.length === 0) {
      return null;
    }

    return participantRowToEntity(rows[0]!);
  }

  async findParticipantByGameAndUser(gameId: bigint, userId: string): Promise<GameParticipant | null> {
    const [rows] = await this.pool.query<GameParticipantRow[]>(
      `SELECT * FROM game_participants WHERE game_id = ? AND user_id = ?`,
      [gameId.toString(), userId]
    );

    if (rows.length === 0) {
      return null;
    }

    return participantRowToEntity(rows[0]!);
  }

  async findParticipantsByGameId(gameId: bigint): Promise<GameParticipant[]> {
    const [rows] = await this.pool.query<GameParticipantRow[]>(
      `SELECT * FROM game_participants WHERE game_id = ? ORDER BY created_at ASC`,
      [gameId.toString()]
    );

    return rows.map(participantRowToEntity);
  }

  async findParticipantsByTeam(gameId: bigint, teamNumber: number): Promise<GameParticipant[]> {
    const [rows] = await this.pool.query<GameParticipantRow[]>(
      `SELECT * FROM game_participants WHERE game_id = ? AND team_number = ? ORDER BY created_at ASC`,
      [gameId.toString(), teamNumber]
    );

    return rows.map(participantRowToEntity);
  }

  async assignTeam(participantId: bigint, teamNumber: number): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE game_participants SET team_number = ?, status = 'assigned' WHERE id = ?`,
      [teamNumber, participantId.toString()]
    );
  }

  async assignTeamBulk(participantIds: bigint[], teamNumber: number): Promise<void> {
    if (participantIds.length === 0) return;

    const ids = participantIds.map(id => id.toString());
    await this.pool.query<ResultSetHeader>(
      `UPDATE game_participants SET team_number = ?, status = 'assigned' WHERE id IN (?)`,
      [teamNumber, ids]
    );
  }

  async unassignTeam(participantId: bigint): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE game_participants SET team_number = NULL, status = 'registered' WHERE id = ?`,
      [participantId.toString()]
    );
  }

  async updateParticipantStatus(participantId: bigint, status: ParticipantStatus): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE game_participants SET status = ? WHERE id = ?`,
      [status, participantId.toString()]
    );
  }

  async settleParticipant(participantId: bigint, reward: bigint): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `UPDATE game_participants SET reward = ?, status = 'rewarded', settled_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [reward.toString(), participantId.toString()]
    );
  }

  async deleteParticipant(participantId: bigint): Promise<void> {
    await this.pool.query<ResultSetHeader>(
      `DELETE FROM game_participants WHERE id = ?`,
      [participantId.toString()]
    );
  }

  // ========== 결과 ==========

  async saveGameResult(
    gameId: bigint,
    teamNumber: number,
    rank: number,
    rewardPercent: number,
    totalReward: bigint
  ): Promise<GameResult> {
    const [result] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO game_results (game_id, team_number, \`rank\`, reward_percent, total_reward)
       VALUES (?, ?, ?, ?, ?)`,
      [gameId.toString(), teamNumber, rank, rewardPercent, totalReward.toString()]
    );

    const [rows] = await this.pool.query<GameResultRow[]>(
      `SELECT * FROM game_results WHERE id = ?`,
      [result.insertId]
    );

    return resultRowToEntity(rows[0]!);
  }

  async findGameResults(gameId: bigint): Promise<GameResult[]> {
    const [rows] = await this.pool.query<GameResultRow[]>(
      `SELECT * FROM game_results WHERE game_id = ? ORDER BY rank ASC`,
      [gameId.toString()]
    );

    return rows.map(resultRowToEntity);
  }
}
