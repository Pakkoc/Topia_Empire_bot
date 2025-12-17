/**
 * 레벨 보상 역할
 */
export interface LevelReward {
  id: number;
  guildId: string;
  level: number;
  roleId: string;
  removeOnHigherLevel: boolean;
  createdAt: Date;
}
