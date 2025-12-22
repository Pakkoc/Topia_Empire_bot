// Domain
export * from './domain';

// Errors - RepositoryError는 xp-system에서 이미 export하므로 CurrencyError만 export
export type { CurrencyError } from './errors';

// Port
export * from './port';

// Functions - 중복 이름은 Currency 접두사로 re-export
export {
  checkCooldown as checkCurrencyCooldown,
  type CooldownResult as CurrencyCooldownResult,
} from './functions/check-cooldown';

export {
  checkDailyLimit,
  calculateActualEarning,
  type DailyLimitResult,
} from './functions/check-daily-limit';

export {
  generateRandomCurrency,
  applyMultiplier as applyCurrencyMultiplier,
} from './functions/generate-random-currency';

export {
  checkHotTime as checkCurrencyHotTime,
  formatTimeForHotTime as formatTimeForCurrencyHotTime,
  type HotTimeResult as CurrencyHotTimeResult,
} from './functions/check-hot-time';

export { getChannelCategoryMultiplier } from './functions/calculate-channel-multiplier';

// Service
export * from './service';
