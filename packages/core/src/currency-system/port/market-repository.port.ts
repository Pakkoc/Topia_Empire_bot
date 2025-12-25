import type { Result } from '../../shared/types/result';
import type { MarketListing, MarketCategory, MarketStatus } from '../domain/market-listing';
import type { RepositoryError } from '../errors';

export interface MarketListingFilter {
  category?: MarketCategory;
  currencyType?: 'topy' | 'ruby';
  status?: MarketStatus;
  sellerId?: string;
  limit?: number;
  offset?: number;
}

export interface MarketRepositoryPort {
  /**
   * 장터 상품 목록 조회
   */
  findListings(
    guildId: string,
    filter?: MarketListingFilter
  ): Promise<Result<MarketListing[], RepositoryError>>;

  /**
   * 장터 상품 단일 조회
   */
  findById(listingId: bigint): Promise<Result<MarketListing | null, RepositoryError>>;

  /**
   * 판매자의 활성 상품 개수 조회
   */
  countActiveListingsBySeller(
    guildId: string,
    sellerId: string
  ): Promise<Result<number, RepositoryError>>;

  /**
   * 장터 상품 저장
   */
  save(listing: Omit<MarketListing, 'id'>): Promise<Result<MarketListing, RepositoryError>>;

  /**
   * 장터 상품 상태 업데이트
   */
  updateStatus(
    listingId: bigint,
    status: MarketStatus,
    buyerId?: string,
    soldAt?: Date
  ): Promise<Result<void, RepositoryError>>;

  /**
   * 만료된 상품 일괄 업데이트
   */
  expireListings(now: Date): Promise<Result<number, RepositoryError>>;

  /**
   * 판매자의 상품 목록 조회
   */
  findBySellerld(
    guildId: string,
    sellerId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<MarketListing[], RepositoryError>>;

  /**
   * 구매자의 구매 내역 조회
   */
  findByBuyerId(
    guildId: string,
    buyerId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<MarketListing[], RepositoryError>>;

  /**
   * 전체 활성 상품 개수 조회
   */
  countActiveListings(
    guildId: string,
    filter?: { category?: MarketCategory; currencyType?: 'topy' | 'ruby' }
  ): Promise<Result<number, RepositoryError>>;
}
