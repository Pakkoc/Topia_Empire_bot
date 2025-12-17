/**
 * 유저별 XP 데이터
 */
export interface UserXp {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
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
    xp: 0,
    level: 0,
    lastTextXpAt: null,
    textCountInCooldown: 0,
    lastVoiceXpAt: null,
    voiceCountInCooldown: 0,
    createdAt: now,
    updatedAt: now,
  };
}
