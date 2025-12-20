import type { ClockPort } from '../../shared/port/clock.port';
import type { XpRepositoryPort } from '../port/xp-repository.port';
import type { XpSettingsRepositoryPort } from '../port/xp-settings-repository.port';
import type { UserXp } from '../domain/user-xp';
import type { XpError } from '../errors';
import { Result } from '../../shared/types/result';
import { createUserXp } from '../domain/user-xp';
import { checkCooldown } from '../functions/check-cooldown';
import { calculateLevelWithCustom } from '../functions/calculate-level';
import { toLevelRequirementsMap } from '../domain/xp-level-requirements';
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

    // 채널/역할 배율 적용 (역할 우선)
    const multipliersResult = await this.settingsRepo.getMultipliers(guildId);
    if (multipliersResult.success) {
      const multipliers = multipliersResult.data;

      // 역할 배율 찾기 (여러 역할 중 가장 높은 배율)
      const roleMultipliers = multipliers.filter(
        m => m.targetType === 'role' && roleIds.includes(m.targetId)
      );

      // 채널 배율 찾기
      const channelMultiplier = multipliers.find(
        m => m.targetType === 'channel' && m.targetId === channelId
      );

      // 역할 우선: 역할 배율이 있으면 사용, 없으면 채널 배율 사용
      if (roleMultipliers.length > 0) {
        const maxRoleMultiplier = Math.max(...roleMultipliers.map(m => m.multiplier));
        earnedXp = applyMultiplier(earnedXp, maxRoleMultiplier);
      } else if (channelMultiplier) {
        earnedXp = applyMultiplier(earnedXp, channelMultiplier.multiplier);
      }
    }

    const newTotalXp = userXp.xp + earnedXp;

    // 5.5 커스텀 레벨 요구사항 조회
    const levelReqResult = await this.settingsRepo.getLevelRequirements(guildId);
    const levelRequirements = levelReqResult.success
      ? toLevelRequirementsMap(levelReqResult.data)
      : new Map<number, number>();

    const newLevel = calculateLevelWithCustom(newTotalXp, levelRequirements);
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

    // 채널/역할 배율 적용 (역할 우선)
    const voiceMultipliersResult = await this.settingsRepo.getMultipliers(guildId);
    if (voiceMultipliersResult.success) {
      const multipliers = voiceMultipliersResult.data;

      // 역할 배율 찾기 (여러 역할 중 가장 높은 배율)
      const roleMultipliers = multipliers.filter(
        m => m.targetType === 'role' && roleIds.includes(m.targetId)
      );

      // 채널 배율 찾기
      const channelMultiplier = multipliers.find(
        m => m.targetType === 'channel' && m.targetId === channelId
      );

      // 역할 우선: 역할 배율이 있으면 사용, 없으면 채널 배율 사용
      if (roleMultipliers.length > 0) {
        const maxRoleMultiplier = Math.max(...roleMultipliers.map(m => m.multiplier));
        earnedXp = applyMultiplier(earnedXp, maxRoleMultiplier);
      } else if (channelMultiplier) {
        earnedXp = applyMultiplier(earnedXp, channelMultiplier.multiplier);
      }
    }

    const newTotalXp = userXp.xp + earnedXp;

    // 5.5 커스텀 레벨 요구사항 조회
    const voiceLevelReqResult = await this.settingsRepo.getLevelRequirements(guildId);
    const voiceLevelRequirements = voiceLevelReqResult.success
      ? toLevelRequirementsMap(voiceLevelReqResult.data)
      : new Map<number, number>();

    const newLevel = calculateLevelWithCustom(newTotalXp, voiceLevelRequirements);
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

  /**
   * 모든 유저의 레벨을 재계산하고 역할 보상 정보를 반환합니다.
   * 레벨 요구사항 또는 역할 보상이 변경되었을 때 호출됩니다.
   */
  async syncAllUserLevels(guildId: string): Promise<Result<{
    updatedUsers: Array<{
      userId: string;
      oldLevel: number;
      newLevel: number;
      rolesToAdd: LevelRewardInfo[];
      rolesToRemove: string[];
    }>;
    totalUsers: number;
  }, XpError>> {
    // 1. 모든 유저 조회
    const usersResult = await this.xpRepo.getAllByGuild(guildId);
    if (!usersResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: usersResult.error });
    }

    const users = usersResult.data;
    if (users.length === 0) {
      return Result.ok({ updatedUsers: [], totalUsers: 0 });
    }

    // 2. 레벨 요구사항 조회
    const levelReqResult = await this.settingsRepo.getLevelRequirements(guildId);
    const levelRequirements = levelReqResult.success
      ? toLevelRequirementsMap(levelReqResult.data)
      : new Map<number, number>();

    // 3. 레벨 보상 조회
    const rewardsResult = await this.settingsRepo.getLevelRewards(guildId);
    const rewards = rewardsResult.success ? rewardsResult.data : [];

    // 4. 각 유저의 레벨 재계산 및 역할 동기화
    const now = this.clock.now();
    const updatedUsers: Array<{
      userId: string;
      oldLevel: number;
      newLevel: number;
      rolesToAdd: LevelRewardInfo[];
      rolesToRemove: string[];
    }> = [];

    const usersToSave: UserXp[] = [];

    for (const user of users) {
      const newLevel = calculateLevelWithCustom(user.xp, levelRequirements);
      const levelChanged = newLevel !== user.level;

      // 역할 보상 계산 (레벨 변경 여부와 관계없이 항상 계산)
      const rolesToAdd: LevelRewardInfo[] = [];
      const rolesToRemove: string[] = [];

      for (const reward of rewards) {
        if (reward.level <= newLevel) {
          // 현재 레벨 이하의 보상 역할 추가
          if (!reward.removeOnHigherLevel || reward.level === newLevel) {
            rolesToAdd.push({
              roleId: reward.roleId,
              removeOnHigherLevel: reward.removeOnHigherLevel,
            });
          }
        }
        // 새 레벨보다 높은 레벨의 보상 역할은 제거
        if (reward.level > newLevel) {
          rolesToRemove.push(reward.roleId);
        }
        // removeOnHigherLevel이 true이고 현재 레벨보다 낮은 보상은 제거
        if (reward.removeOnHigherLevel && reward.level < newLevel) {
          rolesToRemove.push(reward.roleId);
        }
      }

      // 역할 변경이 있거나 레벨이 변경된 경우에만 추가
      if (rolesToAdd.length > 0 || rolesToRemove.length > 0 || levelChanged) {
        updatedUsers.push({
          userId: user.userId,
          oldLevel: user.level,
          newLevel,
          rolesToAdd,
          rolesToRemove,
        });

        if (levelChanged) {
          usersToSave.push({
            ...user,
            level: newLevel,
            updatedAt: now,
          });
        }
      }
    }

    // 5. 레벨이 변경된 유저들 저장
    if (usersToSave.length > 0) {
      const saveResult = await this.xpRepo.saveBulk(usersToSave);
      if (!saveResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: saveResult.error });
      }
    }

    return Result.ok({
      updatedUsers,
      totalUsers: users.length,
    });
  }

  /**
   * 모든 유저의 레벨에 따라 해금 채널 권한 정보를 반환합니다.
   * 해금 채널 설정이 변경되었을 때 호출됩니다.
   */
  async syncAllUserChannels(guildId: string): Promise<Result<{
    channelsToLock: string[];
    userChannelPermissions: Array<{
      channelId: string;
      userIds: string[];
    }>;
    totalUsers: number;
  }, XpError>> {
    // 1. 모든 유저 조회
    const usersResult = await this.xpRepo.getAllByGuild(guildId);
    if (!usersResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: usersResult.error });
    }

    const users = usersResult.data;

    // 2. 레벨 요구사항 조회
    const levelReqResult = await this.settingsRepo.getLevelRequirements(guildId);
    const levelRequirements = levelReqResult.success
      ? toLevelRequirementsMap(levelReqResult.data)
      : new Map<number, number>();

    // 3. 해금 채널 조회
    const channelsResult = await this.settingsRepo.getLevelChannels(guildId);
    if (!channelsResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: channelsResult.error });
    }

    const levelChannels = channelsResult.data;
    if (levelChannels.length === 0) {
      return Result.ok({
        channelsToLock: [],
        userChannelPermissions: [],
        totalUsers: users.length,
      });
    }

    // 4. 모든 해금 채널 ID 목록 (잠금 대상)
    const channelsToLock = levelChannels.map(c => c.channelId);

    // 5. 각 채널별로 접근 가능한 유저 목록 계산
    const userChannelPermissions: Array<{
      channelId: string;
      userIds: string[];
    }> = [];

    for (const channel of levelChannels) {
      const eligibleUserIds: string[] = [];

      for (const user of users) {
        const userLevel = calculateLevelWithCustom(user.xp, levelRequirements);
        if (userLevel >= channel.level) {
          eligibleUserIds.push(user.userId);
        }
      }

      userChannelPermissions.push({
        channelId: channel.channelId,
        userIds: eligibleUserIds,
      });
    }

    return Result.ok({
      channelsToLock,
      userChannelPermissions,
      totalUsers: users.length,
    });
  }
}
