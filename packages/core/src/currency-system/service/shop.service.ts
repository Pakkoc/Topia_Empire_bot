import type { ClockPort } from '../../shared/port/clock.port';
import type { CurrencyError } from '../errors';
import type { ShopRepositoryPort } from '../port/shop-repository.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { RubyWalletRepositoryPort } from '../port/ruby-wallet-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type { CurrencySettingsRepositoryPort } from '../port/currency-settings-repository.port';
import type { BankSubscriptionRepositoryPort } from '../port/bank-subscription-repository.port';
import type {
  ShopItem,
  ShopItemType,
  CreateShopItemInput,
  UpdateShopItemInput,
} from '../domain/shop-item';
import type { UserItemV2 } from '../domain/user-item-v2';
import type { BankTier } from '../domain/bank-subscription';
import { Result } from '../../shared/types/result';
import { isPeriodItem, getItemPrice } from '../domain/shop-item';
import { createTransaction, type CurrencyType } from '../domain/currency-transaction';
import { CURRENCY_DEFAULTS } from '@topia/shared';

export interface PurchaseResult {
  item: ShopItem;
  userItem: UserItemV2;
  totalCost: bigint;
  fee: bigint;
}

export class ShopService {
  constructor(
    private readonly shopRepo: ShopRepositoryPort,
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly rubyWalletRepo: RubyWalletRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort,
    private readonly currencySettingsRepo: CurrencySettingsRepositoryPort,
    private readonly clock: ClockPort,
    private readonly bankSubscriptionRepo?: BankSubscriptionRepositoryPort
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
      createTransaction(guildId, userId, currency, 'shop_purchase', -totalCost, newBalance)
    );

    // 수수료가 있으면 별도 거래 기록
    if (fee > BigInt(0)) {
      await this.transactionRepo.save(
        createTransaction(guildId, userId, currency, 'fee', -fee, newBalance)
      );
    }

    // 9. 디토뱅크 구독 처리 (dito_silver, dito_gold)
    if (this.bankSubscriptionRepo && (item.itemType === 'dito_silver' || item.itemType === 'dito_gold')) {
      const tier: BankTier = item.itemType === 'dito_silver' ? 'silver' : 'gold';
      const daysToAdd = (item.durationDays || 30) * quantity;

      // 기존 구독 확인
      const existingResult = await this.bankSubscriptionRepo.findByUserAndTier(guildId, userId, tier);
      const existing = existingResult.success ? existingResult.data : null;

      if (existing) {
        // 기존 구독 연장
        const newExpiresAt = new Date(existing.expiresAt.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        await this.bankSubscriptionRepo.extendExpiration(existing.id, newExpiresAt);
      } else {
        // 새 구독 생성
        const startsAt = now;
        const expiresAt = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        await this.bankSubscriptionRepo.save({
          guildId,
          userId,
          tier,
          startsAt,
          expiresAt,
        });
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
   * 이체수수료감면권 확인
   */
  async checkTransferFeeReduction(
    guildId: string,
    userId: string
  ): Promise<Result<{ hasReduction: boolean; userItemId?: bigint }, CurrencyError>> {
    const result = await this.checkItemByType(guildId, userId, 'transfer_fee_reduction');
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: {
        hasReduction: result.data.hasItem,
        userItemId: result.data.userItemId,
      },
    };
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
}

// Backward compatibility aliases
export type PurchaseV2Result = PurchaseResult;
export const ShopV2Service = ShopService;
