/**
 * 게임센터 설정 엔티티
 * 서버당 하나의 패널만 설치 가능
 */
export interface GameSettings {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  betFeePercent: number;
  minBet: bigint;
  maxBet: bigint;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 게임센터 설정 생성 DTO
 */
export interface CreateGameSettingsDto {
  guildId: string;
  channelId?: string;
  messageId?: string;
  betFeePercent?: number;
  minBet?: bigint;
  maxBet?: bigint;
}

/**
 * 게임센터 설정 업데이트 DTO
 */
export interface UpdateGameSettingsDto {
  channelId?: string | null;
  messageId?: string | null;
  betFeePercent?: number;
  minBet?: bigint;
  maxBet?: bigint;
}

/**
 * 기본값
 */
export const DEFAULT_BET_FEE_PERCENT = 20;
export const DEFAULT_MIN_BET = BigInt(100);
export const DEFAULT_MAX_BET = BigInt(10000);

/**
 * 기본 게임센터 설정 생성
 */
export function createDefaultGameSettings(guildId: string): GameSettings {
  const now = new Date();
  return {
    guildId,
    channelId: null,
    messageId: null,
    betFeePercent: DEFAULT_BET_FEE_PERCENT,
    minBet: DEFAULT_MIN_BET,
    maxBet: DEFAULT_MAX_BET,
    createdAt: now,
    updatedAt: now,
  };
}
