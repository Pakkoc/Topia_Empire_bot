import { XP_DEFAULTS } from '@topia/shared';

/**
 * 길드별 XP 설정
 */
export interface XpSettings {
  guildId: string;
  enabled: boolean;

  // 텍스트 XP
  textXpEnabled: boolean;
  textXpMin: number;
  textXpMax: number;
  textCooldownSeconds: number;
  textMaxPerCooldown: number;

  // 음성 XP
  voiceXpEnabled: boolean;
  voiceXpMin: number;
  voiceXpMax: number;
  voiceCooldownSeconds: number;
  voiceMaxPerCooldown: number;

  // 텍스트 레벨업 알림
  textLevelUpNotificationEnabled: boolean;
  textLevelUpChannelId: string | null;
  textLevelUpMessage: string | null;

  // 음성 레벨업 알림
  voiceLevelUpNotificationEnabled: boolean;
  voiceLevelUpChannelId: string | null;
  voiceLevelUpMessage: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export function createDefaultXpSettings(guildId: string): XpSettings {
  const now = new Date();
  return {
    guildId,
    enabled: true,

    textXpEnabled: true,
    textXpMin: XP_DEFAULTS.TEXT_XP_MIN,
    textXpMax: XP_DEFAULTS.TEXT_XP_MAX,
    textCooldownSeconds: XP_DEFAULTS.TEXT_COOLDOWN_SECONDS,
    textMaxPerCooldown: XP_DEFAULTS.TEXT_MAX_PER_COOLDOWN,

    voiceXpEnabled: true,
    voiceXpMin: XP_DEFAULTS.VOICE_XP_MIN,
    voiceXpMax: XP_DEFAULTS.VOICE_XP_MAX,
    voiceCooldownSeconds: XP_DEFAULTS.VOICE_COOLDOWN_SECONDS,
    voiceMaxPerCooldown: XP_DEFAULTS.VOICE_MAX_PER_COOLDOWN,

    textLevelUpNotificationEnabled: true,
    textLevelUpChannelId: null,
    textLevelUpMessage: null,

    voiceLevelUpNotificationEnabled: true,
    voiceLevelUpChannelId: null,
    voiceLevelUpMessage: null,

    createdAt: now,
    updatedAt: now,
  };
}
