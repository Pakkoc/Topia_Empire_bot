import type { Result } from '../../shared/types/result';
import type { UserXp } from '../domain/user-xp';
import type { RepositoryError } from '../errors';

export interface XpRepositoryPort {
  findByUser(guildId: string, userId: string): Promise<Result<UserXp | null, RepositoryError>>;
  save(userXp: UserXp): Promise<Result<void, RepositoryError>>;
  getLeaderboard(guildId: string, limit: number, offset?: number): Promise<Result<UserXp[], RepositoryError>>;
  getUserRank(guildId: string, userId: string): Promise<Result<number | null, RepositoryError>>;
}
