import type { Result } from '../../shared/types/result';
import type { ShopItem, ItemType } from '../domain/shop-item';
import type { UserItem } from '../domain/user-item';
import type { PurchaseHistory } from '../domain/purchase-history';
import type { ColorOption, CreateColorOption } from '../domain/color-option';
import type { RepositoryError } from '../errors';

export interface ShopRepositoryPort {
  // ========== Shop Items ==========

  /**
   * 상점 아이템 목록 조회
   */
  findItems(
    guildId: string,
    options?: { enabledOnly?: boolean }
  ): Promise<Result<ShopItem[], RepositoryError>>;

  /**
   * 상점 아이템 단일 조회
   */
  findItemById(itemId: number): Promise<Result<ShopItem | null, RepositoryError>>;

  /**
   * 상점 아이템 저장
   */
  saveItem(item: Omit<ShopItem, 'id' | 'createdAt'>): Promise<Result<ShopItem, RepositoryError>>;

  /**
   * 상점 아이템 업데이트
   */
  updateItem(
    itemId: number,
    updates: Partial<Omit<ShopItem, 'id' | 'guildId' | 'createdAt'>>
  ): Promise<Result<void, RepositoryError>>;

  /**
   * 상점 아이템 삭제
   */
  deleteItem(itemId: number): Promise<Result<void, RepositoryError>>;

  /**
   * 재고 감소
   */
  decreaseStock(itemId: number): Promise<Result<void, RepositoryError>>;

  // ========== User Items ==========

  /**
   * 유저 보유 아이템 목록 조회
   */
  findUserItems(
    guildId: string,
    userId: string
  ): Promise<Result<UserItem[], RepositoryError>>;

  /**
   * 유저의 특정 타입 아이템 조회
   */
  findUserItem(
    guildId: string,
    userId: string,
    itemType: string
  ): Promise<Result<UserItem | null, RepositoryError>>;

  /**
   * 유저 아이템 저장/업데이트 (upsert)
   */
  upsertUserItem(
    guildId: string,
    userId: string,
    itemType: string,
    quantity: number,
    expiresAt: Date | null
  ): Promise<Result<void, RepositoryError>>;

  /**
   * 유저 아이템 수량 증가
   */
  increaseUserItemQuantity(
    guildId: string,
    userId: string,
    itemType: string,
    amount: number,
    expiresAt: Date | null
  ): Promise<Result<void, RepositoryError>>;

  /**
   * 유저 아이템 수량 감소
   */
  decreaseUserItemQuantity(
    guildId: string,
    userId: string,
    itemType: string,
    amount: number
  ): Promise<Result<void, RepositoryError>>;

  // ========== Purchase History ==========

  /**
   * 구매 내역 저장
   */
  savePurchaseHistory(
    history: Omit<PurchaseHistory, 'id'>
  ): Promise<Result<void, RepositoryError>>;

  /**
   * 유저 구매 내역 조회
   */
  findPurchaseHistory(
    guildId: string,
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<PurchaseHistory[], RepositoryError>>;

  /**
   * 특정 아이템에 대한 유저 구매 횟수 조회
   */
  getUserPurchaseCount(
    guildId: string,
    userId: string,
    itemId: number
  ): Promise<Result<number, RepositoryError>>;

  // ========== Color Options ==========

  /**
   * 색상 옵션 목록 조회
   */
  findColorOptions(itemId: number): Promise<Result<ColorOption[], RepositoryError>>;

  /**
   * 색상 옵션 단일 조회
   */
  findColorOptionById(optionId: number): Promise<Result<ColorOption | null, RepositoryError>>;

  /**
   * 색상 옵션 저장
   */
  saveColorOption(option: CreateColorOption): Promise<Result<ColorOption, RepositoryError>>;

  /**
   * 색상 옵션 삭제
   */
  deleteColorOption(optionId: number): Promise<Result<void, RepositoryError>>;

  /**
   * 아이템의 모든 색상 옵션 삭제
   */
  deleteColorOptionsByItemId(itemId: number): Promise<Result<void, RepositoryError>>;

  /**
   * 길드의 모든 색상 옵션 조회
   */
  findAllColorOptionsByGuild(guildId: string): Promise<Result<ColorOption[], RepositoryError>>;

  /**
   * 색상 코드로 색상 옵션 조회 (길드 내에서)
   */
  findColorOptionByColor(guildId: string, color: string): Promise<Result<ColorOption | null, RepositoryError>>;
}
