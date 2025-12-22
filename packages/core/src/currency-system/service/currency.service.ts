import type { ClockPort } from '../../shared/port/clock.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { RubyWalletRepositoryPort } from '../port/ruby-wallet-repository.port';
import type { CurrencySettingsRepositoryPort } from '../port/currency-settings-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type { TopyWallet } from '../domain/topy-wallet';
import type { CurrencyError } from '../errors';
import { Result } from '../../shared/types/result';
import { createTopyWallet, needsDailyReset, applyDailyReset } from '../domain/topy-wallet';
import { createTransaction } from '../domain/currency-transaction';
import { checkCooldown } from '../functions/check-cooldown';
import { checkDailyLimit, calculateActualEarning } from '../functions/check-daily-limit';
import { generateRandomCurrency, applyMultiplier } from '../functions/generate-random-currency';
import { checkHotTime, formatTimeForHotTime } from '../functions/check-hot-time';
import { getChannelCategoryMultiplier } from '../functions/calculate-channel-multiplier';

export interface CurrencyGrantResult {
  granted: boolean;
  amount?: number;
  totalBalance?: bigint;
  dailyEarned?: number;
  reason?: 'no_settings' | 'disabled' | 'cooldown' | 'excluded_channel' | 'excluded_role' | 'daily_limit' | 'message_too_short';
}

export class CurrencyService {
  constructor(
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly rubyWalletRepo: RubyWalletRepositoryPort,
    private readonly settingsRepo: CurrencySettingsRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  /**
   * 텍스트 채팅 보상
   */
  async grantTextCurrency(
    guildId: string,
    userId: string,
    channelId: string,
    roleIds: string[],
    messageLength: number
  ): Promise<Result<CurrencyGrantResult, CurrencyError>> {
    // 1. 설정 조회
    const settingsResult = await this.settingsRepo.findByGuild(guildId);
    if (!settingsResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: settingsResult.error });
    }

    const settings = settingsResult.data;
    if (!settings) {
      return Result.ok({ granted: false, reason: 'no_settings' });
    }

    if (!settings.enabled || !settings.textEarnEnabled) {
      return Result.ok({ granted: false, reason: 'disabled' });
    }

    // 2. 메시지 길이 검사
    if (messageLength < settings.textMinLength) {
      return Result.ok({ granted: false, reason: 'message_too_short' });
    }

    // 3. 제외 채널/역할 검사
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

