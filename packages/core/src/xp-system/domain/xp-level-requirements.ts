/**
 * XP 타입 (텍스트 또는 음성)
 */
export type XpType = 'text' | 'voice';

/**
 * 레벨별 필요 XP 설정
 */
export interface LevelRequirement {
  guildId: string;
  type: XpType;
  level: number;
  requiredXp: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 레벨 요구사항 맵 (레벨 -> 필요 XP)
 */
export type LevelRequirementsMap = Map<number, number>;

/**
 * 레벨 요구사항 배열을 맵으로 변환
 */
export function toLevelRequirementsMap(requirements: LevelRequirement[]): LevelRequirementsMap {
  const map = new Map<number, number>();
  for (const req of requirements) {
    map.set(req.level, req.requiredXp);
  }
  return map;
}
