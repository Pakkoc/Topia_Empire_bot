import type { Result } from '../../shared/types/result';
import type { RepositoryError } from '../errors';
import type {
  ShopItem,
  ShopItemType,
  CreateShopItemInput,
  UpdateShopItemInput,
} from '../domain/shop-item';
import type { UserItemV2 } from '../domain/user-item-v2';

export interface ShopRepositoryPort {
  // 상점 아이템 CRUD
  findAllByGuild(guildId: string): Promise<Result<ShopItem[], RepositoryError>>;
  findEnabledByGuild(guildId: string): Promise<Result<ShopItem[], RepositoryError>>;
  findEnabledByGuildAndCurrency(
    guildId: string,
    currencyType: 'topy' | 'ruby'
  ): Promise<Result<ShopItem[], RepositoryError>>;
  findById(id: number): Promise<Result<ShopItem | null, RepositoryError>>;
  findByItemType(guildId: string, itemType: ShopItemType): Promise<Result<ShopItem | null, RepositoryError>>;
  findAllByItemTypes(guildId: string, itemTypes: ShopItemType[]): Promise<Result<ShopItem[], RepositoryError>>;
  create(input: CreateShopItemInput): Promise<Result<ShopItem, RepositoryError>>;
  update(id: number, input: UpdateShopItemInput): Promise<Result<void, RepositoryError>>;
  delete(id: number): Promise<Result<void, RepositoryError>>;
  decreaseStock(id: number, quantity?: number): Promise<Result<void, RepositoryError>>;

  // 유저 아이템 (인벤토리)
  findUserItem(
    guildId: string,
    userId: string,
    shopItemId: number
  ): Promise<Result<UserItemV2 | null, RepositoryError>>;
  findUserItems(guildId: string, userId: string): Promise<Result<UserItemV2[], RepositoryError>>;
  findUserItemByType(
    guildId: string,
    userId: string,
    itemType: ShopItemType
  ): Promise<Result<UserItemV2 | null, RepositoryError>>;
  findExpiredItems(before: Date): Promise<Result<UserItemV2[], RepositoryError>>;

  // 아이템 구매 (수량 증가 또는 생성)
  upsertUserItem(
    guildId: string,
    userId: string,
    shopItemId: number,
    quantityDelta: number,
    expiresAt: Date | null
  ): Promise<Result<UserItemV2, RepositoryError>>;

  // 수량 감소
  decreaseUserItemQuantity(
    id: bigint,
    amount: number
  ): Promise<Result<void, RepositoryError>>;

  // 현재 역할 업데이트 (기간제용)
  updateCurrentRole(
    id: bigint,
    roleId: string | null,
    appliedAt: Date | null,
    roleExpiresAt: Date | null,
    fixedRoleId?: string | null
  ): Promise<Result<void, RepositoryError>>;

  // 역할 효과 만료된 아이템 조회
  findRoleExpiredItems(before: Date): Promise<Result<UserItemV2[], RepositoryError>>;

  // 구매 횟수 조회
  getUserPurchaseCount(
    guildId: string,
    userId: string,
    shopItemId: number
  ): Promise<Result<number, RepositoryError>>;
}

// Backward compatibility alias
export type ShopV2RepositoryPort = ShopRepositoryPort;
