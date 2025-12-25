import type { ClockPort } from '../../shared/port/clock.port';
import type { MarketRepositoryPort, MarketListingFilter } from '../port/market-repository.port';
import type { TopyWalletRepositoryPort } from '../port/topy-wallet-repository.port';
import type { RubyWalletRepositoryPort } from '../port/ruby-wallet-repository.port';
import type { CurrencyTransactionRepositoryPort } from '../port/currency-transaction-repository.port';
import type { MarketListing, MarketCategory, CreateMarketListing } from '../domain/market-listing';
import type { CurrencyError } from '../errors';
import { Result } from '../../shared/types/result';
import { createMarketListing } from '../domain/market-listing';
import { createTransaction } from '../domain/currency-transaction';
import { createTopyWallet } from '../domain/topy-wallet';
import { createRubyWallet } from '../domain/ruby-wallet';
import {
  calculateMarketFee,
  isValidMarketPrice,
  getMinMarketPrice,
  calculateSellerReceiveAmount,
} from '../functions/calculate-market-fee';

const MAX_ACTIVE_LISTINGS_PER_USER = 10;

export interface CreateListingResult {
  listing: MarketListing;
}

export interface PurchaseListingResult {
  listing: MarketListing;
  price: bigint;
  fee: bigint;
  sellerReceived: bigint;
  buyerNewBalance: bigint;
}

export class MarketService {
  constructor(
    private readonly marketRepo: MarketRepositoryPort,
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly rubyWalletRepo: RubyWalletRepositoryPort,
    private readonly transactionRepo: CurrencyTransactionRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  /**
   * 장터 상품 목록 조회
   */
  async getListings(
    guildId: string,
    filter?: MarketListingFilter
  ): Promise<Result<MarketListing[], CurrencyError>> {
    const result = await this.marketRepo.findListings(guildId, {
      ...filter,
      status: filter?.status ?? 'active',
    });

    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }

    return Result.ok(result.data);
  }

  /**
   * 장터 상품 단일 조회
   */
  async getListing(listingId: bigint): Promise<Result<MarketListing | null, CurrencyError>> {
    const result = await this.marketRepo.findById(listingId);

    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }

