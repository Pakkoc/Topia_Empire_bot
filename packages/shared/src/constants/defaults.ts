/**
 * ProBot 기준 기본 설정값
 */
export const XP_DEFAULTS = {
  TEXT_XP_MIN: 15,
  TEXT_XP_MAX: 25,
  TEXT_COOLDOWN_SECONDS: 60,
  TEXT_MAX_PER_COOLDOWN: 1,

  VOICE_XP_MIN: 10,
  VOICE_XP_MAX: 20,
  VOICE_COOLDOWN_SECONDS: 60,
  VOICE_MAX_PER_COOLDOWN: 1,

  HOT_TIME_MULTIPLIER: 1.5,
} as const;

/**
 * 레벨 계산 공식: level^2 * 100
 * 레벨 1 = 100 XP
 * 레벨 2 = 400 XP
 * 레벨 10 = 10000 XP
 */
export const LEVEL_FORMULA = {
  MULTIPLIER: 100,
} as const;
