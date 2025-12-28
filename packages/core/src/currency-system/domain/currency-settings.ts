import { CURRENCY_DEFAULTS } from '@topia/shared';

/**
 * 길드별 화폐 설정
 */
export interface CurrencySettings {
  guildId: string;
  enabled: boolean;

  // 화폐 이름 (커스터마이징)
  topyName: string;
  rubyName: string;

  // 텍스트 보상 설정
  textEarnEnabled: boolean;
  textEarnMin: number;
  textEarnMax: number;
  textMinLength: number;
  textCooldownSeconds: number;
  textMaxPerCooldown: number;
  textDailyLimit: number;

  // 음성 보상 설정
  voiceEarnEnabled: boolean;
  voiceEarnMin: number;
  voiceEarnMax: number;
  voiceCooldownSeconds: number;
  voiceDailyLimit: number;

  // 이체 설정
  minTransferTopy: number;
  minTransferRuby: number;
  transferFeeTopyPercent: number;
  transferFeeRubyPercent: number;

  // 상점 수수료 설정
  shopFeeTopyPercent: number;
  shopFeeRubyPercent: number;

  // 월말 세금 설정
  monthlyTaxEnabled: boolean;
  monthlyTaxPercent: number;

  // 상점 패널 설정
  shopChannelId: string | null;
  shopMessageId: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export function createDefaultCurrencySettings(guildId: string): CurrencySettings {
  const now = new Date();
  return {
    guildId,
    enabled: true,

    topyName: '토피',
    rubyName: '루비',

    textEarnEnabled: true,
    textEarnMin: CURRENCY_DEFAULTS.TEXT_EARN_MIN,
    textEarnMax: CURRENCY_DEFAULTS.TEXT_EARN_MAX,
    textMinLength: CURRENCY_DEFAULTS.TEXT_MIN_LENGTH,
    textCooldownSeconds: CURRENCY_DEFAULTS.TEXT_COOLDOWN_SECONDS,
    textMaxPerCooldown: CURRENCY_DEFAULTS.TEXT_MAX_PER_COOLDOWN,
    textDailyLimit: CURRENCY_DEFAULTS.TEXT_DAILY_LIMIT,

    voiceEarnEnabled: true,
    voiceEarnMin: CURRENCY_DEFAULTS.VOICE_EARN_MIN,
    voiceEarnMax: CURRENCY_DEFAULTS.VOICE_EARN_MAX,
    voiceCooldownSeconds: CURRENCY_DEFAULTS.VOICE_COOLDOWN_SECONDS,
    voiceDailyLimit: CURRENCY_DEFAULTS.VOICE_DAILY_LIMIT,

    minTransferTopy: CURRENCY_DEFAULTS.MIN_TRANSFER_TOPY,
    minTransferRuby: CURRENCY_DEFAULTS.MIN_TRANSFER_RUBY,
    transferFeeTopyPercent: CURRENCY_DEFAULTS.TRANSFER_FEE_TOPY_PERCENT,
    transferFeeRubyPercent: CURRENCY_DEFAULTS.TRANSFER_FEE_RUBY_PERCENT,

    shopFeeTopyPercent: CURRENCY_DEFAULTS.SHOP_FEE_TOPY_PERCENT,
    shopFeeRubyPercent: CURRENCY_DEFAULTS.SHOP_FEE_RUBY_PERCENT,

    monthlyTaxEnabled: CURRENCY_DEFAULTS.MONTHLY_TAX_ENABLED,
    monthlyTaxPercent: CURRENCY_DEFAULTS.MONTHLY_TAX_PERCENT,

    shopChannelId: null,
    shopMessageId: null,

    createdAt: now,
    updatedAt: now,
  };
}
