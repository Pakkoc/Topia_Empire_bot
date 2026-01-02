/**
 * 내전 시스템 설정 엔티티
 */
export interface GameSettings {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  managerRoleId: string | null;
  entryFee: bigint;
  rank1Percent: number;
  rank2Percent: number;
  rank3Percent: number;
  rank4Percent: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 내전 설정 생성 DTO
 */
export interface CreateGameSettingsDto {
  guildId: string;
  channelId?: string;
  messageId?: string;
  managerRoleId?: string;
  entryFee?: bigint;
  rank1Percent?: number;
  rank2Percent?: number;
  rank3Percent?: number;
  rank4Percent?: number;
}

/**
 * 내전 설정 업데이트 DTO
 */
export interface UpdateGameSettingsDto {
  channelId?: string | null;
  messageId?: string | null;
  managerRoleId?: string | null;
  entryFee?: bigint;
  rank1Percent?: number;
  rank2Percent?: number;
  rank3Percent?: number;
  rank4Percent?: number;
}

/**
 * 기본값
 */
export const DEFAULT_ENTRY_FEE = BigInt(100);
export const DEFAULT_RANK1_PERCENT = 50;
export const DEFAULT_RANK2_PERCENT = 30;
export const DEFAULT_RANK3_PERCENT = 15;
export const DEFAULT_RANK4_PERCENT = 5;

/**
 * 기본 내전 설정 생성
 */
export function createDefaultGameSettings(guildId: string): GameSettings {
  const now = new Date();
  return {
    guildId,
    channelId: null,
    messageId: null,
    managerRoleId: null,
    entryFee: DEFAULT_ENTRY_FEE,
    rank1Percent: DEFAULT_RANK1_PERCENT,
    rank2Percent: DEFAULT_RANK2_PERCENT,
    rank3Percent: DEFAULT_RANK3_PERCENT,
    rank4Percent: DEFAULT_RANK4_PERCENT,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 순위 비율 합계 검증
 */
export function validateRankPercents(
  rank1: number,
  rank2: number,
  rank3: number,
  rank4: number
): boolean {
  return rank1 + rank2 + rank3 + rank4 === 100;
}
