import type { ClockPort } from '../../shared/port/clock.port';
import type { CurrencyError } from '../errors';
import type { ShopRepositoryPort } from '../port/shop-repository.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { RubyWalletRepositoryPort } from '../port/ruby-wallet-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type { CurrencySettingsRepositoryPort } from '../port/currency-settings-repository.port';
import type { BankSubscriptionRepositoryPort } from '../port/bank-subscription-repository.port';
import type { RoleTicketRepositoryPort } from '../port/role-ticket-repository.port';
import type { TreasuryRepositoryPort } from '../../treasury/port/treasury-repository.port';
import type {
  ShopItem,
  ShopItemType,
  CreateShopItemInput,
  UpdateShopItemInput,
} from '../domain/shop-item';
import type { UserItemV2 } from '../domain/user-item-v2';
import type { BankTier } from '../domain/bank-subscription';
import type { TicketRoleOption } from '../domain/ticket-role-option';
import type { VaultSubscriptionEffectConfig } from '../domain/shop-item';
import { Result } from '../../shared/types/result';
import { isPeriodItem, getItemPrice } from '../domain/shop-item';
import { createDynamicBankSubscription, getBankBenefits } from '../domain/bank-subscription';
import { createTransaction, type CurrencyType } from '../domain/currency-transaction';
import { CURRENCY_DEFAULTS } from '@topia/shared';

export interface PurchaseResult {
  item: ShopItem;
  userItem: UserItemV2;
  totalCost: bigint;
  fee: bigint;
}

export interface DirectRolePurchaseResult {
  roleId: string;
  roleOption: TicketRoleOption;
  paidAmount: bigint;
  currencyType: CurrencyType;
}

export class ShopService {
  constructor(
    private readonly shopRepo: ShopRepositoryPort,
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly rubyWalletRepo: RubyWalletRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort,
    private readonly currencySettingsRepo: CurrencySettingsRepositoryPort,
    private readonly clock: ClockPort,
    private readonly bankSubscriptionRepo?: BankSubscriptionRepositoryPort,
    private readonly roleTicketRepo?: RoleTicketRepositoryPort,
    private readonly treasuryRepo?: TreasuryRepositoryPort
  ) {}

  // ========== 상점 아이템 CRUD ==========