    // 4. 지갑 조회 또는 생성
    const now = this.clock.now();
    const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
    if (!walletResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: walletResult.error });
    }

    let wallet = walletResult.data ?? createTopyWallet(guildId, userId, now);

    // 5. 일일 리셋 체크
    if (needsDailyReset(wallet, now)) {
      wallet = applyDailyReset(wallet, now);
    }

    // 6. 쿨다운 검사
    const cooldownResult = checkCooldown(
      wallet.lastTextEarnAt,
      settings.textCooldownSeconds,
      settings.textMaxPerCooldown,
      wallet.textCountInCooldown,
      now
    );

    if (!cooldownResult.canEarn) {
      return Result.ok({ granted: false, reason: 'cooldown' });
    }

    // 7. 일일 상한 검사
    const dailyLimitResult = checkDailyLimit(
      wallet.dailyEarned,
      settings.textDailyLimit,
      1
    );

    if (!dailyLimitResult.canEarn) {
      return Result.ok({ granted: false, reason: 'daily_limit' });
    }

    // 8. 기본 보상 계산
    const randomValue = Math.random();
    let earnedAmount = generateRandomCurrency(settings.textEarnMin, settings.textEarnMax, randomValue);

    // 9. 배율 적용 (핫타임 > 역할 > 채널)
    const currentTime = formatTimeForHotTime(now);
    let appliedMultiplier = 1;

    // 핫타임 확인
    const hotTimesResult = await this.settingsRepo.getHotTimes(guildId, 'text');
    if (hotTimesResult.success) {
      const hotTimeResult = checkHotTime(hotTimesResult.data, currentTime, channelId);
      if (hotTimeResult.isActive) {
        appliedMultiplier = hotTimeResult.multiplier;
      }
    }

    // 핫타임 미적용 시 역할/채널 배율 확인
    if (appliedMultiplier === 1) {
      const multipliersResult = await this.settingsRepo.getMultipliers(guildId);
      if (multipliersResult.success) {
        const multipliers = multipliersResult.data;

        // 역할 배율 (가장 높은 것)
        const roleMultipliers = multipliers.filter(
          m => m.targetType === 'role' && roleIds.includes(m.targetId)
        );

        if (roleMultipliers.length > 0) {
          appliedMultiplier = Math.max(...roleMultipliers.map(m => m.multiplier));
        } else {
          // 채널 배율
          const channelMultiplier = multipliers.find(
            m => m.targetType === 'channel' && m.targetId === channelId
          );
          if (channelMultiplier) {
            appliedMultiplier = channelMultiplier.multiplier;
          }
        }
      }
    }

    if (appliedMultiplier !== 1) {
      earnedAmount = applyMultiplier(earnedAmount, appliedMultiplier);
    }

    // 10. 일일 상한 적용
    earnedAmount = calculateActualEarning(wallet.dailyEarned, settings.textDailyLimit, earnedAmount);

    if (earnedAmount <= 0) {
      return Result.ok({ granted: false, reason: 'daily_limit' });
    }

    // 11. 지갑 업데이트
    const newBalance = wallet.balance + BigInt(earnedAmount);
    const updatedWallet: TopyWallet = {
      ...wallet,
      balance: newBalance,
      totalEarned: wallet.totalEarned + BigInt(earnedAmount),
      dailyEarned: wallet.dailyEarned + earnedAmount,
      lastTextEarnAt: now,
      textCountInCooldown: cooldownResult.isNewCooldownPeriod ? 1 : cooldownResult.countInCooldown + 1,
      updatedAt: now,
    };

    const saveResult = await this.topyWalletRepo.save(updatedWallet);
    if (!saveResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: saveResult.error });
    }

    // 12. 거래 기록 저장
    await this.transactionRepo.save(
      createTransaction(guildId, userId, 'topy', 'earn_text', BigInt(earnedAmount), newBalance)
    );

    return Result.ok({
      granted: true,
      amount: earnedAmount,
      totalBalance: newBalance,
      dailyEarned: updatedWallet.dailyEarned,
    });
  }

  /**
   * 음성 채팅 보상
   */
  async grantVoiceCurrency(
    guildId: string,
    userId: string,
    channelId: string,
    roleIds: string[]
  ): Promise<Result<CurrencyGrantResult, CurrencyError>> {
    // 1. 설정 조회
    const settingsResult = await this.settingsRepo.findByGuild(guildId);
    if (!settingsResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: settingsResult.error });
    }

    const settings = settingsResult.data;
    if (!settings) {
      return Result.ok({ granted: false, reason: 'no_settings' });
    }

    if (!settings.enabled || !settings.voiceEarnEnabled) {
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

    // 3. 지갑 조회 또는 생성
    const now = this.clock.now();
    const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
    if (!walletResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: walletResult.error });
    }

    let wallet = walletResult.data ?? createTopyWallet(guildId, userId, now);

    // 4. 일일 리셋 체크
    if (needsDailyReset(wallet, now)) {
      wallet = applyDailyReset(wallet, now);
    }

    // 5. 쿨다운 검사
    const cooldownResult = checkCooldown(
      wallet.lastVoiceEarnAt,
      settings.voiceCooldownSeconds,
      1, // 음성은 쿨다운당 1회
      wallet.voiceCountInCooldown,
      now
    );

    if (!cooldownResult.canEarn) {
      return Result.ok({ granted: false, reason: 'cooldown' });
    }

    // 6. 일일 상한 검사
    const dailyLimitResult = checkDailyLimit(
      wallet.dailyEarned,
      settings.voiceDailyLimit,
      1
    );

    if (!dailyLimitResult.canEarn) {
      return Result.ok({ granted: false, reason: 'daily_limit' });
    }

    // 7. 기본 보상 계산
    const randomValue = Math.random();
    let earnedAmount = generateRandomCurrency(settings.voiceEarnMin, settings.voiceEarnMax, randomValue);

    // 8. 채널 카테고리 배율 적용 (음성 전용)
    const categoryResult = await this.settingsRepo.getChannelCategory(guildId, channelId);
    if (categoryResult.success) {
      const categoryMultiplier = getChannelCategoryMultiplier(categoryResult.data);
      earnedAmount = applyMultiplier(earnedAmount, categoryMultiplier);
    }

    // 9. 핫타임 / 역할 / 채널 배율 적용
    const currentTime = formatTimeForHotTime(now);
    let appliedMultiplier = 1;

    const hotTimesResult = await this.settingsRepo.getHotTimes(guildId, 'voice');
    if (hotTimesResult.success) {
      const hotTimeResult = checkHotTime(hotTimesResult.data, currentTime, channelId);
      if (hotTimeResult.isActive) {
        appliedMultiplier = hotTimeResult.multiplier;
      }
    }

    if (appliedMultiplier === 1) {
      const multipliersResult = await this.settingsRepo.getMultipliers(guildId);
      if (multipliersResult.success) {
        const multipliers = multipliersResult.data;

        const roleMultipliers = multipliers.filter(
          m => m.targetType === 'role' && roleIds.includes(m.targetId)
        );

        if (roleMultipliers.length > 0) {
          appliedMultiplier = Math.max(...roleMultipliers.map(m => m.multiplier));
        } else {
          const channelMultiplier = multipliers.find(
            m => m.targetType === 'channel' && m.targetId === channelId
          );
          if (channelMultiplier) {
            appliedMultiplier = channelMultiplier.multiplier;
          }
        }
      }
    }

    if (appliedMultiplier !== 1) {
      earnedAmount = applyMultiplier(earnedAmount, appliedMultiplier);
    }

    // 10. 일일 상한 적용
    earnedAmount = calculateActualEarning(wallet.dailyEarned, settings.voiceDailyLimit, earnedAmount);

    if (earnedAmount <= 0) {
      return Result.ok({ granted: false, reason: 'daily_limit' });
    }

    // 11. 지갑 업데이트
    const newBalance = wallet.balance + BigInt(earnedAmount);
    const updatedWallet: TopyWallet = {
      ...wallet,
      balance: newBalance,
      totalEarned: wallet.totalEarned + BigInt(earnedAmount),
      dailyEarned: wallet.dailyEarned + earnedAmount,
      lastVoiceEarnAt: now,
      voiceCountInCooldown: cooldownResult.isNewCooldownPeriod ? 1 : cooldownResult.countInCooldown + 1,
      updatedAt: now,
    };

    const saveResult = await this.topyWalletRepo.save(updatedWallet);
    if (!saveResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: saveResult.error });
    }

    // 12. 거래 기록 저장
    await this.transactionRepo.save(
      createTransaction(guildId, userId, 'topy', 'earn_voice', BigInt(earnedAmount), newBalance)
    );

    return Result.ok({
      granted: true,
      amount: earnedAmount,
      totalBalance: newBalance,
      dailyEarned: updatedWallet.dailyEarned,
    });
  }

  /**
   * 지갑 조회
   */
  async getWallet(
    guildId: string,
    userId: string
  ): Promise<Result<TopyWallet | null, CurrencyError>> {
    const result = await this.topyWalletRepo.findByUser(guildId, userId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 리더보드 조회
   */
  async getLeaderboard(
    guildId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Result<TopyWallet[], CurrencyError>> {
    const result = await this.topyWalletRepo.getLeaderboard(guildId, limit, offset);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }
}
