import type { ClockPort } from '../../shared/port/clock.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { RubyWalletRepositoryPort } from '../port/ruby-wallet-repository.port';
import type { CurrencySettingsRepositoryPort } from '../port/currency-settings-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type { DailyRewardRepositoryPort } from '../port/daily-reward-repository.port';
import type { CurrencyManagerRepositoryPort } from '../port/currency-manager-repository.port';
import type { CurrencyManager } from '../domain/currency-manager';
import type { TopyWallet } from '../domain/topy-wallet';
import type { RubyWallet } from '../domain/ruby-wallet';
import type { CurrencySettings } from '../domain/currency-settings';
import type { CurrencyTransaction, CurrencyType, TransactionType } from '../domain/currency-transaction';
import type { DailyReward } from '../domain/daily-reward';
import type { CurrencyError } from '../errors';
import { Result } from '../../shared/types/result';
import { createTopyWallet, needsDailyReset, applyDailyReset } from '../domain/topy-wallet';
import { createTransaction } from '../domain/currency-transaction';
import { createDailyReward, canClaimReward, calculateStreak, getNextClaimTime } from '../domain/daily-reward';
import { checkCooldown } from '../functions/check-cooldown';
import { checkDailyLimit, calculateActualEarning } from '../functions/check-daily-limit';
import { generateRandomCurrency, applyMultiplier } from '../functions/generate-random-currency';
import { checkHotTime, formatTimeForHotTime } from '../functions/check-hot-time';
import { CURRENCY_DEFAULTS } from '@topia/shared';

export interface CurrencyGrantResult {
  granted: boolean;
  amount?: number;
  totalBalance?: bigint;
  dailyEarned?: number;
  reason?: 'no_settings' | 'disabled' | 'cooldown' | 'excluded_channel' | 'excluded_role' | 'daily_limit' | 'message_too_short';
}

export interface TransferResult {
  amount: bigint;
  fee: bigint;
  fromBalance: bigint;
  toBalance: bigint;
}

export interface AttendanceResult {
  reward: number;
  streakCount: number;
  totalCount: number;
  newBalance: bigint;
  nextClaimAt: Date;
}

export interface AttendanceStatus {
  canClaim: boolean;
  nextClaimAt: Date | null;
  streakCount: number;
  totalCount: number;
}

export interface AdminGrantResult {
  newBalance: bigint;
  currencyType: CurrencyType;
}

export class CurrencyService {
  constructor(
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly rubyWalletRepo: RubyWalletRepositoryPort,
    private readonly settingsRepo: CurrencySettingsRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort,
    private readonly clock: ClockPort,
    private readonly dailyRewardRepo?: DailyRewardRepositoryPort,
    private readonly currencyManagerRepo?: CurrencyManagerRepositoryPort
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

    // 8. 배율 적용 (핫타임 > 역할 > 채널)
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

    // 9. 일일 상한 적용
    earnedAmount = calculateActualEarning(wallet.dailyEarned, settings.voiceDailyLimit, earnedAmount);

    if (earnedAmount <= 0) {
      return Result.ok({ granted: false, reason: 'daily_limit' });
    }

    // 10. 지갑 업데이트
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

    // 11. 거래 기록 저장
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

  /**
   * 루비 지갑 조회
   */
  async getRubyWallet(
    guildId: string,
    userId: string
  ): Promise<Result<RubyWallet | null, CurrencyError>> {
    const result = await this.rubyWalletRepo.findByUser(guildId, userId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 토피 + 루비 지갑 조회
   */
  async getWallets(
    guildId: string,
    userId: string
  ): Promise<Result<{ topy: TopyWallet | null; ruby: RubyWallet | null }, CurrencyError>> {
    const topyResult = await this.topyWalletRepo.findByUser(guildId, userId);
    if (!topyResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: topyResult.error });
    }

    const rubyResult = await this.rubyWalletRepo.findByUser(guildId, userId);
    if (!rubyResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: rubyResult.error });
    }

