import type { Result } from '../../shared/types/result';
import type { XpSettings } from '../domain/xp-settings';
import type { RepositoryError } from '../errors';
import type { HotTimeConfig } from '../functions/check-hot-time';

export interface LevelReward {
  id: number;
  guildId: string;
  level: number;
  roleId: string;
  removeOnHigherLevel: boolean;
}

export interface LevelChannel {
  id: number;
  guildId: string;
  level: number;
  channelId: string;
}

export interface XpSettingsRepositoryPort {
  findByGuild(guildId: string): Promise<Result<XpSettings | null, RepositoryError>>;
  save(settings: XpSettings): Promise<Result<void, RepositoryError>>;
  getExcludedChannels(guildId: string): Promise<Result<string[], RepositoryError>>;
  getExcludedRoles(guildId: string): Promise<Result<string[], RepositoryError>>;
  getHotTimes(guildId: string, type: 'text' | 'voice' | 'all'): Promise<Result<HotTimeConfig[], RepositoryError>>;
  getLevelRewards(guildId: string): Promise<Result<LevelReward[], RepositoryError>>;
  getLevelChannels(guildId: string): Promise<Result<LevelChannel[], RepositoryError>>;
}
