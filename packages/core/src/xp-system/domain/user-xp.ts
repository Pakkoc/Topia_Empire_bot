/**
 * 유저별 XP 데이터
 */
export interface UserXp {
  guildId: string;
  userId: string;
  textXp: number;
  voiceXp: number;
  textLevel: number;
  voiceLevel: number;
  lastTextXpAt: Date | null;
  textCountInCooldown: number;
  lastVoiceXpAt: Date | null;
  voiceCountInCooldown: number;
  createdAt: Date;
  updatedAt: Date;
}

export function createUserXp(guildId: string, userId: string): UserXp {
  const now = new Date();
  return {
    guildId,
    userId,
    textXp: 0,
    voiceXp: 0,
    textLevel: 0,
    voiceLevel: 0,
    lastTextXpAt: null,
    textCountInCooldown: 0,
    lastVoiceXpAt: null,
    voiceCountInCooldown: 0,
    createdAt: now,
    updatedAt: now,
  };
}
