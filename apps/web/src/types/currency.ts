import { z } from "zod";

// Currency Settings
export const currencySettingsSchema = z.object({
  guildId: z.string(),
  enabled: z.boolean(),
  topyName: z.string().min(1).max(20),
  rubyName: z.string().min(1).max(20),
  topyManagerEnabled: z.boolean(),
  rubyManagerEnabled: z.boolean(),
  textEarnEnabled: z.boolean(),
  textEarnMin: z.number().min(0).max(10000),
  textEarnMax: z.number().min(0).max(10000),
  textMinLength: z.number().min(0).max(1000),
  textCooldownSeconds: z.number().min(0).max(3600),
  textMaxPerCooldown: z.number().min(1).max(100),
  textDailyLimit: z.number().min(0).max(1000000),
  voiceEarnEnabled: z.boolean(),
  voiceEarnMin: z.number().min(0).max(10000),
  voiceEarnMax: z.number().min(0).max(10000),
  voiceCooldownSeconds: z.number().min(0).max(3600),
  voiceDailyLimit: z.number().min(0).max(1000000),
  minTransferTopy: z.number().min(0).max(1000000),
  minTransferRuby: z.number().min(0).max(1000000),
  transferFeeTopyPercent: z.number().min(0).max(100),
  transferFeeRubyPercent: z.number().min(0).max(100),
  shopFeeTopyPercent: z.number().min(0).max(100),
  shopFeeRubyPercent: z.number().min(0).max(100),
  shopChannelId: z.string().nullable().optional(),
  shopMessageId: z.string().nullable().optional(),
  // 월말 세금 설정
  monthlyTaxEnabled: z.boolean(),
  monthlyTaxPercent: z.number().min(0).max(100),
  // 화폐 거래 알림 채널
  currencyLogChannelId: z.string().nullable().optional(),
  // 아이템 관리자 역할 및 로그 채널
  itemManagerRoleId: z.string().nullable().optional(),
  itemLogChannelId: z.string().nullable().optional(),
  // 은행 이름
  bankName: z.string().min(1).max(20).optional(),
  // 은행 패널
  bankPanelChannelId: z.string().nullable().optional(),
  bankPanelMessageId: z.string().nullable().optional(),
  // 국고 관리자 역할
  treasuryManagerRoleId: z.string().nullable().optional(),
});

export type CurrencySettings = z.infer<typeof currencySettingsSchema>;

export const updateCurrencySettingsSchema = currencySettingsSchema.partial().omit({ guildId: true });
export type UpdateCurrencySettings = z.infer<typeof updateCurrencySettingsSchema>;

// Currency Hot Time
export const currencyHotTimeSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  type: z.enum(["text", "voice", "all"]),
  startTime: z.string(), // HH:mm format
  endTime: z.string(), // HH:mm format
  multiplier: z.number().min(1).max(10),
  enabled: z.boolean(),
  channelIds: z.array(z.string()).optional(),
});

export type CurrencyHotTime = z.infer<typeof currencyHotTimeSchema>;

export const createCurrencyHotTimeSchema = currencyHotTimeSchema.omit({ id: true, guildId: true });
export type CreateCurrencyHotTime = z.infer<typeof createCurrencyHotTimeSchema>;

export const updateCurrencyHotTimeSchema = currencyHotTimeSchema.partial().omit({ id: true, guildId: true });
export type UpdateCurrencyHotTime = z.infer<typeof updateCurrencyHotTimeSchema>;

// Currency Exclusion
export const currencyExclusionSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  targetType: z.enum(["channel", "role"]),
  targetId: z.string(),
});

export type CurrencyExclusion = z.infer<typeof currencyExclusionSchema>;

export const createCurrencyExclusionSchema = currencyExclusionSchema.omit({ id: true, guildId: true });
export type CreateCurrencyExclusion = z.infer<typeof createCurrencyExclusionSchema>;

// Currency Multiplier
export const currencyMultiplierSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  targetType: z.enum(["channel", "role"]),
  targetId: z.string(),
  multiplier: z.number().min(0.1).max(10),
});

export type CurrencyMultiplier = z.infer<typeof currencyMultiplierSchema>;

export const createCurrencyMultiplierSchema = currencyMultiplierSchema.omit({ id: true, guildId: true });
export type CreateCurrencyMultiplier = z.infer<typeof createCurrencyMultiplierSchema>;

// Channel Category
export const channelCategorySchema = z.object({
  id: z.number(),
  guildId: z.string(),
  channelId: z.string(),
  category: z.enum(["normal", "music", "afk", "premium"]),
});

export type ChannelCategoryConfig = z.infer<typeof channelCategorySchema>;

export const createChannelCategorySchema = channelCategorySchema.omit({ id: true, guildId: true });
export type CreateChannelCategory = z.infer<typeof createChannelCategorySchema>;

// Default values
export const DEFAULT_CURRENCY_SETTINGS: Omit<CurrencySettings, "guildId"> = {
  enabled: true,
  topyName: "토피",
  rubyName: "루비",
  topyManagerEnabled: true,
  rubyManagerEnabled: true,
  textEarnEnabled: true,
  textEarnMin: 1,
  textEarnMax: 1,
  textMinLength: 15,
  textCooldownSeconds: 30,
  textMaxPerCooldown: 1,
  textDailyLimit: 300,
  voiceEarnEnabled: true,
  voiceEarnMin: 1,
  voiceEarnMax: 1,
  voiceCooldownSeconds: 60,
  voiceDailyLimit: 2000,
  minTransferTopy: 100,
  minTransferRuby: 1,
  transferFeeTopyPercent: 1.2,
  transferFeeRubyPercent: 0,
  shopFeeTopyPercent: 0,
  shopFeeRubyPercent: 0,
  monthlyTaxEnabled: false,
  monthlyTaxPercent: 3.3,
  currencyLogChannelId: null,
  itemManagerRoleId: null,
  itemLogChannelId: null,
  bankName: "디토뱅크",
  bankPanelChannelId: null,
  bankPanelMessageId: null,
  treasuryManagerRoleId: null,
};

export const CHANNEL_CATEGORY_LABELS: Record<string, string> = {
  normal: "일반 통화방",
  music: "음감방",
  afk: "잠수방",
  premium: "프리미엄 잠수방",
};

export const CHANNEL_CATEGORY_MULTIPLIERS: Record<string, number> = {
  normal: 1.0,
  music: 0.1,
  afk: 0.1,
  premium: 1.0,
};

// Category Multiplier (서버별 커스텀 배율)
export const categoryMultiplierConfigSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  category: z.enum(["normal", "music", "afk", "premium"]),
  multiplier: z.number().min(0).max(10),
});

export type CategoryMultiplierConfig = z.infer<typeof categoryMultiplierConfigSchema>;

export const saveCategoryMultiplierSchema = z.object({
  category: z.enum(["normal", "music", "afk", "premium"]),
  multiplier: z.number().min(0).max(10),
});

export type SaveCategoryMultiplier = z.infer<typeof saveCategoryMultiplierSchema>;
