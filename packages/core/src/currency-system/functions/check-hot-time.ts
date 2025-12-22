import type { CurrencyHotTimeConfig } from '../port/currency-settings-repository.port';

export interface HotTimeResult {
  isActive: boolean;
  multiplier: number;
  hotTimeId?: number;
}

/**
 * 핫타임 체크 (순수함수)
 * @param hotTimes - 핫타임 설정 목록
 * @param currentTime - 현재 시간 (HH:MM:SS 형식)
 * @param channelId - 현재 채널 ID (채널 특정 핫타임 체크용)
 */
export function checkHotTime(
  hotTimes: CurrencyHotTimeConfig[],
  currentTime: string,
  channelId?: string
): HotTimeResult {
  // 활성화된 핫타임만 필터링
  const enabledHotTimes = hotTimes.filter(ht => ht.enabled);

  for (const hotTime of enabledHotTimes) {
    // 채널 조건 체크 (채널 목록이 있으면 해당 채널만)
    if (hotTime.channelIds && hotTime.channelIds.length > 0) {
      if (!channelId || !hotTime.channelIds.includes(channelId)) {
        continue;
      }
    }

    // 시간 범위 체크
    if (isTimeInRange(currentTime, hotTime.startTime, hotTime.endTime)) {
      return {
        isActive: true,
        multiplier: hotTime.multiplier,
        hotTimeId: hotTime.id,
      };
    }
  }

  return {
    isActive: false,
    multiplier: 1,
  };
}

/**
 * 시간 범위 체크
 */
function isTimeInRange(current: string, start: string, end: string): boolean {
  const currentMinutes = timeToMinutes(current);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  // 자정을 넘어가는 경우 (예: 22:00 ~ 02:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  // 일반적인 경우
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * HH:MM:SS 형식을 분 단위로 변환
 */
function timeToMinutes(time: string): number {
  const parts = time.split(':');
  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  return hours * 60 + minutes;
}

/**
 * Date를 HH:MM:SS 형식으로 변환
 */
export function formatTimeForHotTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
