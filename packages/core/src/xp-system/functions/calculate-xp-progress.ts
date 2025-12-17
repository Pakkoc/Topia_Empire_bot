import { calculateLevel, calculateXpForLevel } from './calculate-level';

export interface XpProgress {
  currentXp: number;
  currentLevel: number;
  xpInCurrentLevel: number;
  xpRequiredForNextLevel: number;
  progressPercentage: number;
}

/**
 * XP 진행 상황 계산 (순수함수)
 */
export function calculateXpProgress(totalXp: number): XpProgress {
  const currentLevel = calculateLevel(totalXp);
  const currentLevelXp = calculateXpForLevel(currentLevel);
  const nextLevelXp = calculateXpForLevel(currentLevel + 1);

  const xpInCurrentLevel = totalXp - currentLevelXp;
  const xpRequiredForNextLevel = nextLevelXp - currentLevelXp;
  const progressPercentage = xpRequiredForNextLevel > 0
    ? Math.floor((xpInCurrentLevel / xpRequiredForNextLevel) * 100)
    : 100;

  return {
    currentXp: totalXp,
    currentLevel,
    xpInCurrentLevel,
    xpRequiredForNextLevel,
    progressPercentage,
  };
}
