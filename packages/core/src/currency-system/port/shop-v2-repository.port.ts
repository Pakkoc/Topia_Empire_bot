import type { Result } from '../../shared/types/result';
import type { RepositoryError } from '../errors';
import type {
  ShopItemV2,
  CreateShopItemV2Input,
  UpdateShopItemV2Input,
} from '../domain/shop-item-v2';
import type { UserItemV2 } from '../domain/user-item-v2';

export interface ShopV2RepositoryPort {
  // 상점 아이템 CRUD
  findAllByGuild(guildId: string): Promise<Result<ShopItemV2[], RepositoryError>>;
  findEnabledByGuild(guildId: string): Promise<Result<ShopItemV2[], RepositoryError>>;
  findById(id: number): Promise<Result<ShopItemV2 | null, RepositoryError>>;
  create(input: CreateShopItemV2Input): Promise<Result<ShopItemV2, RepositoryError>>;
  update(id: number, input: UpdateShopItemV2Input): Promise<Result<void, RepositoryError>>;
  delete(id: number): Promise<Result<void, RepositoryError>>;
  decreaseStock(id: number): Promise<Result<void, RepositoryError>>;

  // 유저 아이템 (인벤토리)
  findUserItem(
    guildId: string,
    userId: string,
    shopItemId: number
  ): Promise<Result<UserItemV2 | null, RepositoryError>>;
  findUserItems(guildId: string, userId: string): Promise<Result<UserItemV2[], RepositoryError>>;
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
    appliedAt: Date | null
  ): Promise<Result<void, RepositoryError>>;

  // 구매 횟수 조회
  getUserPurchaseCount(
    guildId: string,
    userId: string,
    shopItemId: number
  ): Promise<Result<number, RepositoryError>>;
}