    return Result.ok({
      topy: topyResult.data,
      ruby: rubyResult.data,
    });
  }

  /**
   * 설정 조회 (화폐 이름 등)
   */
  async getSettings(
    guildId: string
  ): Promise<Result<CurrencySettings | null, CurrencyError>> {
    const result = await this.settingsRepo.findByGuild(guildId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 설정 저장
   */
  async saveSettings(
    settings: CurrencySettings
  ): Promise<Result<void, CurrencyError>> {
    const result = await this.settingsRepo.save(settings);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(undefined);
  }

  /**
   * 신규 유저 지갑 초기화 (서버 가입 시 호출)
   */
  async initializeWallet(
    guildId: string,
    userId: string
  ): Promise<Result<{ topy: TopyWallet; ruby: RubyWallet }, CurrencyError>> {
    const now = this.clock.now();

    // 토피 지갑 생성
    const topyResult = await this.topyWalletRepo.upsert(
      createTopyWallet(guildId, userId, now)
    );
    if (!topyResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: topyResult.error });
    }

    // 루비 지갑 생성
    const rubyResult = await this.rubyWalletRepo.upsert(guildId, userId);
    if (!rubyResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: rubyResult.error });
    }

    return Result.ok({
      topy: topyResult.data,
      ruby: rubyResult.data,
    });
  }

  /**
   * 거래 내역 조회 (길드 전체)
   */
  async getTransactions(
    guildId: string,
    options?: {
      userId?: string;
      currencyType?: CurrencyType;
      transactionType?: TransactionType;
      limit?: number;
      offset?: number;
    }
  ): Promise<Result<CurrencyTransaction[], CurrencyError>> {
    if (options?.userId) {
      const result = await this.transactionRepo.findByUser(guildId, options.userId, {
        currencyType: options.currencyType,
        transactionType: options.transactionType,
        limit: options.limit ?? 20,
        offset: options.offset ?? 0,
      });
      if (!result.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
      }
      return Result.ok(result.data);
    }

    const result = await this.transactionRepo.findByGuild(guildId, {
      currencyType: options?.currencyType,
      transactionType: options?.transactionType,
      limit: options?.limit ?? 20,
      offset: options?.offset ?? 0,
    });
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 화폐 이체
   */
  async transfer(
    guildId: string,
    fromUserId: string,
    toUserId: string,
    amount: bigint,
    currencyType: CurrencyType,
    reason?: string
  ): Promise<Result<TransferResult, CurrencyError>> {
    // 1. 자기 자신에게 이체 불가
    if (fromUserId === toUserId) {
      return Result.err({ type: 'SELF_TRANSFER' });
    }

    // 2. 설정 조회하여 최소 금액 및 수수료 확인
    const settingsResult = await this.settingsRepo.findByGuild(guildId);
    const settings = settingsResult.success ? settingsResult.data : null;

    const minAmount = currencyType === 'topy'
      ? BigInt(settings?.minTransferTopy ?? CURRENCY_DEFAULTS.MIN_TRANSFER_TOPY)
      : BigInt(settings?.minTransferRuby ?? CURRENCY_DEFAULTS.MIN_TRANSFER_RUBY);

    if (amount < minAmount) {
      return Result.err({
        type: 'INVALID_AMOUNT',
        message: `최소 이체 금액은 ${minAmount}입니다.`,
      });
    }

    // 3. 수수료 계산 (설정 기반)
    const feePercent = currencyType === 'topy'
      ? (settings?.transferFeeTopyPercent ?? CURRENCY_DEFAULTS.TRANSFER_FEE_TOPY_PERCENT)
      : (settings?.transferFeeRubyPercent ?? CURRENCY_DEFAULTS.TRANSFER_FEE_RUBY_PERCENT);

    // 수수료 = 금액 * 퍼센트 / 100
    const fee = feePercent > 0 ? (amount * BigInt(Math.round(feePercent * 10))) / BigInt(1000) : BigInt(0);
    const totalRequired = amount + fee;

    if (currencyType === 'topy') {
      return this.transferTopy(guildId, fromUserId, toUserId, amount, fee, totalRequired, reason);
    } else {
      return this.transferRuby(guildId, fromUserId, toUserId, amount, reason);
    }
  }

  private async transferTopy(
    guildId: string,
    fromUserId: string,
    toUserId: string,
    amount: bigint,
    fee: bigint,
    totalRequired: bigint,
    reason?: string
  ): Promise<Result<TransferResult, CurrencyError>> {
    // 송금자 지갑 확인
    const fromWalletResult = await this.topyWalletRepo.findByUser(guildId, fromUserId);
    if (!fromWalletResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: fromWalletResult.error });
    }
    if (!fromWalletResult.data) {
      return Result.err({ type: 'INSUFFICIENT_BALANCE', required: totalRequired, available: BigInt(0) });
    }

    const fromWallet = fromWalletResult.data;
    if (fromWallet.balance < totalRequired) {
      return Result.err({ type: 'INSUFFICIENT_BALANCE', required: totalRequired, available: fromWallet.balance });
    }

    // 수신자 지갑 확인/생성
    const toWalletResult = await this.topyWalletRepo.findByUser(guildId, toUserId);
    if (!toWalletResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: toWalletResult.error });
    }

    // 송금자 잔액 차감
    const subtractResult = await this.topyWalletRepo.updateBalance(guildId, fromUserId, totalRequired, 'subtract');
    if (!subtractResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: subtractResult.error });
    }

    // 수신자 잔액 증가
    const addResult = await this.topyWalletRepo.updateBalance(guildId, toUserId, amount, 'add');
    if (!addResult.success) {
      // 롤백: 송금자 잔액 복구
      await this.topyWalletRepo.updateBalance(guildId, fromUserId, totalRequired, 'add');
      return Result.err({ type: 'REPOSITORY_ERROR', cause: addResult.error });
    }

    const fromBalance = subtractResult.data.balance;
    const toBalance = addResult.data.balance;

    // 거래 기록 저장
    await this.transactionRepo.save(
      createTransaction(guildId, fromUserId, 'topy', 'transfer_out', amount, fromBalance + fee, {
        fee,
        relatedUserId: toUserId,
        description: reason,
      })
    );

    await this.transactionRepo.save(
      createTransaction(guildId, toUserId, 'topy', 'transfer_in', amount, toBalance, {
        relatedUserId: fromUserId,
        description: reason,
      })
    );

    // 수수료 기록 (수수료가 있는 경우)
    if (fee > BigInt(0)) {
      await this.transactionRepo.save(
        createTransaction(guildId, fromUserId, 'topy', 'fee', fee, fromBalance, {
          description: '이체 수수료',
        })
      );
    }

    return Result.ok({
      amount,
      fee,
      fromBalance,
      toBalance,
    });
  }

  private async transferRuby(
    guildId: string,
    fromUserId: string,
    toUserId: string,
    amount: bigint,
    reason?: string
  ): Promise<Result<TransferResult, CurrencyError>> {
    // 송금자 지갑 확인
    const fromWalletResult = await this.rubyWalletRepo.findByUser(guildId, fromUserId);
    if (!fromWalletResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: fromWalletResult.error });
    }
    if (!fromWalletResult.data) {
      return Result.err({ type: 'INSUFFICIENT_BALANCE', required: amount, available: BigInt(0) });
    }

    const fromWallet = fromWalletResult.data;
    if (fromWallet.balance < amount) {
      return Result.err({ type: 'INSUFFICIENT_BALANCE', required: amount, available: fromWallet.balance });
    }

    // 송금자 잔액 차감
    const subtractResult = await this.rubyWalletRepo.updateBalance(guildId, fromUserId, amount, 'subtract');
    if (!subtractResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: subtractResult.error });
    }

    // 수신자 잔액 증가
    const addResult = await this.rubyWalletRepo.updateBalance(guildId, toUserId, amount, 'add');
    if (!addResult.success) {
      // 롤백: 송금자 잔액 복구
      await this.rubyWalletRepo.updateBalance(guildId, fromUserId, amount, 'add');
      return Result.err({ type: 'REPOSITORY_ERROR', cause: addResult.error });
    }

    const fromBalance = subtractResult.data.balance;
    const toBalance = addResult.data.balance;

    // 거래 기록 저장
    await this.transactionRepo.save(
      createTransaction(guildId, fromUserId, 'ruby', 'transfer_out', amount, fromBalance, {
        relatedUserId: toUserId,
        description: reason,
      })
    );

    await this.transactionRepo.save(
      createTransaction(guildId, toUserId, 'ruby', 'transfer_in', amount, toBalance, {
        relatedUserId: fromUserId,
        description: reason,
      })
    );

    return Result.ok({
      amount,
      fee: BigInt(0),
      fromBalance,
      toBalance,
    });
  }

  /**
   * 출석 보상 수령
   */
  async claimAttendance(
    guildId: string,
    userId: string
  ): Promise<Result<AttendanceResult, CurrencyError>> {
    if (!this.dailyRewardRepo) {
      return Result.err({ type: 'SETTINGS_NOT_FOUND', guildId });
    }

    const now = this.clock.now();
    const ATTENDANCE_REWARD = 10; // 10토피

    // 1. 기존 출석 기록 조회
    const rewardResult = await this.dailyRewardRepo.findByUser(guildId, userId, 'attendance');
    if (!rewardResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: rewardResult.error });
    }

    const existingReward = rewardResult.data;

    // 2. 오늘 이미 출석했는지 확인
    if (existingReward) {
      const claimCheck = canClaimReward(existingReward.lastClaimedAt, now);
      if (!claimCheck.canClaim) {
        const nextClaimAt = getNextClaimTime(now);
        return Result.err({ type: 'ALREADY_CLAIMED', nextClaimAt });
      }
    }

    // 3. 연속 출석 계산
    const newStreak = existingReward
      ? calculateStreak(existingReward.lastClaimedAt, existingReward.streakCount, now)
      : 1;

    const newTotalCount = existingReward ? existingReward.totalCount + 1 : 1;

    // 4. 출석 기록 저장
    const updatedReward: DailyReward = existingReward
      ? {
          ...existingReward,
          lastClaimedAt: now,
          streakCount: newStreak,
          totalCount: newTotalCount,
          updatedAt: now,
        }
      : createDailyReward(guildId, userId, 'attendance', now);

    const saveRewardResult = await this.dailyRewardRepo.save(updatedReward);
    if (!saveRewardResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: saveRewardResult.error });
    }

    // 5. 지갑 조회 또는 생성
    const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
    if (!walletResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: walletResult.error });
    }

    let wallet = walletResult.data ?? createTopyWallet(guildId, userId, now);

    // 6. 일일 리셋 체크
    if (needsDailyReset(wallet, now)) {
      wallet = applyDailyReset(wallet, now);
    }

    // 7. 지갑에 토피 추가
    const newBalance = wallet.balance + BigInt(ATTENDANCE_REWARD);
    const updatedWallet: TopyWallet = {
      ...wallet,
      balance: newBalance,
      totalEarned: wallet.totalEarned + BigInt(ATTENDANCE_REWARD),
      dailyEarned: wallet.dailyEarned + ATTENDANCE_REWARD,
      updatedAt: now,
    };

    const saveWalletResult = await this.topyWalletRepo.save(updatedWallet);
    if (!saveWalletResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: saveWalletResult.error });
    }

    // 8. 거래 기록 저장
    await this.transactionRepo.save(
      createTransaction(guildId, userId, 'topy', 'earn_attendance', BigInt(ATTENDANCE_REWARD), newBalance, {
        description: `출석 보상 (${newStreak}일 연속)`,
      })
    );

    return Result.ok({
      reward: ATTENDANCE_REWARD,
      streakCount: newStreak,
      totalCount: newTotalCount,
      newBalance,
      nextClaimAt: getNextClaimTime(now),
    });
  }

  /**
   * 출석 상태 조회
   */
  async getAttendanceStatus(
    guildId: string,
    userId: string
  ): Promise<Result<AttendanceStatus, CurrencyError>> {
    if (!this.dailyRewardRepo) {
      return Result.err({ type: 'SETTINGS_NOT_FOUND', guildId });
    }

    const now = this.clock.now();

    // 출석 기록 조회
    const rewardResult = await this.dailyRewardRepo.findByUser(guildId, userId, 'attendance');
    if (!rewardResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: rewardResult.error });
    }

    const existingReward = rewardResult.data;

    if (!existingReward) {
      // 첫 출석 가능
      return Result.ok({
        canClaim: true,
        nextClaimAt: null,
        streakCount: 0,
        totalCount: 0,
      });
    }

    const claimCheck = canClaimReward(existingReward.lastClaimedAt, now);
    const nextClaimAt = claimCheck.canClaim ? null : getNextClaimTime(now);

    return Result.ok({
      canClaim: claimCheck.canClaim,
      nextClaimAt,
      streakCount: existingReward.streakCount,
      totalCount: existingReward.totalCount,
    });
  }

  // ============================================
  // 화폐 관리자 기능
  // ============================================

  /**
   * 화폐 관리자 목록 조회
   */
  async getCurrencyManagers(
    guildId: string
  ): Promise<Result<CurrencyManager[], CurrencyError>> {
    if (!this.currencyManagerRepo) {
      return Result.ok([]);
    }

    const result = await this.currencyManagerRepo.findByGuild(guildId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 화폐 관리자 여부 확인
   */
  async isCurrencyManager(
    guildId: string,
    userId: string
  ): Promise<Result<boolean, CurrencyError>> {
    if (!this.currencyManagerRepo) {
      return Result.ok(false);
    }

    const result = await this.currencyManagerRepo.isManager(guildId, userId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 화폐 관리자 추가
   */
  async addCurrencyManager(
    guildId: string,
    userId: string
  ): Promise<Result<CurrencyManager, CurrencyError>> {
    if (!this.currencyManagerRepo) {
      return Result.err({ type: 'SETTINGS_NOT_FOUND', guildId });
    }

    const result = await this.currencyManagerRepo.add({ guildId, userId });
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 화폐 관리자 제거
   */
  async removeCurrencyManager(
    guildId: string,
    userId: string
  ): Promise<Result<void, CurrencyError>> {
    if (!this.currencyManagerRepo) {
      return Result.err({ type: 'SETTINGS_NOT_FOUND', guildId });
    }

    const result = await this.currencyManagerRepo.remove(guildId, userId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(undefined);
  }

  /**
   * 관리자 화폐 지급 (화폐 관리자만 사용 가능)
   */
  async adminGrantCurrency(
    guildId: string,
    managerUserId: string,
    targetUserId: string,
    amount: bigint,
    currencyType: CurrencyType,
    description?: string
  ): Promise<Result<AdminGrantResult, CurrencyError>> {
    // 1. 화폐 관리자 여부 확인
    const isManagerResult = await this.isCurrencyManager(guildId, managerUserId);
    if (!isManagerResult.success) {
      return Result.err(isManagerResult.error);
    }
    if (!isManagerResult.data) {
      return Result.err({ type: 'NOT_CURRENCY_MANAGER' });
    }

    // 2. 금액 검증
    if (amount <= BigInt(0)) {
      return Result.err({ type: 'INVALID_AMOUNT', message: '지급 금액은 0보다 커야 합니다.' });
    }

    // 3. 화폐 지급
    if (currencyType === 'topy') {
      const addResult = await this.topyWalletRepo.updateBalance(guildId, targetUserId, amount, 'add');
      if (!addResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: addResult.error });
      }

      const newBalance = addResult.data.balance;

      // 거래 기록 저장
      await this.transactionRepo.save(
        createTransaction(guildId, targetUserId, 'topy', 'admin_add', amount, newBalance, {
          relatedUserId: managerUserId,
          description: description ?? '관리자 지급',
        })
      );

      return Result.ok({ newBalance, currencyType: 'topy' });
    } else {
      const addResult = await this.rubyWalletRepo.updateBalance(guildId, targetUserId, amount, 'add');
      if (!addResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: addResult.error });
      }

      const newBalance = addResult.data.balance;

      // 거래 기록 저장
      await this.transactionRepo.save(
        createTransaction(guildId, targetUserId, 'ruby', 'admin_add', amount, newBalance, {
          relatedUserId: managerUserId,
          description: description ?? '관리자 지급',
        })
      );

      return Result.ok({ newBalance, currencyType: 'ruby' });
    }
  }
}
