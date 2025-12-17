import type { Result } from '../../shared/types/result';
import type { XpSettings } from '../domain/xp-settings';
import type { RepositoryError } from '../errors';

export interface XpSettingsRepositoryPort {
  findByGuild(guildId: string): Promise<Result<XpSettings | null, RepositoryError>>;
  save(settings: XpSettings): Promise<Result<void, RepositoryError>>;
  getExcludedChannels(guildId: string): Promise<Result<string[], RepositoryError>>;
  getExcludedRoles(guildId: string): Promise<Result<string[], RepositoryError>>;
}
