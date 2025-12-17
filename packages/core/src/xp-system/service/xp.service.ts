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

export interface XpGrantResult {
  granted: boolean;
  xp?: number;
  totalXp?: number;
  level?: number;
  leveledUp?: boolean;
  previousLevel?: number;
  reason?: 'no_settings' | 'disabled' | 'cooldown' | 'excluded_channel' | 'excluded_role';
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
    const earnedXp = generateRandomXp(settings.textXpMin, settings.textXpMax, randomValue);
    // TODO: 핫타임/배율 적용

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

    return Result.ok({
      granted: true,
      xp: earnedXp,
      totalXp: newTotalXp,
      level: newLevel,
      leveledUp,
      previousLevel,
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
