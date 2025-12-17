import { LEVEL_FORMULA } from '@topia/shared';

/**
 * XP로 레벨 계산
 * 공식: level = floor(sqrt(xp / 100))
 */
export function calculateLevel(xp: number): number {
  if (xp < 0) return 0;
  return Math.floor(Math.sqrt(xp / LEVEL_FORMULA.MULTIPLIER));
}

/**
 * 특정 레벨에 필요한 총 XP 계산
 * 공식: xp = level^2 * 100
 */
export function calculateXpForLevel(level: number): number {
  if (level < 0) return 0;
  return level * level * LEVEL_FORMULA.MULTIPLIER;
}
