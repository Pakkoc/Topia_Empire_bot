import type { Result } from '../../shared/types/result';
import type { CurrencySettings } from '../domain/currency-settings';
import type { ChannelCategoryConfig, ChannelCategory } from '../domain/channel-category';
import type { RepositoryError } from '../../xp-system/errors';

export interface CurrencyHotTimeConfig {
  id: number;
  type: 'text' | 'voice' | 'all';
  startTime: string; // HH:MM:SS
  endTime: string;   // HH:MM:SS
  multiplier: number;
  enabled: boolean;
  channelIds?: string[]; // 특정 채널에만 적용 (비어있으면 전체)
}

export interface CurrencyMultiplier {
  id: number;
  guildId: string;
  targetType: 'channel' | 'role';
  targetId: string;
  multiplier: number;
}

export interface CurrencySettingsRepositoryPort {
  findByGuild(guildId: string): Promise<Result<CurrencySettings | null, RepositoryError>>;
  save(settings: CurrencySettings): Promise<Result<void, RepositoryError>>;

  // 제외 설정
  getExcludedChannels(guildId: string): Promise<Result<string[], RepositoryError>>;
  getExcludedRoles(guildId: string): Promise<Result<string[], RepositoryError>>;

  // 핫타임
  getHotTimes(guildId: string, type: 'text' | 'voice' | 'all'): Promise<Result<CurrencyHotTimeConfig[], RepositoryError>>;

  // 배율
  getMultipliers(guildId: string, targetType?: 'channel' | 'role'): Promise<Result<CurrencyMultiplier[], RepositoryError>>;

  // 채널 카테고리
  getChannelCategory(guildId: string, channelId: string): Promise<Result<ChannelCategory, RepositoryError>>;
  getChannelCategories(guildId: string): Promise<Result<ChannelCategoryConfig[], RepositoryError>>;
}
