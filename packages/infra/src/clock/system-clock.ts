import type { ClockPort } from '@topia/core';

/**
 * 실제 시스템 시간을 반환하는 Clock 구현체
 */
export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}

/**
 * 테스트용 가짜 Clock
 */
export class FakeClock implements ClockPort {
  private currentTime: Date;

  constructor(initialTime: Date = new Date()) {
    this.currentTime = initialTime;
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  setTime(time: Date): void {
    this.currentTime = time;
  }

  advance(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }

  advanceSeconds(seconds: number): void {
    this.advance(seconds * 1000);
  }

  advanceMinutes(minutes: number): void {
    this.advance(minutes * 60 * 1000);
  }
}
