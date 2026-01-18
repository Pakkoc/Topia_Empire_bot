import type { RankRewards } from './game-category';

/**
 * 내전 시스템 설정 엔티티
 */
export interface GameSettings {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  managerRoleId: string | null;
  approvalChannelId: string | null; // 승인 요청 채널
  entryFee: bigint;
  rankRewards: RankRewards; // 순위별 보상 비율
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
  approvalChannelId?: string;
  entryFee?: bigint;
  rankRewards?: RankRewards;
}

/**
 * 내전 설정 업데이트 DTO
 */
export interface UpdateGameSettingsDto {
  channelId?: string | null;
  messageId?: string | null;
  managerRoleId?: string | null;
  approvalChannelId?: string | null;
  entryFee?: bigint;
  rankRewards?: RankRewards;
}

/**
 * 기본값
 */
export const DEFAULT_ENTRY_FEE = BigInt(100);
export const DEFAULT_RANK_REWARDS: RankRewards = {
  1: 50,
  2: 30,
  3: 15,
  4: 5,
};

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
    approvalChannelId: null,
    entryFee: DEFAULT_ENTRY_FEE,
    rankRewards: { ...DEFAULT_RANK_REWARDS },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 순위 비율 합계 검증
 */
export function validateRankRewards(rankRewards: RankRewards): boolean {
  const total = Object.values(rankRewards).reduce((sum, percent) => sum + percent, 0);
  return total === 100;
}
