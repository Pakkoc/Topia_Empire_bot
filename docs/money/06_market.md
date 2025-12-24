# 장터 시스템

> 참조: `00_money_sys.md` 5️⃣ 장터 시스템

## 개요

유저 간 재능/서비스 거래가 가능한 장터 시스템

## 현재 상태

- [ ] DB 테이블: `market_listings`
- [ ] Domain: `MarketListing`
- [ ] Repository: `MarketRepository`
- [ ] Service: 장터 메서드
- [ ] Bot: `/장터` 명령어 (UI 마지막에)
- [ ] Web: 장터 관리 페이지

## 수치/규칙

| 항목 | 값 |
|------|-----|
| 토피 장터 수수료 | **5%** |
| 루비 장터 수수료 | **3%** |
| 최소 등록 가격 | 100토피 / 1루비 |
| 등록 유효기간 | 30일 |

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/24_market_listings.sql
CREATE TABLE market_listings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    seller_id VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category ENUM('design', 'music', 'video', 'coding', 'other') NOT NULL DEFAULT 'other',
    price BIGINT NOT NULL,
    currency_type ENUM('topy', 'ruby') NOT NULL,
    status ENUM('active', 'sold', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
    buyer_id VARCHAR(20) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    sold_at DATETIME NULL,
    PRIMARY KEY (id),
    INDEX idx_guild_status (guild_id, status),
    INDEX idx_seller (guild_id, seller_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/25_market_reviews.sql
CREATE TABLE market_reviews (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    listing_id BIGINT NOT NULL,
    reviewer_id VARCHAR(20) NOT NULL,
    target_id VARCHAR(20) NOT NULL,
    rating TINYINT NOT NULL,
    comment TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_listing_reviewer (listing_id, reviewer_id),
    INDEX idx_target (guild_id, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Core Domain

```typescript
// packages/core/src/currency-system/domain/market-listing.ts
export interface MarketListing {
  id: bigint;
  guildId: string;
  sellerId: string;
  title: string;
  description: string | null;
  category: 'design' | 'music' | 'video' | 'coding' | 'other';
  price: bigint;
  currencyType: 'topy' | 'ruby';
  status: 'active' | 'sold' | 'cancelled' | 'expired';
  buyerId: string | null;
  createdAt: Date;
  expiresAt: Date;
  soldAt: Date | null;
}
```

### 3. Core 함수

```typescript
// packages/core/src/currency-system/functions/calculate-fee.ts

export function calculateMarketFee(
  amount: bigint,
  currencyType: 'topy' | 'ruby'
): bigint {
  if (currencyType === 'ruby') {
    // 루비: 3%
    return (amount * BigInt(3)) / BigInt(100);
  }
  // 토피: 5%
  return (amount * BigInt(5)) / BigInt(100);
}
```

### 4. Core 서비스

```typescript
// 장터 목록 조회
async getListings(
  guildId: string,
  category?: string,
  currencyType?: string,
  limit?: number,
  offset?: number
): Promise<Result<MarketListing[], CurrencyError>>

// 상품 등록
async createListing(
  guildId: string,
  sellerId: string,
  data: CreateListingData
): Promise<Result<MarketListing, CurrencyError>>

// 상품 구매
async purchaseListing(
  guildId: string,
  buyerId: string,
  listingId: bigint
): Promise<Result<PurchaseResult, CurrencyError>>

// 상품 취소
async cancelListing(
  guildId: string,
  sellerId: string,
  listingId: bigint
): Promise<Result<void, CurrencyError>>
```

### 5. 거래 로직

1. 구매자 잔액 확인 (price)
2. 수수료 계산 (판매자 부담)
3. 구매자 잔액 차감 (price)
4. 판매자 잔액 증가 (price - fee)
5. 수수료 → 서버 국고 (추후)
6. 거래 기록 저장
7. 상품 상태 변경 (sold)

### 6. Web API

| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/guilds/[guildId]/market/listings` | GET | 장터 목록 |
| `/api/guilds/[guildId]/market/listings` | POST | 상품 등록 |
| `/api/guilds/[guildId]/market/listings/[id]` | DELETE | 상품 취소 |

### 7. 분쟁 처리

- 구매 완료 후 24시간 내 분쟁 신청 가능
- 관리자 중재로 환불/완료 처리
- (추후 구현)
