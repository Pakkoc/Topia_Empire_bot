/**
 * 루비 지갑 (프리미엄 화폐)
 */
export interface RubyWallet {
  guildId: string;
  userId: string;
  balance: bigint;
  totalEarned: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export function createRubyWallet(guildId: string, userId: string, now: Date): RubyWallet {
  return {
    guildId,
    userId,
    balance: BigInt(0),
    totalEarned: BigInt(0),
    createdAt: now,
    updatedAt: now,
  };
}
