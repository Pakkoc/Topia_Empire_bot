export interface HotTimeConfig {
  id?: number;
  startTime: string; // "HH:mm" format
  endTime: string;   // "HH:mm" format
  multiplier: number;
  enabled: boolean;
  channelIds?: string[]; // 적용 채널 목록 (비어있으면 모든 채널)
}

export interface HotTimeResult {
  isActive: boolean;
  multiplier: number;
}

/**
 * 현재 시간이 핫타임인지 체크 (순수함수)
 * @param configs - 핫타임 설정 목록
 * @param currentTime - 현재 시간 "HH:mm" format (주입)
 * @param channelId - 현재 채널 ID (optional, 채널 조건 체크용)
 */
export function checkHotTime(configs: HotTimeConfig[], currentTime: string, channelId?: string): HotTimeResult {
  const currentParts = currentTime.split(':').map(Number);
  const currentHour = currentParts[0] ?? 0;
  const currentMinute = currentParts[1] ?? 0;
  const currentMinutes = currentHour * 60 + currentMinute;

  for (const config of configs) {
    if (!config.enabled) continue;

    // 채널 조건 체크: channelIds가 비어있으면 모든 채널, 있으면 해당 채널만
    if (channelId && config.channelIds && config.channelIds.length > 0) {
      if (!config.channelIds.includes(channelId)) {
        continue;
      }
    }

    const startParts = config.startTime.split(':').map(Number);
    const endParts = config.endTime.split(':').map(Number);
    const startHour = startParts[0] ?? 0;
    const startMinute = startParts[1] ?? 0;
    const endHour = endParts[0] ?? 0;
    const endMinute = endParts[1] ?? 0;

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // 자정을 넘기지 않는 경우
    if (startMinutes <= endMinutes) {
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return { isActive: true, multiplier: config.multiplier };
      }
    } else {
      // 자정을 넘기는 경우 (예: 22:00 ~ 02:00)
      if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
        return { isActive: true, multiplier: config.multiplier };
      }
    }
  }

  return { isActive: false, multiplier: 1 };
}

/**
 * Date를 한국 시간(KST) 기준 "HH:mm" 형식으로 변환
 */
export function formatTimeForHotTime(date: Date): string {
  const koreaTime = date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // "HH:MM" 또는 "HH시 MM분" 형식을 "HH:mm"으로 정규화
  const match = koreaTime.match(/(\d{2}):?(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  // fallback
  return koreaTime.replace(/[^0-9:]/g, '');
}
