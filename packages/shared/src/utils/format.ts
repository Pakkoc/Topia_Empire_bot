/**
 * XP를 포맷팅 (1000 이상이면 1.2K 형식)
 */
export function formatXp(xp: number): string {
  if (xp >= 1000000) {
    return `${(xp / 1000000).toFixed(1)}M`;
  }
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return xp.toString();
}

/**
 * 초를 분:초 형식으로 포맷팅
 */
export function formatCooldown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins > 0) {
    return `${mins}분 ${secs}초`;
  }
  return `${secs}초`;
}

/**
 * 퍼센트 포맷팅
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}
