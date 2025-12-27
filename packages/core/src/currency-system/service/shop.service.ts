import type { ClockPort } from '../../shared/port/clock.port';
import type { CurrencyError } from '../errors';
import type { ShopRepositoryPort } from '../port/shop-repository.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { RubyWalletRepositoryPort } from '../port/ruby-wallet-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type {
  ShopItem,
  CreateShopItemInput,
  UpdateShopItemInput,
} from '../domain/shop-item';
import type { UserItemV2 } from '../domain/user-item-v2';
import { Result } from '../../shared/types/result';
import { isPeriodItem } from '../domain/shop-item';
import { createTransaction } from '../domain/currency-transaction';

export interface PurchaseResult {
  item: ShopItem;
  userItem: UserItemV2;
  totalCost: bigint;
}

export class ShopService {
  constructor(
    private readonly shopRepo: ShopRepositoryPort,
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly rubyWalletRepo: RubyWalletRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort,
    private readonly clock: ClockPort
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
    quantity: number = 1
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

    // 4. 잔액 확인 및 차감
    const totalCost = item.price * BigInt(quantity);
    let newBalance: bigint;

    if (item.currencyType === 'topy') {
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

    // 5. 재고 감소
    if (item.stock !== null) {
      await this.shopRepo.decreaseStock(itemId, quantity);
    }

    // 6. 인벤토리에 추가
    const expiresAt = isPeriodItem(item)
      ? new Date(now.getTime() + item.durationDays * 24 * 60 * 60 * 1000)
      : null;

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

    // 7. 거래 기록
    await this.transactionRepo.save(
      createTransaction(guildId, userId, item.currencyType, 'shop_purchase', -totalCost, newBalance)
    );

    return {
      success: true,
      data: {
        item,
        userItem: userItemResult.data,
        totalCost,
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
}

// Backward compatibility aliases
export type PurchaseV2Result = PurchaseResult;
export const ShopV2Service = ShopService;
