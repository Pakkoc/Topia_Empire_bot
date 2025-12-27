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

/**
 * 화폐 시스템 기본 설정값
 */
export const CURRENCY_DEFAULTS = {
  // 텍스트 보상
  TEXT_EARN_MIN: 1,
  TEXT_EARN_MAX: 1,
  TEXT_MIN_LENGTH: 15,
  TEXT_COOLDOWN_SECONDS: 30,
  TEXT_MAX_PER_COOLDOWN: 1,
  TEXT_DAILY_LIMIT: 300,

  // 음성 보상
  VOICE_EARN_MIN: 1,
  VOICE_EARN_MAX: 1,
  VOICE_COOLDOWN_SECONDS: 60,
  VOICE_DAILY_LIMIT: 2000,

  // 이체 설정
  MIN_TRANSFER_TOPY: 100,
  MIN_TRANSFER_RUBY: 1,
  TRANSFER_FEE_TOPY_PERCENT: 1.2,
  TRANSFER_FEE_RUBY_PERCENT: 0,

  // 상점 수수료 설정
  SHOP_FEE_TOPY_PERCENT: 0,
  SHOP_FEE_RUBY_PERCENT: 0,

  // 채널 카테고리별 배율
  CHANNEL_CATEGORY_MULTIPLIERS: {
    normal: 1.0,    // 일반 통화방
    music: 0.1,     // 음감방
    afk: 0.1,       // 일반 잠수방
    premium: 1.0,   // 프리미엄 잠수방
  },

  HOT_TIME_MULTIPLIER: 1.5,
} as const;
