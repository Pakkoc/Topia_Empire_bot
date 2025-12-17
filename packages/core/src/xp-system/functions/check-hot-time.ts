export interface HotTimeConfig {
  startTime: string; // "HH:mm" format
  endTime: string;   // "HH:mm" format
  multiplier: number;
  enabled: boolean;
}

export interface HotTimeResult {
  isActive: boolean;
  multiplier: number;
}

/**
 * 현재 시간이 핫타임인지 체크 (순수함수)
 * @param configs - 핫타임 설정 목록
 * @param currentTime - 현재 시간 "HH:mm" format (주입)
 */
export function checkHotTime(configs: HotTimeConfig[], currentTime: string): HotTimeResult {
  const [currentHour, currentMinute] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;

  for (const config of configs) {
    if (!config.enabled) continue;

    const [startHour, startMinute] = config.startTime.split(':').map(Number);
    const [endHour, endMinute] = config.endTime.split(':').map(Number);

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
 * Date를 "HH:mm" 형식으로 변환
 */
export function formatTimeForHotTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
