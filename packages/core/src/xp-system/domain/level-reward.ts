import type { XpType } from './xp-level-requirements';

/**
 * 레벨 보상 역할
 */
export interface LevelReward {
  id: number;
  guildId: string;
  type: XpType;
  level: number;
  roleId: string;
  removeOnHigherLevel: boolean;
  createdAt: Date;
}
