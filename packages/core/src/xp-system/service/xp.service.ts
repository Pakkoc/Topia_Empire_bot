import type { ClockPort } from '../../shared/port/clock.port';
import type { XpRepositoryPort } from '../port/xp-repository.port';
import type { XpSettingsRepositoryPort } from '../port/xp-settings-repository.port';
import type { UserXp } from '../domain/user-xp';
import type { XpError } from '../errors';
import { Result } from '../../shared/types/result';
import { createUserXp } from '../domain/user-xp';
import { checkCooldown } from '../functions/check-cooldown';
import { calculateLevel } from '../functions/calculate-level';
import { generateRandomXp, applyMultiplier } from '../functions/generate-random-xp';
import { checkHotTime, formatTimeForHotTime } from '../functions/check-hot-time';

export interface LevelRewardInfo {
  roleId: string;
  removeOnHigherLevel: boolean;
}

export interface XpGrantResult {
  granted: boolean;
  xp?: number;
  totalXp?: number;
  level?: number;
  leveledUp?: boolean;
  previousLevel?: number;
  reason?: 'no_settings' | 'disabled' | 'cooldown' | 'excluded_channel' | 'excluded_role';
  // Level up notification info
  levelUpChannelId?: string | null;
  levelUpMessage?: string | null;
  // Level rewards
  rolesToAdd?: LevelRewardInfo[];
  rolesToRemove?: string[];
  // Level unlock channels
  channelsToUnlock?: string[];
}

export class XpService {
  constructor(
    private readonly xpRepo: XpRepositoryPort,
    private readonly settingsRepo: XpSettingsRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  async grantTextXp(
    guildId: string,
    userId: string,
    channelId: string,
    roleIds: string[]
  ): Promise<Result<XpGrantResult, XpError>> {
    // 1. 설정 조회
    const settingsResult = await this.settingsRepo.findByGuild(guildId);
    if (!settingsResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: settingsResult.error });
    }

    const settings = settingsResult.data;
    if (!settings) {
      return Result.ok({ granted: false, reason: 'no_settings' });
    }

    if (!settings.enabled || !settings.textXpEnabled) {
      return Result.ok({ granted: false, reason: 'disabled' });
    }

    // 2. 제외 채널/역할 검사
    const excludedChannelsResult = await this.settingsRepo.getExcludedChannels(guildId);
    if (excludedChannelsResult.success && excludedChannelsResult.data.includes(channelId)) {
      return Result.ok({ granted: false, reason: 'excluded_channel' });
    }

    const excludedRolesResult = await this.settingsRepo.getExcludedRoles(guildId);
    if (excludedRolesResult.success) {
      const hasExcludedRole = roleIds.some(r => excludedRolesResult.data.includes(r));
      if (hasExcludedRole) {
        return Result.ok({ granted: false, reason: 'excluded_role' });
      }
    }

