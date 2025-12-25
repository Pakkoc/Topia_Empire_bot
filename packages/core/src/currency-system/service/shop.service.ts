import type { ClockPort } from '../../shared/port/clock.port';
import type { ShopRepositoryPort } from '../port/shop-repository.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { RubyWalletRepositoryPort } from '../port/ruby-wallet-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type { BankSubscriptionRepositoryPort } from '../port/bank-subscription-repository.port';
import type { ShopItem, ItemType } from '../domain/shop-item';
import type { UserItem } from '../domain/user-item';
import type { PurchaseHistory } from '../domain/purchase-history';
import type { ColorOption, CreateColorOption } from '../domain/color-option';
import type { BankTier, BankSubscription } from '../domain/bank-subscription';
import type { CurrencyError } from '../errors';
import { Result } from '../../shared/types/result';
import { createTransaction } from '../domain/currency-transaction';
import { createTopyWallet } from '../domain/topy-wallet';
import { createBankSubscription, SUBSCRIPTION_DURATION_DAYS } from '../domain/bank-subscription';

export interface PurchaseResult {
  item: ShopItem;
  price: bigint;
  fee: bigint;
  newBalance: bigint;
  bankSubscription?: {
    action: 'created' | 'extended' | 'queued';
    tier: BankTier;
    startsAt: Date;
    expiresAt: Date;
  };
}

export interface UseItemResult {
  itemType: string;
  remainingQuantity: number;
}

export class ShopService {
  constructor(
    private readonly shopRepo: ShopRepositoryPort,
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly rubyWalletRepo: RubyWalletRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort,
    private readonly clock: ClockPort,
    private readonly bankSubscriptionRepo?: BankSubscriptionRepositoryPort
  ) {}

  /**
   * 상점 아이템 목록 조회
   */
  async getShopItems(
    guildId: string,
    enabledOnly: boolean = true
  ): Promise<Result<ShopItem[], CurrencyError>> {
    const result = await this.shopRepo.findItems(guildId, { enabledOnly });
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 상점 아이템 단일 조회
   */
  async getShopItem(itemId: number): Promise<Result<ShopItem | null, CurrencyError>> {
    const result = await this.shopRepo.findItemById(itemId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 상점 아이템 생성 (관리자)
   */
  async createShopItem(
    guildId: string,
    name: string,
    price: bigint,
    currencyType: 'topy' | 'ruby',
    itemType: ItemType,
    options?: {
      description?: string;
      durationDays?: number;
      roleId?: string;
      stock?: number;
      maxPerUser?: number;
    }
  ): Promise<Result<ShopItem, CurrencyError>> {
    const item = {
      guildId,
      name,
      description: options?.description ?? null,
      price,
      currencyType,
      itemType,
      durationDays: options?.durationDays ?? null,
      roleId: options?.roleId ?? null,
      stock: options?.stock ?? null,
      maxPerUser: options?.maxPerUser ?? null,
      enabled: true,
    };

    const result = await this.shopRepo.saveItem(item);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 상점 아이템 수정 (관리자)
   */
  async updateShopItem(
    itemId: number,
    updates: Partial<Omit<ShopItem, 'id' | 'guildId' | 'createdAt'>>
  ): Promise<Result<void, CurrencyError>> {
    const result = await this.shopRepo.updateItem(itemId, updates);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(undefined);
  }

  /**
   * 상점 아이템 삭제 (관리자)
   */
  async deleteShopItem(itemId: number): Promise<Result<void, CurrencyError>> {
    const result = await this.shopRepo.deleteItem(itemId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(undefined);
  }

  /**
   * 아이템 구매
   */
  async purchaseItem(
    guildId: string,
    userId: string,
    itemId: number
  ): Promise<Result<PurchaseResult, CurrencyError>> {
    const now = this.clock.now();

    // 1. 아이템 조회
    const itemResult = await this.shopRepo.findItemById(itemId);
    if (!itemResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: itemResult.error });
    }
    if (!itemResult.data) {
      return Result.err({ type: 'ITEM_NOT_FOUND' });
    }

    const item = itemResult.data;

    // 2. 아이템 유효성 검사
    if (!item.enabled) {
      return Result.err({ type: 'ITEM_DISABLED' });
    }
    if (item.guildId !== guildId) {
      return Result.err({ type: 'ITEM_NOT_FOUND' });
    }

    // 3. 재고 확인
    if (item.stock !== null && item.stock <= 0) {
      return Result.err({ type: 'OUT_OF_STOCK' });
    }

    // 4. 유저당 구매 제한 확인
    if (item.maxPerUser !== null) {
      const countResult = await this.shopRepo.getUserPurchaseCount(guildId, userId, itemId);
      if (!countResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: countResult.error });
      }
      if (countResult.data >= item.maxPerUser) {
        return Result.err({
          type: 'PURCHASE_LIMIT_EXCEEDED',
          maxPerUser: item.maxPerUser,
          currentCount: countResult.data,
        });
      }
    }

    // 5. 수수료 계산 (뱅크 구독에 따라 면제)
    let feePercent = 1.2; // 기본 1.2%

    if (this.bankSubscriptionRepo) {
      const subscriptionResult = await this.bankSubscriptionRepo.findActiveByUser(guildId, userId, now);
      if (subscriptionResult.success && subscriptionResult.data) {
        const tier = subscriptionResult.data.tier;
        if (tier === 'gold') {
          feePercent = 0; // 골드: 수수료 면제
        }
        // 실버: 1.2% 유지
      }
    }

    const fee = feePercent > 0
      ? (item.price * BigInt(Math.round(feePercent * 10))) / BigInt(1000)
      : BigInt(0);
    const totalCost = item.price + fee;

    // 6. 잔액 확인 및 차감
    let newBalance: bigint;

    if (item.currencyType === 'topy') {
      const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: walletResult.error });
      }

