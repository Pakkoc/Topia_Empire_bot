/**
 * 토피 지갑
 */
export interface TopyWallet {
  guildId: string;
  userId: string;
  balance: bigint;
  totalEarned: bigint;
  dailyEarned: number;
  dailyResetAt: Date;
  lastTextEarnAt: Date | null;
  textCountInCooldown: number;
  lastVoiceEarnAt: Date | null;
  voiceCountInCooldown: number;
  createdAt: Date;
  updatedAt: Date;
}

export function createTopyWallet(guildId: string, userId: string, now: Date): TopyWallet {
  return {
    guildId,
    userId,
    balance: BigInt(0),
    totalEarned: BigInt(0),
    dailyEarned: 0,
    dailyResetAt: now,
    lastTextEarnAt: null,
    textCountInCooldown: 0,
    lastVoiceEarnAt: null,
    voiceCountInCooldown: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 일일 리셋이 필요한지 확인
 */
export function needsDailyReset(wallet: TopyWallet, now: Date): boolean {
  const resetDate = new Date(wallet.dailyResetAt);
  const today = new Date(now);

  // 날짜만 비교 (시간 제외)
  resetDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return today > resetDate;
}

/**
 * 일일 리셋 적용
 */
export function applyDailyReset(wallet: TopyWallet, now: Date): TopyWallet {
  return {
    ...wallet,
    dailyEarned: 0,
    dailyResetAt: now,
    updatedAt: now,
  };
}