    return Result.ok(result.data);
  }

  /**
   * 활성 상품 개수 조회
   */
  async getActiveListingsCount(
    guildId: string,
    filter?: { category?: MarketCategory; currencyType?: 'topy' | 'ruby' }
  ): Promise<Result<number, CurrencyError>> {
    const result = await this.marketRepo.countActiveListings(guildId, filter);

    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }

    return Result.ok(result.data);
  }

  /**
   * 장터 상품 등록
   */
  async createListing(
    data: CreateMarketListing
  ): Promise<Result<CreateListingResult, CurrencyError>> {
    const now = this.clock.now();

    // 1. 가격 유효성 검사
    if (!isValidMarketPrice(data.price, data.currencyType)) {
      return Result.err({
        type: 'INVALID_PRICE',
        minPrice: getMinMarketPrice(data.currencyType),
      });
    }

    // 2. 활성 상품 개수 제한 확인
    const countResult = await this.marketRepo.countActiveListingsBySeller(
      data.guildId,
      data.sellerId
    );

    if (!countResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: countResult.error });
    }

    if (countResult.data >= MAX_ACTIVE_LISTINGS_PER_USER) {
      return Result.err({
        type: 'MAX_LISTINGS_REACHED',
        maxListings: MAX_ACTIVE_LISTINGS_PER_USER,
      });
    }

    // 3. 상품 생성
    const listing = createMarketListing(data, now);
    const saveResult = await this.marketRepo.save(listing);

    if (!saveResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: saveResult.error });
    }

    return Result.ok({ listing: saveResult.data });
  }

  /**
   * 장터 상품 구매
   */
  async purchaseListing(
    guildId: string,
    buyerId: string,
    listingId: bigint
  ): Promise<Result<PurchaseListingResult, CurrencyError>> {
    const now = this.clock.now();

    // 1. 상품 조회
    const listingResult = await this.marketRepo.findById(listingId);

    if (!listingResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: listingResult.error });
    }

    const listing = listingResult.data;

    if (!listing) {
      return Result.err({ type: 'LISTING_NOT_FOUND' });
    }

    // 2. 상품 유효성 검사
    if (listing.guildId !== guildId) {
      return Result.err({ type: 'LISTING_NOT_FOUND' });
    }

    if (listing.status !== 'active') {
      return Result.err({ type: 'LISTING_NOT_ACTIVE' });
    }

    if (listing.expiresAt < now) {
      // 만료 처리
      await this.marketRepo.updateStatus(listingId, 'expired');
      return Result.err({ type: 'LISTING_EXPIRED' });
    }

    // 3. 자기 자신의 상품 구매 불가
    if (listing.sellerId === buyerId) {
      return Result.err({ type: 'CANNOT_BUY_OWN_LISTING' });
    }

    // 4. 수수료 계산
    const fee = calculateMarketFee(listing.price, listing.currencyType);
    const sellerReceived = calculateSellerReceiveAmount(listing.price, listing.currencyType);

    // 5. 구매자 잔액 확인 및 차감
    let buyerNewBalance: bigint;

    if (listing.currencyType === 'topy') {
      const walletResult = await this.topyWalletRepo.findByUser(guildId, buyerId);

      if (!walletResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: walletResult.error });
      }

      const wallet = walletResult.data ?? createTopyWallet(guildId, buyerId, now);

      if (wallet.balance < listing.price) {
        return Result.err({
          type: 'INSUFFICIENT_BALANCE',
          required: listing.price,
          available: wallet.balance,
        });
      }

      const subtractResult = await this.topyWalletRepo.updateBalance(
        guildId,
        buyerId,
        listing.price,
        'subtract'
      );

      if (!subtractResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: subtractResult.error });
      }

      buyerNewBalance = subtractResult.data.balance;

      // 6. 판매자 잔액 증가 (수수료 제외)
      const addResult = await this.topyWalletRepo.updateBalance(
        guildId,
        listing.sellerId,
        sellerReceived,
        'add'
      );

      if (!addResult.success) {
        // 롤백: 구매자 잔액 복구
        await this.topyWalletRepo.updateBalance(guildId, buyerId, listing.price, 'add');
        return Result.err({ type: 'REPOSITORY_ERROR', cause: addResult.error });
      }
    } else {
      // 루비
      const walletResult = await this.rubyWalletRepo.findByUser(guildId, buyerId);

      if (!walletResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: walletResult.error });
      }

      if (!walletResult.data || walletResult.data.balance < listing.price) {
        return Result.err({
          type: 'INSUFFICIENT_BALANCE',
          required: listing.price,
          available: walletResult.data?.balance ?? BigInt(0),
        });
      }

      const subtractResult = await this.rubyWalletRepo.updateBalance(
        guildId,
        buyerId,
        listing.price,
        'subtract'
      );

      if (!subtractResult.success) {
        return Result.err({ type: 'REPOSITORY_ERROR', cause: subtractResult.error });
      }

      buyerNewBalance = subtractResult.data.balance;

      // 판매자 잔액 증가
      const addResult = await this.rubyWalletRepo.updateBalance(
        guildId,
        listing.sellerId,
        sellerReceived,
        'add'
      );

      if (!addResult.success) {
        // 롤백
        await this.rubyWalletRepo.updateBalance(guildId, buyerId, listing.price, 'add');
        return Result.err({ type: 'REPOSITORY_ERROR', cause: addResult.error });
      }
    }

    // 7. 상품 상태 변경
    const updateResult = await this.marketRepo.updateStatus(listingId, 'sold', buyerId, now);

    if (!updateResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: updateResult.error });
    }

    // 8. 거래 기록 저장
    // 구매자: market_buy
    await this.transactionRepo.save(
      createTransaction(
        guildId,
        buyerId,
        listing.currencyType,
        'market_buy',
        listing.price,
        buyerNewBalance,
        {
          relatedUserId: listing.sellerId,
          description: `장터 구매: ${listing.title}`,
        }
      )
    );

    // 판매자: market_sell
    const sellerWallet = listing.currencyType === 'topy'
      ? await this.topyWalletRepo.findByUser(guildId, listing.sellerId)
      : await this.rubyWalletRepo.findByUser(guildId, listing.sellerId);

    const sellerBalance = sellerWallet.success && sellerWallet.data
      ? sellerWallet.data.balance
      : sellerReceived;

    await this.transactionRepo.save(
      createTransaction(
        guildId,
        listing.sellerId,
        listing.currencyType,
        'market_sell',
        sellerReceived,
        sellerBalance,
        {
          fee,
          relatedUserId: buyerId,
          description: `장터 판매: ${listing.title}`,
        }
      )
    );

    return Result.ok({
      listing: { ...listing, status: 'sold', buyerId, soldAt: now },
      price: listing.price,
      fee,
      sellerReceived,
      buyerNewBalance,
    });
  }

  /**
   * 장터 상품 취소
   */
  async cancelListing(
    guildId: string,
    sellerId: string,
    listingId: bigint
  ): Promise<Result<void, CurrencyError>> {
    // 1. 상품 조회
    const listingResult = await this.marketRepo.findById(listingId);

    if (!listingResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: listingResult.error });
    }

    const listing = listingResult.data;

    if (!listing) {
      return Result.err({ type: 'LISTING_NOT_FOUND' });
    }

    // 2. 권한 확인
    if (listing.guildId !== guildId || listing.sellerId !== sellerId) {
      return Result.err({ type: 'NOT_LISTING_OWNER' });
    }

    // 3. 상태 확인
    if (listing.status !== 'active') {
      return Result.err({ type: 'LISTING_NOT_ACTIVE' });
    }

    // 4. 상태 변경
    const updateResult = await this.marketRepo.updateStatus(listingId, 'cancelled');

    if (!updateResult.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: updateResult.error });
    }

    return Result.ok(undefined);
  }

  /**
   * 판매자의 상품 목록 조회
   */
  async getMyListings(
    guildId: string,
    sellerId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<MarketListing[], CurrencyError>> {
    const result = await this.marketRepo.findBySellerld(guildId, sellerId, options);

    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }

    return Result.ok(result.data);
  }

  /**
   * 구매자의 구매 내역 조회
   */
  async getMyPurchases(
    guildId: string,
    buyerId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Result<MarketListing[], CurrencyError>> {
    const result = await this.marketRepo.findByBuyerId(guildId, buyerId, options);

    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }

    return Result.ok(result.data);
  }

  /**
   * 만료된 상품 처리 (스케줄러에서 호출)
   */
  async processExpiredListings(): Promise<Result<number, CurrencyError>> {
    const now = this.clock.now();
    const result = await this.marketRepo.expireListings(now);

    if (!result.success) {
      return Result.err({ type: 'REPOSITORY_ERROR', cause: result.error });
    }

    return Result.ok(result.data);
  }
}
