import type { ClockPort } from '../../shared/port/clock.port';
import type { CurrencyError } from '../errors';
import type { ShopV2RepositoryPort } from '../port/shop-v2-repository.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { RubyWalletRepositoryPort } from '../port/ruby-wallet-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type {
  ShopItemV2,
  CreateShopItemV2Input,
  UpdateShopItemV2Input,
} from '../domain/shop-item-v2';
import type { UserItemV2 } from '../domain/user-item-v2';
import { Result } from '../../shared/types/result';
import { isPeriodItem } from '../domain/shop-item-v2';
import { createTransaction } from '../domain/currency-transaction';

export interface PurchaseV2Result {
  item: ShopItemV2;
  userItem: UserItemV2;
  totalCost: bigint;
}

export class ShopV2Service {
  constructor(
    private readonly shopRepo: ShopV2RepositoryPort,
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly rubyWalletRepo: RubyWalletRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  // ========== 상점 아이템 CRUD ==========

  async getShopItems(guildId: string): Promise<Result<ShopItemV2[], CurrencyError>> {
    const result = await this.shopRepo.findAllByGuild(guildId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async getEnabledShopItems(guildId: string): Promise<Result<ShopItemV2[], CurrencyError>> {
    const result = await this.shopRepo.findEnabledByGuild(guildId);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async getShopItem(id: number): Promise<Result<ShopItemV2 | null, CurrencyError>> {
    const result = await this.shopRepo.findById(id);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async createShopItem(input: CreateShopItemV2Input): Promise<Result<ShopItemV2, CurrencyError>> {
    const result = await this.shopRepo.create(input);
    if (!result.success) {
      return { success: false, error: { type: 'REPOSITORY_ERROR', cause: result.error } };
    }
    return result;
  }

  async updateShopItem(
    id: number,
    input: UpdateShopItemV2Input
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
    itemId: number
  ): Promise<Result<PurchaseV2Result, CurrencyError>> {
    const now = this.clock.now();

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
    if (item.stock !== null && item.stock <= 0) {
      return { success: false, error: { type: 'OUT_OF_STOCK' } };
    }

    // 3. 유저당 구매 제한 확인
    if (item.maxPerUser !== null) {
      const countResult = await this.shopRepo.getUserPurchaseCount(guildId, userId, itemId);
      if (!countResult.success) {
        return { success: false, error: { type: 'REPOSITORY_ERROR', cause: countResult.error } };
      }
      if (countResult.data >= item.maxPerUser) {
        return {
          success: false,
          error: {
            type: 'PURCHASE_LIMIT_EXCEEDED',
            maxPerUser: item.maxPerUser,
            currentCount: countResult.data,
          },
        };
      }
    }

    // 4. 잔액 확인 및 차감
    const totalCost = item.price;
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
      await this.shopRepo.decreaseStock(itemId);
    }

    // 6. 인벤토리에 추가
    const expiresAt = isPeriodItem(item)
      ? new Date(now.getTime() + item.durationDays * 24 * 60 * 60 * 1000)
      : null;

    const userItemResult = await this.shopRepo.upsertUserItem(
      guildId,
      userId,
      itemId,
      1, // 수량 1 증가
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