    // 3. 현재 XP 조회
    const userXpResult = await this.xpRepo.findByUser(guildId, userId);
    if (!userXpResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: userXpResult.error });
    }

    const userXp = userXpResult.data ?? createUserXp(guildId, userId);

    // 4. 쿨다운 검사
    const now = this.clock.now();
    const cooldownResult = checkCooldown(
      userXp.lastTextXpAt,
      settings.textCooldownSeconds,
      settings.textMaxPerCooldown,
      userXp.textCountInCooldown,
      now
    );

    if (!cooldownResult.canEarnXp) {
      return Result.ok({ granted: false, reason: 'cooldown' });
    }

    // 5. XP 계산
    const randomValue = Math.random();
    let earnedXp = generateRandomXp(settings.textXpMin, settings.textXpMax, randomValue);

    // 핫타임 배율 적용
    const hotTimesResult = await this.settingsRepo.getHotTimes(guildId, 'text');
    if (hotTimesResult.success) {
      const currentTime = formatTimeForHotTime(now);
      const hotTimeResult = checkHotTime(hotTimesResult.data, currentTime);
      if (hotTimeResult.isActive) {
        earnedXp = applyMultiplier(earnedXp, hotTimeResult.multiplier);
      }
    }

    const newTotalXp = userXp.xp + earnedXp;
    const newLevel = calculateLevel(newTotalXp);
    const previousLevel = userXp.level;
    const leveledUp = newLevel > previousLevel;

    // 6. 저장
    const updatedUserXp: UserXp = {
      ...userXp,
      xp: newTotalXp,
      level: newLevel,
      lastTextXpAt: now,
      textCountInCooldown: cooldownResult.isNewCooldownPeriod ? 1 : cooldownResult.countInCooldown + 1,
      updatedAt: now,
    };

    const saveResult = await this.xpRepo.save(updatedUserXp);
    if (!saveResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: saveResult.error });
    }

    // 7. 레벨 보상 계산
    let rolesToAdd: LevelRewardInfo[] = [];
    let rolesToRemove: string[] = [];
    let channelsToUnlock: string[] = [];

    if (leveledUp) {
      const rewardsResult = await this.settingsRepo.getLevelRewards(guildId);
      if (rewardsResult.success) {
        const rewards = rewardsResult.data;

        // 새 레벨에 해당하는 보상 찾기
        rolesToAdd = rewards
          .filter(r => r.level === newLevel)
          .map(r => ({ roleId: r.roleId, removeOnHigherLevel: r.removeOnHigherLevel }));

        // 이전 레벨 보상 중 제거해야 할 역할 찾기
        rolesToRemove = rewards
          .filter(r => r.level < newLevel && r.removeOnHigherLevel)
          .map(r => r.roleId);
      }

      // 해금 채널 찾기
      const channelsResult = await this.settingsRepo.getLevelChannels(guildId);
      if (channelsResult.success) {
        channelsToUnlock = channelsResult.data
          .filter(c => c.level === newLevel)
          .map(c => c.channelId);
      }
    }

    return Result.ok({
      granted: true,
      xp: earnedXp,
      totalXp: newTotalXp,
      level: newLevel,
      leveledUp,
      previousLevel,
      levelUpChannelId: leveledUp ? settings.levelUpChannelId : undefined,
      levelUpMessage: leveledUp ? settings.levelUpMessage : undefined,
      rolesToAdd: leveledUp ? rolesToAdd : undefined,
      rolesToRemove: leveledUp ? rolesToRemove : undefined,
      channelsToUnlock: leveledUp ? channelsToUnlock : undefined,
    });
  }

  async grantVoiceXp(
    guildId: string,
    userId: string,
    channelId: string,
    roleIds: string[]
  ): Promise<Result<XpGrantResult, XpError>> {
    // 1. 설정 조회
    const settingsResult = await this.settingsRepo.findByGuild(guildId);
    if (!settingsResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: settingsResult.error });
    }

    const settings = settingsResult.data;
    if (!settings) {
      return Result.ok({ granted: false, reason: 'no_settings' });
    }

    if (!settings.enabled || !settings.voiceXpEnabled) {
      return Result.ok({ granted: false, reason: 'disabled' });
    }

    // 2. 제외 채널/역할 검사
    const excludedChannelsResult = await this.settingsRepo.getExcludedChannels(guildId);
    if (excludedChannelsResult.success && excludedChannelsResult.data.includes(channelId)) {
      return Result.ok({ granted: false, reason: 'excluded_channel' });
    }

    const excludedRolesResult = await this.settingsRepo.getExcludedRoles(guildId);
    if (excludedRolesResult.success) {
      const hasExcludedRole = roleIds.some(r => excludedRolesResult.data.includes(r));
      if (hasExcludedRole) {
        return Result.ok({ granted: false, reason: 'excluded_role' });
      }
    }

    // 3. 현재 XP 조회
    const userXpResult = await this.xpRepo.findByUser(guildId, userId);
    if (!userXpResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: userXpResult.error });
    }

    const userXp = userXpResult.data ?? createUserXp(guildId, userId);

    // 4. 쿨다운 검사
    const now = this.clock.now();
    const cooldownResult = checkCooldown(
      userXp.lastVoiceXpAt,
      settings.voiceCooldownSeconds,
      settings.voiceMaxPerCooldown,
      userXp.voiceCountInCooldown,
      now
    );

    if (!cooldownResult.canEarnXp) {
      return Result.ok({ granted: false, reason: 'cooldown' });
    }

    // 5. XP 계산
    const randomValue = Math.random();
    let earnedXp = generateRandomXp(settings.voiceXpMin, settings.voiceXpMax, randomValue);

    // 핫타임 배율 적용
    const hotTimesResult = await this.settingsRepo.getHotTimes(guildId, 'voice');
    if (hotTimesResult.success) {
      const currentTime = formatTimeForHotTime(now);
      const hotTimeResult = checkHotTime(hotTimesResult.data, currentTime);
      if (hotTimeResult.isActive) {
        earnedXp = applyMultiplier(earnedXp, hotTimeResult.multiplier);
      }
    }

    const newTotalXp = userXp.xp + earnedXp;
    const newLevel = calculateLevel(newTotalXp);
    const previousLevel = userXp.level;
    const leveledUp = newLevel > previousLevel;

    // 6. 저장
    const updatedUserXp: UserXp = {
      ...userXp,
      xp: newTotalXp,
      level: newLevel,
      lastVoiceXpAt: now,
      voiceCountInCooldown: cooldownResult.isNewCooldownPeriod ? 1 : cooldownResult.countInCooldown + 1,
      updatedAt: now,
    };

    const saveResult = await this.xpRepo.save(updatedUserXp);
    if (!saveResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: saveResult.error });
    }

    // 7. 레벨 보상 계산
    let rolesToAdd: LevelRewardInfo[] = [];
    let rolesToRemove: string[] = [];
    let channelsToUnlock: string[] = [];

    if (leveledUp) {
      const rewardsResult = await this.settingsRepo.getLevelRewards(guildId);
      if (rewardsResult.success) {
        const rewards = rewardsResult.data;

        // 새 레벨에 해당하는 보상 찾기
        rolesToAdd = rewards
          .filter(r => r.level === newLevel)
          .map(r => ({ roleId: r.roleId, removeOnHigherLevel: r.removeOnHigherLevel }));

        // 이전 레벨 보상 중 제거해야 할 역할 찾기
        rolesToRemove = rewards
          .filter(r => r.level < newLevel && r.removeOnHigherLevel)
          .map(r => r.roleId);
      }

      // 해금 채널 찾기
      const channelsResult = await this.settingsRepo.getLevelChannels(guildId);
      if (channelsResult.success) {
        channelsToUnlock = channelsResult.data
          .filter(c => c.level === newLevel)
          .map(c => c.channelId);
      }
    }

    return Result.ok({
      granted: true,
      xp: earnedXp,
      totalXp: newTotalXp,
      level: newLevel,
      leveledUp,
      previousLevel,
      levelUpChannelId: leveledUp ? settings.levelUpChannelId : undefined,
      levelUpMessage: leveledUp ? settings.levelUpMessage : undefined,
      rolesToAdd: leveledUp ? rolesToAdd : undefined,
      rolesToRemove: leveledUp ? rolesToRemove : undefined,
      channelsToUnlock: leveledUp ? channelsToUnlock : undefined,
    });
  }

  async getLeaderboard(
    guildId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Result<UserXp[], XpError>> {
    const result = await this.xpRepo.getLeaderboard(guildId, limit, offset);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  async getUserXp(guildId: string, userId: string): Promise<Result<UserXp | null, XpError>> {
    const result = await this.xpRepo.findByUser(guildId, userId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }
}