  async getShopItems(guildId: string): Promise<Result<ShopItem[], CurrencyError>> {
    const result = await this.shopRepo.findAllByGuild(guildId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async getEnabledShopItems(guildId: string): Promise<Result<ShopItem[], CurrencyError>> {
    const result = await this.shopRepo.findEnabledByGuild(guildId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  /**
   * 화폐 타입별 활성화된 상점 아이템 조회
   */
  async getEnabledShopItemsByCurrency(
    guildId: string,
    currencyType: 'topy' | 'ruby'
  ): Promise<Result<ShopItem[], CurrencyError>> {
    const result = await this.shopRepo.findEnabledByGuildAndCurrency(guildId, currencyType);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async getShopItem(id: number): Promise<Result<ShopItem | null, CurrencyError>> {
    const result = await this.shopRepo.findById(id);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async createShopItem(input: CreateShopItemInput): Promise<Result<ShopItem, CurrencyError>> {
    const result = await this.shopRepo.create(input);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async updateShopItem(
    id: number,
    input: UpdateShopItemInput
  ): Promise<Result<void, CurrencyError>> {
    const result = await this.shopRepo.update(id, input);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async deleteShopItem(id: number): Promise<Result<void, CurrencyError>> {
    const result = await this.shopRepo.delete(id);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  // ========== 구매 ==========

  async purchaseItem(
    guildId: string,
    userId: string,
    itemId: number,
    quantity: number = 1,
    paymentCurrency?: CurrencyType
  ): Promise<Result<PurchaseResult, CurrencyError>> {
    const now = this.clock.now();

    // 수량 검증
    if (quantity < 1 || quantity > 99 || !Number.isInteger(quantity)) {
      return { success: false, error: { type: 'INVALID_QUANTITY' as const } };
    }

    // 1. 아이템 조회
    const itemResult = await this.shopRepo.findById(itemId);
    if (!itemResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: itemResult.error } };
    }
    const item = itemResult.data;
    if (!item) {
      return { success: false, error: { type: 'ITEM_NOT_FOUND' } };
    }
    if (!item.enabled) {
      return { success: false, error: { type: 'ITEM_DISABLED' } };
    }

    // 결제 화폐 결정 (both인 경우 paymentCurrency 사용, 아니면 item의 currencyType 사용)
    const currency: CurrencyType = paymentCurrency ?? (item.currencyType === 'both' ? 'topy' : item.currencyType);

    // 2. 재고 확인
    if (item.stock !== null && item.stock < quantity) {
      return { success: false, error: { type: 'OUT_OF_STOCK', available: item.stock, requested: quantity } };
    }

    // 3. 유저당 구매 제한 확인
    if (item.maxPerUser !== null) {
      const countResult = await this.shopRepo.getUserPurchaseCount(guildId, userId, itemId);
      if (!countResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: countResult.error } };
      }
      if (countResult.data + quantity > item.maxPerUser) {
        return {
          success: false,
          error: {
            type: 'PURCHASE_LIMIT_EXCEEDED',
            maxPerUser: item.maxPerUser,
            currentCount: countResult.data,
            requested: quantity,
          },
        };
      }
    }

    // 4. 수수료 계산
    const settingsResult = await this.currencySettingsRepo.findByGuild(guildId);
    const settings = settingsResult.success ? settingsResult.data : null;
    const feePercent = currency === 'topy'
      ? (settings?.shopFeeTopyPercent ?? CURRENCY_DEFAULTS.SHOP_FEE_TOPY_PERCENT)
      : (settings?.shopFeeRubyPercent ?? CURRENCY_DEFAULTS.SHOP_FEE_RUBY_PERCENT);

    // 해당 화폐에 맞는 가격 조회
    const price = getItemPrice(item, currency);
    if (price === null) {
      return { success: false, error: { type: 'ITEM_NOT_FOUND' } }; // 해당 화폐로 가격이 설정되지 않음
    }

    const itemCost = price * BigInt(quantity);
    // 수수료 = 가격 * 퍼센트 / 100 (소수점 버림)
    const fee = feePercent > 0
      ? (itemCost * BigInt(Math.round(feePercent * 10))) / BigInt(1000)
      : BigInt(0);
    const totalCost = itemCost + fee;

    // 5. 잔액 확인 및 차감
    let newBalance: bigint;

    if (currency === 'topy') {
      const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: walletResult.error } };
      }
      const balance = walletResult.data?.balance ?? BigInt(0);
      if (balance < totalCost) {
        return {
          success: false,
          error: { type: 'INSUFFICIENT_BALANCE', required: totalCost, available: balance },
        };
      }
      newBalance = balance - totalCost;
      await this.topyWalletRepo.updateBalance(guildId, userId, totalCost, 'subtract');
    } else {
      const walletResult = await this.rubyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: walletResult.error } };
      }
      const balance = walletResult.data?.balance ?? BigInt(0);
      if (balance < totalCost) {
        return {
          success: false,
          error: { type: 'INSUFFICIENT_BALANCE', required: totalCost, available: balance },
        };
      }
      newBalance = balance - totalCost;
      await this.rubyWalletRepo.updateBalance(guildId, userId, totalCost, 'subtract');
    }

    // 6. 재고 감소
    if (item.stock !== null) {
      await this.shopRepo.decreaseStock(itemId, quantity);
    }

    // 7. 인벤토리에 추가
    // 기간제 아이템: 기존 만료일이 있고 유효하면 연장, 아니면 현재부터 시작
    let expiresAt: Date | null = null;
    if (isPeriodItem(item)) {
      const existingItemResult = await this.shopRepo.findUserItem(guildId, userId, itemId);
      const existingItem = existingItemResult.success ? existingItemResult.data : null;

      // 기존 만료일이 있고 아직 유효하면 기존 만료일부터 연장
      const baseDate = existingItem?.expiresAt && existingItem.expiresAt > now
        ? existingItem.expiresAt
        : now;

      // 구매 수량만큼 기간 연장
      const daysToAdd = item.durationDays * quantity;
      expiresAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }

    const userItemResult = await this.shopRepo.upsertUserItem(
      guildId,
      userId,
      itemId,
      quantity,
      expiresAt
    );
    if (!userItemResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: userItemResult.error } };
    }

    // 8. 거래 기록
    await this.transactionRepo.save(
      createTransaction(guildId, userId, currency, 'shop_purchase', -totalCost, newBalance, {
        fee,
      })
    );

    // 수수료가 있으면 별도 거래 기록 및 국고 적립
    if (fee > BigInt(0)) {
      await this.transactionRepo.save(
        createTransaction(guildId, userId, currency, 'fee', -fee, newBalance)
      );

      // 국고에 상점 수수료 적립
      if (this.treasuryRepo) {
        await this.treasuryRepo.addBalance(guildId, currency, fee);
        const treasuryResult = await this.treasuryRepo.findOrCreate(guildId);
        if (treasuryResult.success) {
          const balanceAfter = currency === 'topy'
            ? treasuryResult.data.topyBalance
            : treasuryResult.data.rubyBalance;
          await this.treasuryRepo.saveTransaction({
            guildId,
            currencyType: currency,
            transactionType: 'shop_fee',
            amount: fee,
            balanceAfter,
            relatedUserId: userId,
            description: `상점 수수료 (${item.name})`,
          });
        }
      }
    }

    // 9. 금고 구독 처리 (vault_subscription, dito_silver, dito_gold)
    const isVaultItem = item.itemType === 'vault_subscription' ||
                        item.itemType === 'dito_silver' ||
                        item.itemType === 'dito_gold';

    if (this.bankSubscriptionRepo && isVaultItem) {
      const daysToAdd = (item.durationDays || 30) * quantity;

      if (item.itemType === 'vault_subscription') {
        // 동적 등급 시스템 (vault_subscription)
        const effectConfig = item.effectConfig as VaultSubscriptionEffectConfig | null;
        if (!effectConfig) {
          return { success: false, error: { type: 'INVALID_ITEM_CONFIG' as const } };
        }

        // 기존 구독 확인 (동일 아이템)
        const existingResult = await this.bankSubscriptionRepo.findByUserAndShopItem(guildId, userId, item.id);
        const existing = existingResult.success ? existingResult.data : null;

        if (existing) {
          // 동일 아이템 구독: 기간 연장
          const newExpiresAt = new Date(existing.expiresAt.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
          await this.bankSubscriptionRepo.extendExpiration(existing.id, newExpiresAt);
        } else {
          // 기존 활성 구독 확인 (업그레이드 체크)
          const activeResult = await this.bankSubscriptionRepo.findActiveByUser(guildId, userId, now);
          const activeSubscription = activeResult.success ? activeResult.data : null;

          // 기존 구독이 있으면 업그레이드 여부 확인
          if (activeSubscription) {
            const currentLimit = activeSubscription.vaultLimit ?? BigInt(0);
            const currentRate = activeSubscription.interestRate ?? 0;
            const newLimit = BigInt(effectConfig.vaultLimit);
            const newRate = effectConfig.monthlyInterestRate;

            // 더 낮은 한도/이자율 아이템 구매 시 차단
            if (newLimit < currentLimit || newRate < currentRate) {
              return {
                success: false,
                error: {
                  type: 'CANNOT_DOWNGRADE_SUBSCRIPTION' as const,
                  currentTier: activeSubscription.tierName ?? '현재 등급',
                  newTier: effectConfig.tierName,
                },
              };
            }

            // 더 높은 등급이면 기존 구독 즉시 종료
            if (newLimit > currentLimit || newRate > currentRate) {
              await this.bankSubscriptionRepo.terminateSubscription(activeSubscription.id, now);
            }
          }

          // 새 구독 생성
          const newSubscription = createDynamicBankSubscription(
            guildId,
            userId,
            {
              tierName: effectConfig.tierName,
              shopItemId: item.id,
              vaultLimit: BigInt(effectConfig.vaultLimit),
              interestRate: effectConfig.monthlyInterestRate,
              minDepositDays: effectConfig.minDepositDays,
              transferFeeExempt: effectConfig.transferFeeExempt,
              purchaseFeePercent: effectConfig.purchaseFeePercent,
              marketFeePercent: effectConfig.marketFeePercent,
            },
            now,
            daysToAdd
          );
          await this.bankSubscriptionRepo.save(newSubscription);
        }
      } else {
        // 레거시 티어 시스템 (dito_silver, dito_gold)
        const tier: BankTier = item.itemType === 'dito_silver' ? 'silver' : 'gold';
        const benefits = getBankBenefits(tier);

        // effectConfig에서 금고 한도, 이자율, 최소 예치 기간 가져오기
        const effectConfig = item.effectConfig as { vaultLimit?: number; monthlyInterestRate?: number; minDepositDays?: number } | null;
        const vaultLimit = effectConfig?.vaultLimit != null ? BigInt(effectConfig.vaultLimit) : null;
        const interestRate = effectConfig?.monthlyInterestRate ?? null;
        const minDepositDays = effectConfig?.minDepositDays ?? null;

        // 기존 구독 확인
        const existingResult = await this.bankSubscriptionRepo.findByUserAndTier(guildId, userId, tier);
        const existing = existingResult.success ? existingResult.data : null;

        if (existing) {
          // 기존 구독 연장
          const newExpiresAt = new Date(existing.expiresAt.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
          await this.bankSubscriptionRepo.extendExpiration(existing.id, newExpiresAt);
        } else {
          // 새 구독 생성 (effectConfig 값 포함)
          const startsAt = now;
          const expiresAt = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
          await this.bankSubscriptionRepo.save({
            guildId,
            userId,
            tier,
            tierName: benefits.tierName,
            shopItemId: null,
            vaultLimit,
            interestRate,
            minDepositDays,
            transferFeeExempt: benefits.transferFeeExempt,
            purchaseFeePercent: benefits.purchaseFeePercent,
            marketFeePercent: benefits.marketFeePercent,
            startsAt,
            expiresAt,
          });
        }
      }
    }

    return {
      success: true,
      data: {
        item,
        userItem: userItemResult.data,
        totalCost,
        fee,
      },
    };
  }

  // ========== 유저 인벤토리 ==========

  async getUserItems(
    guildId: string,
    userId: string
  ): Promise<Result<UserItemV2[], CurrencyError>> {
    const result = await this.shopRepo.findUserItems(guildId, userId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async getUserItem(
    guildId: string,
    userId: string,
    shopItemId: number
  ): Promise<Result<UserItemV2 | null, CurrencyError>> {
    const result = await this.shopRepo.findUserItem(guildId, userId, shopItemId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  // ========== 관리자 아이템 지급/회수 ==========

  /**
   * 관리자 아이템 지급
   */
  async giveItem(
    guildId: string,
    userId: string,
    shopItemId: number,
    quantity: number = 1
  ): Promise<Result<{ userItem: UserItemV2; item: ShopItem }, CurrencyError>> {
    if (quantity < 1 || quantity > 999 || !Number.isInteger(quantity)) {
      return { success: false, error: { type: 'INVALID_QUANTITY' as const } };
    }

    // 아이템 존재 확인
    const itemResult = await this.shopRepo.findById(shopItemId);
    if (!itemResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: itemResult.error } };
    }
    const item = itemResult.data;
    if (!item) {
      return { success: false, error: { type: 'ITEM_NOT_FOUND' } };
    }

    // 기간제 아이템: 만료일 계산
    let expiresAt: Date | null = null;
    if (isPeriodItem(item)) {
      const now = this.clock.now();
      const existingItemResult = await this.shopRepo.findUserItem(guildId, userId, shopItemId);
      const existingItem = existingItemResult.success ? existingItemResult.data : null;

      const baseDate = existingItem?.expiresAt && existingItem.expiresAt > now
        ? existingItem.expiresAt
        : now;

      const daysToAdd = item.durationDays * quantity;
      expiresAt = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }

    // 인벤토리에 추가
    const userItemResult = await this.shopRepo.upsertUserItem(
      guildId,
      userId,
      shopItemId,
      quantity,
      expiresAt
    );
    if (!userItemResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: userItemResult.error } };
    }

    return {
      success: true,
      data: {
        userItem: userItemResult.data,
        item,
      },
    };
  }

  /**
   * 관리자 아이템 회수
   */
  async takeItem(
    guildId: string,
    userId: string,
    shopItemId: number,
    quantity: number = 1
  ): Promise<Result<{ remainingQuantity: number; item: ShopItem }, CurrencyError>> {
    if (quantity < 1 || quantity > 999 || !Number.isInteger(quantity)) {
      return { success: false, error: { type: 'INVALID_QUANTITY' as const } };
    }

    // 아이템 존재 확인
    const itemResult = await this.shopRepo.findById(shopItemId);
    if (!itemResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: itemResult.error } };
    }
    const item = itemResult.data;
    if (!item) {
      return { success: false, error: { type: 'ITEM_NOT_FOUND' } };
    }

    // 유저 아이템 확인
    const userItemResult = await this.shopRepo.findUserItem(guildId, userId, shopItemId);
    if (!userItemResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: userItemResult.error } };
    }
    const userItem = userItemResult.data;
    if (!userItem || userItem.quantity < 1) {
      return { success: false, error: { type: 'ITEM_NOT_OWNED' } };
    }

    // 수량 확인
    if (userItem.quantity < quantity) {
      return {
        success: false,
        error: {
          type: 'INSUFFICIENT_QUANTITY',
          required: quantity,
          available: userItem.quantity,
        },
      };
    }

    // 수량 차감
    const decreaseResult = await this.shopRepo.decreaseUserItemQuantity(userItem.id, quantity);
    if (!decreaseResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: decreaseResult.error } };
    }

    return {
      success: true,
      data: {
        remainingQuantity: userItem.quantity - quantity,
        item,
      },
    };
  }

  // ========== 감면권 관련 ==========

  /**
   * 특정 타입의 아이템 보유 여부 확인
   */
  async checkItemByType(
    guildId: string,
    userId: string,
    itemType: ShopItemType
  ): Promise<Result<{ hasItem: boolean; userItemId?: bigint; quantity?: number }, CurrencyError>> {
    const result = await this.shopRepo.findUserItemByType(guildId, userId, itemType);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }

    const item = result.data;
    if (item && item.quantity > 0) {
      return {
        success: true,
        data: { hasItem: true, userItemId: item.id, quantity: item.quantity },
      };
    }

    return { success: true, data: { hasItem: false } };
  }

  /**
   * 이체수수료감면권 확인 (단일 - 하위호환용)
   * @returns hasReduction: 감면권 보유 여부, reductionPercent: 감면 비율 (1-100)
   */
  async checkTransferFeeReduction(
    guildId: string,
    userId: string
  ): Promise<Result<{ hasReduction: boolean; reductionPercent: number; userItemId?: bigint }, CurrencyError>> {
    const itemResult = await this.shopRepo.findUserItemWithEffectByType(guildId, userId, 'transfer_fee_reduction');
    if (!itemResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: itemResult.error } };
    }

    const result = itemResult.data;
    if (result && result.userItem.quantity > 0) {
      // effectPercent가 null이면 100% (기본값)
      const reductionPercent = result.effectPercent ?? 100;
      return {
        success: true,
        data: {
          hasReduction: true,
          reductionPercent,
          userItemId: result.userItem.id,
        },
      };
    }

    return {
      success: true,
      data: {
        hasReduction: false,
        reductionPercent: 0,
      },
    };
  }

  /**
   * 이체수수료감면권 목록 조회 (여러 종류)
   * @returns 보유한 모든 이체수수료감면권 목록 (감면율 높은 순 정렬)
   */
  async getAllTransferFeeReductions(
    guildId: string,
    userId: string
  ): Promise<Result<{ userItemId: bigint; itemName: string; reductionPercent: number; quantity: number }[], CurrencyError>> {
    const itemsResult = await this.shopRepo.findAllUserItemsWithEffectByType(guildId, userId, 'transfer_fee_reduction');
    if (!itemsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: itemsResult.error } };
    }

    // 아이템 이름을 가져오기 위해 상점 아이템 조회
    const shopItemsResult = await this.shopRepo.findAllByGuild(guildId);
    if (!shopItemsResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: shopItemsResult.error } };
    }

    const shopItemMap = new Map(shopItemsResult.data.map(item => [item.id, item.name]));

    const reductions = itemsResult.data
      .filter(item => item.userItem.quantity > 0)
      .map(item => ({
        userItemId: item.userItem.id,
        itemName: shopItemMap.get(item.userItem.shopItemId) ?? '이체수수료감면권',
        reductionPercent: item.effectPercent ?? 100,
        quantity: item.userItem.quantity,
      }))
      // 감면율 높은 순으로 정렬
      .sort((a, b) => b.reductionPercent - a.reductionPercent);

    return { success: true, data: reductions };
  }

  /**
   * 이체수수료감면권 사용 (1개 소모)
   */
  async useTransferFeeReduction(
    guildId: string,
    userId: string,
    userItemId: bigint
  ): Promise<Result<void, CurrencyError>> {
    const result = await this.shopRepo.decreaseUserItemQuantity(userItemId, 1);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return { success: true, data: undefined };
  }

  // ========== 역할선택권 즉시구매 ==========

  /**
   * 역할선택권에서 역할을 즉시 구매
   * - 역할별 개별 가격 적용
   * - 인벤토리를 거치지 않고 바로 역할 부여
   */
  async purchaseRoleDirectly(
    guildId: string,
    userId: string,
    ticketId: number,
    roleOptionId: number,
    paymentCurrency: CurrencyType
  ): Promise<Result<DirectRolePurchaseResult, CurrencyError>> {
    if (!this.roleTicketRepo) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: { type: 'QUERY_ERROR', message: 'RoleTicketRepository not available' } } };
    }

    // 1. 티켓 조회 (역할 옵션 포함)
    const ticketResult = await this.roleTicketRepo.findWithOptions(ticketId);
    if (!ticketResult.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: ticketResult.error } };
    }
    const ticket = ticketResult.data;
    if (!ticket) {
      return { success: false, error: { type: 'TICKET_NOT_FOUND' } };
    }
    if (!ticket.enabled) {
      return { success: false, error: { type: 'TICKET_NOT_FOUND' } };
    }
    if (!ticket.instantPurchase) {
      return { success: false, error: { type: 'TICKET_NOT_FOUND' } }; // 즉시구매가 아닌 티켓
    }

    // 2. 역할 옵션 확인
    const roleOption = ticket.roleOptions?.find((o) => o.id === roleOptionId);
    if (!roleOption) {
      return { success: false, error: { type: 'ROLE_OPTION_NOT_FOUND' } };
    }

    // 3. 가격 확인
    const price = paymentCurrency === 'topy' ? roleOption.topyPrice : roleOption.rubyPrice;
    if (price === null || price === undefined) {
      return { success: false, error: { type: 'ITEM_NOT_FOUND' } }; // 해당 화폐로 가격이 설정되지 않음
    }

    // 4. 잔액 확인 및 차감
    let newBalance: bigint;

    if (paymentCurrency === 'topy') {
      const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: walletResult.error } };
      }
      const balance = walletResult.data?.balance ?? BigInt(0);
      if (balance < price) {
        return {
          success: false,
          error: { type: 'INSUFFICIENT_BALANCE', required: price, available: balance },
        };
      }
      newBalance = balance - price;
      await this.topyWalletRepo.updateBalance(guildId, userId, price, 'subtract');
    } else {
      const walletResult = await this.rubyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: walletResult.error } };
      }
      const balance = walletResult.data?.balance ?? BigInt(0);
      if (balance < price) {
        return {
          success: false,
          error: { type: 'INSUFFICIENT_BALANCE', required: price, available: balance },
        };
      }
      newBalance = balance - price;
      await this.rubyWalletRepo.updateBalance(guildId, userId, price, 'subtract');
    }

    // 5. 거래 기록
    await this.transactionRepo.save(
      createTransaction(guildId, userId, paymentCurrency, 'shop_purchase', -price, newBalance)
    );

    return {
      success: true,
      data: {
        roleId: roleOption.roleId,
        roleOption,
        paidAmount: price,
        currencyType: paymentCurrency,
      },
    };
  }
}

// Backward compatibility aliases
export type PurchaseV2Result = PurchaseResult;
export const ShopV2Service = ShopService;