      const wallet = walletResult.data ?? createTopyWallet(guildId, userId, now);
      if (wallet.balance < totalCost) {
        return Result.err({
          type: 'INSUFFICIENT_BALANCE',
          required: totalCost,
          available: wallet.balance,
        });
      }

      const subtractResult = await this.topyWalletRepo.updateBalance(
        guildId,
        userId,
        totalCost,
        'subtract'
      );
      if (!subtractResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: subtractResult.error });
      }
      newBalance = subtractResult.data.balance;
    } else {
      const walletResult = await this.rubyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: walletResult.error });
      }

      if (!walletResult.data || walletResult.data.balance < totalCost) {
        return Result.err({
          type: 'INSUFFICIENT_BALANCE',
          required: totalCost,
          available: walletResult.data?.balance ?? BigInt(0),
        });
      }

      const subtractResult = await this.rubyWalletRepo.updateBalance(
        guildId,
        userId,
        totalCost,
        'subtract'
      );
      if (!subtractResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: subtractResult.error });
      }
      newBalance = subtractResult.data.balance;
    }

    // 7. 재고 감소
    if (item.stock !== null) {
      await this.shopRepo.decreaseStock(itemId);
    }

    // 8. 아이템 타입별 처리
    let bankSubscriptionResult: PurchaseResult['bankSubscription'] | undefined;

    if (item.itemType === 'bank_silver' || item.itemType === 'bank_gold') {
      // 뱅크 구독 아이템: 구독 활성화
      if (!this.bankSubscriptionRepo) {
        return Result.err({ type: 'BANK_SERVICE_NOT_AVAILABLE' });
      }

      const tier: BankTier = item.itemType === 'bank_silver' ? 'silver' : 'gold';
      bankSubscriptionResult = await this.activateBankSubscription(guildId, userId, tier, now);
    } else {
      // 일반 아이템: 유저 아이템 지급
      const expiresAt = item.durationDays
        ? new Date(now.getTime() + item.durationDays * 24 * 60 * 60 * 1000)
        : null;

      await this.shopRepo.increaseUserItemQuantity(
        guildId,
        userId,
        item.itemType,
        1,
        expiresAt
      );
    }

    // 9. 구매 내역 저장
    await this.shopRepo.savePurchaseHistory({
      guildId,
      userId,
      itemId,
      itemName: item.name,
      price: item.price,
      fee,
      currencyType: item.currencyType,
      purchasedAt: now,
    });

    // 10. 거래 기록 저장
    await this.transactionRepo.save(
      createTransaction(
        guildId,
        userId,
        item.currencyType,
        'shop_purchase',
        item.price,
        newBalance + fee,
        { description: `상점 구매: ${item.name}` }
      )
    );

    if (fee > BigInt(0)) {
      await this.transactionRepo.save(
        createTransaction(
          guildId,
          userId,
          item.currencyType,
          'fee',
          fee,
          newBalance,
          { description: '구매 수수료' }
        )
      );
    }

    return Result.ok({
      item,
      price: item.price,
      fee,
      newBalance,
      bankSubscription: bankSubscriptionResult,
    });
  }

  /**
   * 뱅크 구독 활성화 (내부 메서드)
   */
  private async activateBankSubscription(
    guildId: string,
    userId: string,
    tier: BankTier,
    now: Date
  ): Promise<PurchaseResult['bankSubscription']> {
    if (!this.bankSubscriptionRepo) {
      throw new Error('BankSubscriptionRepository not provided');
    }

    // 1. 유저의 모든 구독 조회
    const allSubscriptionsResult = await this.bankSubscriptionRepo.findAllByUser(guildId, userId);
    const subscriptions = allSubscriptionsResult.success ? allSubscriptionsResult.data : [];

    // 현재 활성 구독 찾기
    const activeSubscription = subscriptions.find(
      (s) => s.startsAt <= now && s.expiresAt > now
    );

    // 미래 예약된 구독 중 같은 티어 찾기
    const sameTierFuture = subscriptions.find(
      (s) => s.tier === tier && s.startsAt > now
    );

    // 2. 같은 티어가 이미 있는 경우 (활성 또는 예약) → 연장
    if (activeSubscription?.tier === tier) {
      const newExpiresAt = new Date(
        activeSubscription.expiresAt.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000
      );

      await this.bankSubscriptionRepo.extendExpiration(activeSubscription.id, newExpiresAt);

      return {
        action: 'extended',
        tier,
        startsAt: activeSubscription.startsAt,
        expiresAt: newExpiresAt,
      };
    }

    if (sameTierFuture) {
      const newExpiresAt = new Date(
        sameTierFuture.expiresAt.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000
      );

      await this.bankSubscriptionRepo.extendExpiration(sameTierFuture.id, newExpiresAt);

      return {
        action: 'extended',
        tier,
        startsAt: sameTierFuture.startsAt,
        expiresAt: newExpiresAt,
      };
    }

    // 3. 다른 티어가 활성화 중인 경우 → 현재 만료 후 시작 (queue)
    if (activeSubscription && activeSubscription.tier !== tier) {
      const startsAt = activeSubscription.expiresAt;
      const newSubscription = createBankSubscription(guildId, userId, tier, startsAt);

      const saveResult = await this.bankSubscriptionRepo.save(newSubscription);
      const saved = saveResult.success ? saveResult.data : null;

      return {
        action: 'queued',
        tier,
        startsAt: saved?.startsAt ?? startsAt,
        expiresAt: saved?.expiresAt ?? new Date(startsAt.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000),
      };
    }

    // 4. 구독이 없는 경우 → 즉시 시작
    const newSubscription = createBankSubscription(guildId, userId, tier, now);
    const saveResult = await this.bankSubscriptionRepo.save(newSubscription);
    const saved = saveResult.success ? saveResult.data : null;

    return {
      action: 'created',
      tier,
      startsAt: saved?.startsAt ?? now,
      expiresAt: saved?.expiresAt ?? new Date(now.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * 색상 아이템 구매 (인벤토리에 저장, 역할 부여 X)
   */
  async purchaseColorItem(
    guildId: string,
    userId: string,
    itemId: number,
    colorOptionId: number
  ): Promise<Result<PurchaseResult & { colorOption: ColorOption }, CurrencyError>> {
    const now = this.clock.now();

    // 1. 아이템 조회
    const itemResult = await this.shopRepo.findItemById(itemId);
    if (!itemResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: itemResult.error });
    }
    if (!itemResult.data) {
      return Result.err({ type: 'ITEM_NOT_FOUND' });
    }

    const item = itemResult.data;

    // 2. 아이템이 색상변경권인지 확인
    if (item.itemType !== 'color') {
      return Result.err({ type: 'ITEM_NOT_FOUND' });
    }

    // 3. 색상 옵션 조회
    const colorOptionResult = await this.shopRepo.findColorOptionById(colorOptionId);
    if (!colorOptionResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: colorOptionResult.error });
    }
    if (!colorOptionResult.data || colorOptionResult.data.itemId !== itemId) {
      return Result.err({ type: 'ITEM_NOT_FOUND' });
    }

    const colorOption = colorOptionResult.data;

    // 4. 활성화 확인
    if (!item.enabled) {
      return Result.err({ type: 'ITEM_DISABLED' });
    }

    // 5. 재고 확인
    if (item.stock !== null && item.stock <= 0) {
      return Result.err({ type: 'OUT_OF_STOCK' });
    }

    // 6. 가격 결정 (색상별 가격, 0이면 아이템 기본 가격)
    const price = colorOption.price > BigInt(0) ? colorOption.price : item.price;

    // 7. 수수료 계산 (뱅크 구독에 따라 면제)
    let colorFeePercent = 1.2; // 기본 1.2%

    if (this.bankSubscriptionRepo) {
      const subscriptionResult = await this.bankSubscriptionRepo.findActiveByUser(guildId, userId, now);
      if (subscriptionResult.success && subscriptionResult.data) {
        const tier = subscriptionResult.data.tier;
        if (tier === 'gold') {
          colorFeePercent = 0; // 골드: 수수료 면제
        }
        // 실버: 1.2% 유지
      }
    }

    const fee = colorFeePercent > 0
      ? (price * BigInt(Math.round(colorFeePercent * 10))) / BigInt(1000)
      : BigInt(0);
    const totalCost = price + fee;

    // 8. 잔액 차감
    let newBalance: bigint;

    if (item.currencyType === 'topy') {
      const walletResult = await this.topyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: walletResult.error });
      }

      if (!walletResult.data) {
        await this.topyWalletRepo.save(createTopyWallet(guildId, userId, this.clock.now()));
      }

      const balance = walletResult.data?.balance ?? BigInt(0);
      if (balance < totalCost) {
        return Result.err({
          type: 'INSUFFICIENT_BALANCE',
          required: totalCost,
          available: balance,
        });
      }

      const subtractResult = await this.topyWalletRepo.updateBalance(
        guildId,
        userId,
        totalCost,
        'subtract'
      );
      if (!subtractResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: subtractResult.error });
      }
      newBalance = subtractResult.data.balance;
    } else {
      const walletResult = await this.rubyWalletRepo.findByUser(guildId, userId);
      if (!walletResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: walletResult.error });
      }

      if (!walletResult.data || walletResult.data.balance < totalCost) {
        return Result.err({
          type: 'INSUFFICIENT_BALANCE',
          required: totalCost,
          available: walletResult.data?.balance ?? BigInt(0),
        });
      }

      const subtractResult = await this.rubyWalletRepo.updateBalance(
        guildId,
        userId,
        totalCost,
        'subtract'
      );
      if (!subtractResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: subtractResult.error });
      }
      newBalance = subtractResult.data.balance;
    }

    // 9. 재고 감소
    if (item.stock !== null) {
      await this.shopRepo.decreaseStock(itemId);
    }

    // 10. 유저 아이템 지급 (색상 코드 포함)
    const colorItemType = `color_${colorOption.color}`;
    const expiresAt = item.durationDays
      ? new Date(now.getTime() + item.durationDays * 24 * 60 * 60 * 1000)
      : null;

    await this.shopRepo.increaseUserItemQuantity(
      guildId,
      userId,
      colorItemType,
      1,
      expiresAt
    );

    // 11. 구매 내역 저장
    await this.shopRepo.savePurchaseHistory({
      guildId,
      userId,
      itemId,
      itemName: `${item.name} - ${colorOption.name}`,
      price,
      fee,
      currencyType: item.currencyType,
      purchasedAt: now,
    });

    // 12. 거래 기록 저장
    await this.transactionRepo.save(
      createTransaction(
        guildId,
        userId,
        item.currencyType,
        'shop_purchase',
        price,
        newBalance + fee,
        { description: `상점 구매: ${item.name} - ${colorOption.name}` }
      )
    );

    if (fee > BigInt(0)) {
      await this.transactionRepo.save(
        createTransaction(
          guildId,
          userId,
          item.currencyType,
          'fee',
          fee,
          newBalance,
          { description: '구매 수수료' }
        )
      );
    }

    return Result.ok({
      item,
      price,
      fee,
      newBalance,
      colorOption,
    });
  }

  /**
   * 유저 보유 아이템 목록 조회
   */
  async getUserItems(
    guildId: string,
    userId: string
  ): Promise<Result<UserItem[], CurrencyError>> {
    const result = await this.shopRepo.findUserItems(guildId, userId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 아이템 사용
   */
  async useItem(
    guildId: string,
    userId: string,
    itemType: string
  ): Promise<Result<UseItemResult, CurrencyError>> {
    const now = this.clock.now();

    // 1. 유저 아이템 조회
    const itemResult = await this.shopRepo.findUserItem(guildId, userId, itemType);
    if (!itemResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: itemResult.error });
    }
    if (!itemResult.data || itemResult.data.quantity <= 0) {
      return Result.err({ type: 'ITEM_NOT_OWNED' });
    }

    const userItem = itemResult.data;

    // 2. 만료 확인
    if (userItem.expiresAt && userItem.expiresAt < now) {
      return Result.err({ type: 'ITEM_EXPIRED' });
    }

    // 3. 수량 감소
    await this.shopRepo.decreaseUserItemQuantity(guildId, userId, itemType, 1);

    return Result.ok({
      itemType,
      remainingQuantity: userItem.quantity - 1,
    });
  }

  /**
   * 구매 내역 조회
   */
  async getPurchaseHistory(
    guildId: string,
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<PurchaseHistory[], CurrencyError>> {
    const result = await this.shopRepo.findPurchaseHistory(guildId, userId, options);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  // ========== Color Options ==========

  /**
   * 색상 옵션 목록 조회
   */
  async getColorOptions(itemId: number): Promise<Result<ColorOption[], CurrencyError>> {
    const result = await this.shopRepo.findColorOptions(itemId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 색상 옵션 추가
   */
  async addColorOption(
    itemId: number,
    color: string,
    name: string,
    roleId: string,
    price: bigint = BigInt(0)
  ): Promise<Result<ColorOption, CurrencyError>> {
    const option: CreateColorOption = {
      itemId,
      color: color.toUpperCase(),
      name,
      roleId,
      price,
    };

    const result = await this.shopRepo.saveColorOption(option);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(result.data);
  }

  /**
   * 색상 옵션 삭제
   */
  async deleteColorOption(optionId: number): Promise<Result<void, CurrencyError>> {
    const result = await this.shopRepo.deleteColorOption(optionId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }
    return Result.ok(undefined);
  }

  // ========== Color Application ==========

  /**
   * 유저의 보유 색상 목록 조회
   * user_items에서 color_ prefix가 붙은 아이템을 필터링하여 ColorOption 정보와 함께 반환
   */
  async getOwnedColors(
    guildId: string,
    userId: string
  ): Promise<Result<Array<{ colorCode: string; colorOption: ColorOption | null; quantity: number; expiresAt: Date | null }>, CurrencyError>> {
    // 1. 유저의 모든 아이템 조회
    const userItemsResult = await this.shopRepo.findUserItems(guildId, userId);
    if (!userItemsResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: userItemsResult.error });
    }

    // 2. color_ prefix가 붙은 아이템만 필터링
    const colorItems = userItemsResult.data.filter(
      (item) => item.itemType.startsWith('color_') && item.quantity > 0
    );

    // 3. 각 색상에 대한 ColorOption 정보 조회
    const ownedColors: Array<{ colorCode: string; colorOption: ColorOption | null; quantity: number; expiresAt: Date | null }> = [];

    for (const item of colorItems) {
      // item_type 형식: color_#FF0000
      const colorCode = item.itemType.replace('color_', '');

      // 만료 확인
      if (item.expiresAt && item.expiresAt < this.clock.now()) {
        continue; // 만료된 아이템은 건너뜀
      }

      const colorOptionResult = await this.shopRepo.findColorOptionByColor(guildId, colorCode);
      const colorOption = colorOptionResult.success ? colorOptionResult.data : null;

      ownedColors.push({
        colorCode,
        colorOption,
        quantity: item.quantity,
        expiresAt: item.expiresAt,
      });
    }

    return Result.ok(ownedColors);
  }

  /**
   * 길드의 모든 색상 역할 ID 조회 (기존 색상 역할 제거용)
   */
  async getAllColorRoleIds(guildId: string): Promise<Result<string[], CurrencyError>> {
    const result = await this.shopRepo.findAllColorOptionsByGuild(guildId);
    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }

    const roleIds = result.data.map((option) => option.roleId);
    return Result.ok([...new Set(roleIds)]); // 중복 제거
  }

  /**
   * 색상 적용 (역할 부여 정보 반환)
   * 실제 역할 부여/제거는 Bot에서 수행
   */
  async applyColor(
    guildId: string,
    userId: string,
    colorCode: string
  ): Promise<Result<{ roleIdToAdd: string; roleIdsToRemove: string[] }, CurrencyError>> {
    // 1. 해당 색상을 보유하고 있는지 확인
    const ownedColorsResult = await this.getOwnedColors(guildId, userId);
    if (!ownedColorsResult.success) {
      return Result.err(ownedColorsResult.error);
    }

    const ownedColor = ownedColorsResult.data.find(
      (c) => c.colorCode.toUpperCase() === colorCode.toUpperCase()
    );

    if (!ownedColor) {
      return Result.err({ type: 'COLOR_NOT_OWNED' });
    }

    if (!ownedColor.colorOption) {
      return Result.err({ type: 'COLOR_OPTION_NOT_FOUND' });
    }

    // 2. 부여할 역할 ID
    const roleIdToAdd = ownedColor.colorOption.roleId;

    // 3. 제거할 역할 ID 목록 (다른 모든 색상 역할)
    const allColorRoleIdsResult = await this.getAllColorRoleIds(guildId);
    if (!allColorRoleIdsResult.success) {
      return Result.err(allColorRoleIdsResult.error);
    }

    const roleIdsToRemove = allColorRoleIdsResult.data.filter(
      (roleId) => roleId !== roleIdToAdd
    );

    return Result.ok({ roleIdToAdd, roleIdsToRemove });
  }
}
