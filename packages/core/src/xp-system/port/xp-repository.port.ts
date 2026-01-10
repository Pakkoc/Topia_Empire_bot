import type { Result } from '../../shared/types/result';
import type { UserXp } from '../domain/user-xp';
import type { XpType } from '../domain/xp-level-requirements';
import type { RepositoryError } from '../errors';

export interface XpRepositoryPort {
  findByUser(guildId: string, userId: string): Promise<Result<UserXp | null, RepositoryError>>;
  save(userXp: UserXp): Promise<Result<void, RepositoryError>>;
  saveBulk(users: UserXp[]): Promise<Result<void, RepositoryError>>;
  getLeaderboard(guildId: string, limit: number, offset?: number, type?: XpType): Promise<Result<UserXp[], RepositoryError>>;
  getUserRank(guildId: string, userId: string, type?: XpType): Promise<Result<number | null, RepositoryError>>;
  getAllByGuild(guildId: string): Promise<Result<UserXp[], RepositoryError>>;

  /**
   * XP 데이터 생성 또는 업데이트 (없으면 생성, 있으면 무시)
   */
  upsert(userXp: UserXp): Promise<Result<UserXp, RepositoryError>>;
}
