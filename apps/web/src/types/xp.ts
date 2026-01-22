import { z } from "zod";

// XP Type
export type XpType = 'text' | 'voice';

// XP Settings
export const xpSettingsSchema = z.object({
  guildId: z.string(),
  enabled: z.boolean(),
  textXpEnabled: z.boolean(),
  textXpMin: z.number().min(0).max(1000),
  textXpMax: z.number().min(0).max(1000),
  textCooldownSeconds: z.number().min(0).max(3600),
  textMaxPerCooldown: z.number().min(1).max(100),
  voiceXpEnabled: z.boolean(),
  voiceXpMin: z.number().min(0).max(1000),
  voiceXpMax: z.number().min(0).max(1000),
  voiceCooldownSeconds: z.number().min(0).max(3600),
  voiceMaxPerCooldown: z.number().min(1).max(100),
  textLevelUpNotificationEnabled: z.boolean(),
  textLevelUpChannelId: z.string().nullable(),
  textLevelUpMessage: z.string().nullable(),
  voiceLevelUpNotificationEnabled: z.boolean(),
  voiceLevelUpChannelId: z.string().nullable(),
  voiceLevelUpMessage: z.string().nullable(),
});

export type XpSettings = z.infer<typeof xpSettingsSchema>;

export const updateXpSettingsSchema = xpSettingsSchema.partial().omit({ guildId: true });
export type UpdateXpSettings = z.infer<typeof updateXpSettingsSchema>;

// XP Hot Time
export const xpHotTimeSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  type: z.enum(["text", "voice", "all"]),
  startTime: z.string(), // HH:mm format
  endTime: z.string(), // HH:mm format
  multiplier: z.number().gt(1, "배율은 1보다 커야 합니다").max(10, "배율은 10 이하여야 합니다"),
  enabled: z.boolean(),
  channelIds: z.array(z.string()).optional(), // 적용 채널 (비어있으면 모든 채널)
});

export type XpHotTime = z.infer<typeof xpHotTimeSchema>;

export const createXpHotTimeSchema = xpHotTimeSchema.omit({ id: true, guildId: true });
export type CreateXpHotTime = z.infer<typeof createXpHotTimeSchema>;

// XP Exclusion
export const xpExclusionSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  targetType: z.enum(["channel", "role"]),
  targetId: z.string(),
});

export type XpExclusion = z.infer<typeof xpExclusionSchema>;

export const createXpExclusionSchema = xpExclusionSchema.omit({ id: true, guildId: true });
export type CreateXpExclusion = z.infer<typeof createXpExclusionSchema>;

// Level Reward
export const levelRewardSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  type: z.enum(["text", "voice"]),
  level: z.number().min(1).max(999),
  roleId: z.string(),
  removeOnHigherLevel: z.boolean(),
});

export type LevelReward = z.infer<typeof levelRewardSchema>;

export const createLevelRewardSchema = levelRewardSchema.omit({ id: true, guildId: true, type: true });
export type CreateLevelReward = z.infer<typeof createLevelRewardSchema>;

// Level Unlock Channel
export const levelUnlockChannelSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  type: z.enum(["text", "voice"]),
  level: z.number().min(1).max(999),
  channelId: z.string(),
});

export type LevelUnlockChannel = z.infer<typeof levelUnlockChannelSchema>;

export const createLevelUnlockChannelSchema = levelUnlockChannelSchema.omit({ id: true, guildId: true, type: true });
export type CreateLevelUnlockChannel = z.infer<typeof createLevelUnlockChannelSchema>;

// XP Multiplier (채널/역할별 배율)
export const xpMultiplierSchema = z.object({
  id: z.number(),
  guildId: z.string(),
  targetType: z.enum(["channel", "role"]),
  targetId: z.string(),
  multiplier: z.number().gt(1, "배율은 1보다 커야 합니다").max(10, "배율은 10 이하여야 합니다"),
});

export type XpMultiplier = z.infer<typeof xpMultiplierSchema>;

export const createXpMultiplierSchema = xpMultiplierSchema.omit({ id: true, guildId: true });
export type CreateXpMultiplier = z.infer<typeof createXpMultiplierSchema>;

export const updateXpMultiplierSchema = z.object({
  multiplier: z.number().gt(1, "배율은 1보다 커야 합니다").max(10, "배율은 10 이하여야 합니다"),
});
export type UpdateXpMultiplier = z.infer<typeof updateXpMultiplierSchema>;

// Default values (ProBot reference)
export const DEFAULT_XP_SETTINGS: Omit<XpSettings, "guildId"> = {
  enabled: true,
  textXpEnabled: true,
  textXpMin: 15,
  textXpMax: 25,
  textCooldownSeconds: 60,
  textMaxPerCooldown: 1,
  voiceXpEnabled: true,
  voiceXpMin: 10,
  voiceXpMax: 20,
  voiceCooldownSeconds: 60,
  voiceMaxPerCooldown: 1,
  textLevelUpNotificationEnabled: true,
  textLevelUpChannelId: null,
  textLevelUpMessage: null,
  voiceLevelUpNotificationEnabled: true,
  voiceLevelUpChannelId: null,
  voiceLevelUpMessage: null,
};
