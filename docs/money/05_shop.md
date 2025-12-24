# 상점 시스템

> 참조: `00_money_sys.md` 4️⃣ 상점 시스템

## 개요

토피/루비로 아이템을 구매하는 상점 시스템

## 현재 상태

- [ ] DB 테이블: `shop_items`, `user_items`
- [ ] Domain: `ShopItem`, `UserItem`
- [ ] Repository: `ShopRepository`
- [ ] Service: 상점 메서드
- [ ] Bot: `/상점` 명령어 (UI 마지막에)
- [ ] Web: 상점 관리 페이지

## 수치/규칙

### 토피 상점

| 상품 | 가격 |
|------|------|
| 색상 변경권 (1개월) | 10,000토피 |
| 프리미엄 잠수방 1개월 | 5,000토피 |
| 랜덤박스 1개 | 100토피 |
| 콘텐츠 이벤트 참여권 | 1,000토피 |

### 루비 상점

| 상품 | 가격 |
|------|------|
| 색상 변경권 1개월 | 10루비 |
| 색상 변경권 3개월 | 25루비 |
| 디토뱅크 실버 1개월 | 10루비 |
| 디토뱅크 골드 1개월 | 15루비 |
| VIP 라운지 입장권 1개월 | 20루비 |
| 세금 면제권 1개월 | 10루비 |

### 구매 수수료

| 조건 | 수수료 |
|------|--------|
| 일반 유저 | **1.2%** |
| 디토뱅크 실버 | **1.2%** |
| 디토뱅크 골드 | **면제** |

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/21_shop_items.sql
CREATE TABLE shop_items (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    currency_type ENUM('topy', 'ruby') NOT NULL,
    item_type ENUM('role', 'color', 'premium_room', 'random_box', 'warning_remove', 'tax_exempt', 'custom') NOT NULL,
    duration_days INT NULL,
    role_id VARCHAR(20) NULL,
    stock INT NULL,
    max_per_user INT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_guild (guild_id),
    INDEX idx_enabled (guild_id, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/22_user_items.sql
CREATE TABLE user_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_item (guild_id, user_id, item_type),
    INDEX idx_user (guild_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/23_purchase_history.sql
CREATE TABLE purchase_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    item_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    price BIGINT NOT NULL,
    fee BIGINT NOT NULL DEFAULT 0,
    currency_type ENUM('topy', 'ruby') NOT NULL,
    purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_user (guild_id, user_id),
    INDEX idx_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Core Domain

```typescript
// packages/core/src/currency-system/domain/shop-item.ts
export interface ShopItem {
  id: number;
  guildId: string;
  name: string;
  description: string | null;
  price: bigint;
  currencyType: 'topy' | 'ruby';
  itemType: 'role' | 'color' | 'premium_room' | 'random_box' | 'warning_remove' | 'tax_exempt' | 'custom';
  durationDays: number | null;
  roleId: string | null;
  stock: number | null;
  maxPerUser: number | null;
  enabled: boolean;
}

// packages/core/src/currency-system/domain/user-item.ts
export interface UserItem {
  guildId: string;
  userId: string;
  itemType: string;
  quantity: number;
  expiresAt: Date | null;
}
```

### 3. Core 서비스

```typescript
// 상점 아이템 목록
async getShopItems(guildId: string): Promise<Result<ShopItem[], CurrencyError>>

// 아이템 구매
async purchaseItem(
  guildId: string,
  userId: string,
  itemId: number
): Promise<Result<PurchaseResult, CurrencyError>>

// 유저 보유 아이템
async getUserItems(guildId: string, userId: string): Promise<Result<UserItem[], CurrencyError>>

// 아이템 사용
async useItem(
  guildId: string,
  userId: string,
  itemType: string
): Promise<Result<UseItemResult, CurrencyError>>
```

### 4. Web API

| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/guilds/[guildId]/shop/items` | GET | 상점 아이템 목록 |
| `/api/guilds/[guildId]/shop/items` | POST | 아이템 추가 (관리자) |
| `/api/guilds/[guildId]/shop/items/[id]` | PUT | 아이템 수정 |
| `/api/guilds/[guildId]/shop/items/[id]` | DELETE | 아이템 삭제 |

### 5. Web 페이지

- 경로: `/dashboard/[guildId]/currency/shop`
- 아이템 목록 관리 (CRUD)
- 재고, 가격, 활성화 상태 관리
