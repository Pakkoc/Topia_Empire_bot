/**
 * 시간 추상화 Port - 테스트 시 FakeClock으로 교체 가능
 */
export interface ClockPort {
  now(): Date;
}
