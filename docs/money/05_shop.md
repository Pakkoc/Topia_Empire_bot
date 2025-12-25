# 상점 시스템

> 참조: `00_money_sys.md` 4️⃣ 상점 시스템

## 개요

토피/루비로 아이템을 구매하는 상점 시스템

## 현재 상태

- [x] DB 테이블: `shop_items`, `user_items`, `purchase_history`, `shop_color_options`
- [x] Domain: `ShopItem`, `UserItem`, `ColorOption`
- [x] Repository: `ShopRepository`
- [x] Service: 상점 메서드
- [x] Bot: `/상점` 명령어
- [x] Web: 상점 관리 페이지
- [x] Bot: 색상변경권 인벤토리 저장 방식 (`color_#XXXXXX` 형식)
- [x] Bot: `/내정보` 색상 적용 기능

## 수치/규칙

### 토피 상점

| 상품                  | 가격       |
| --------------------- | ---------- |
| 색상 변경권 (1개월)   | 10,000토피 |
| 프리미엄 잠수방 1개월 | 5,000토피  |
| 랜덤박스 1개          | 100토피    |
| 콘텐츠 이벤트 참여권  | 1,000토피  |

### 루비 상점

| 상품                    | 가격   |
| ----------------------- | ------ |
| 색상 변경권 1개월       | 10루비 |
| 색상 변경권 3개월       | 25루비 |
| 디토뱅크 실버 1개월     | 10루비 |
| 디토뱅크 골드 1개월     | 15루비 |
| VIP 라운지 입장권 1개월 | 20루비 |
| 세금 면제권 1개월       | 10루비 |

### 구매 수수료

| 조건          | 수수료   |
| ------------- | -------- |
| 일반 유저     | **1.2%** |
| 디토뱅크 실버 | **1.2%** |
| 디토뱅크 골드 | **면제** |

---

## 색상변경권 시스템

### 개요

색상변경권은 다른 아이템과 다르게 **색상별로 개별 구매**하는 방식입니다.

### 구매 흐름

```
/상점 → 색상변경권 선택 → 색상 선택 창
├─ 빨강: 1,000 토피
├─ 파랑: 1,500 토피
├─ 골드: 5,000 토피  (색상별 가격 다름)
└─ 구매 → 인벤토리에 저장 (역할 즉시 부여 X)
```

### 색상 적용 흐름 (추후 개발)

```
/내정보 → 드롭다운 → 닉네임 색상 변경
├─ 보유한 색상 목록 표시
├─ 원하는 색상 선택
└─ 해당 색상 역할 부여
```

### 데이터베이스

```sql
-- sql/24_shop_color_options.sql
CREATE TABLE shop_color_options (
    id INT PRIMARY KEY AUTO_INCREMENT,
    item_id INT NOT NULL,                    -- shop_items.id 참조
    color VARCHAR(7) NOT NULL,               -- HEX 색상 (#FF0000)
    name VARCHAR(50) NOT NULL,               -- 색상 이름 (빨강)
    role_id VARCHAR(20) NOT NULL,            -- Discord 역할 ID
    price BIGINT NOT NULL DEFAULT 0,         -- 색상별 가격 (0이면 아이템 기본 가격 사용)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE,
    UNIQUE KEY unique_item_color (item_id, color),
    INDEX idx_item_id (item_id)
);
```

### 인벤토리 저장 방식

색상 구매 시 `user_items` 테이블에 저장:

```
item_type: "color_#FF0000"  (색상 코드 포함)
quantity: 1
```

### 웹 관리 (관리자)

1. 상점 > 아이템 추가 > 타입: 색상권
2. 아이템 목록에서 "색상 관리" 버튼 클릭
3. 색상-역할 매핑 추가:
   - 색상 이름: 빨강
   - 색상 코드: #FF0000
   - 역할: @빨강
   - 가격: 1000 (색상별 개별 가격)

---

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
  currencyType: "topy" | "ruby";
  itemType:
    | "role"
    | "color"
    | "premium_room"
    | "random_box"
    | "warning_remove"
    | "tax_exempt"
    | "custom";
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

// packages/core/src/currency-system/domain/color-option.ts
export interface ColorOption {
  id: number;
  itemId: number;
  color: string;      // #FF0000
  name: string;       // 빨강
  roleId: string;     // Discord 역할 ID
  price: bigint;      // 색상별 가격
  createdAt: Date;
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

// 색상변경권 구매 (색상 선택)
async purchaseColorItem(
  guildId: string,
  userId: string,
  itemId: number,
  colorOptionId: number
): Promise<Result<PurchaseResult, CurrencyError>>

// 유저 보유 아이템
async getUserItems(guildId: string, userId: string): Promise<Result<UserItem[], CurrencyError>>

// 색상 적용 (역할 부여)
async applyColor(
  guildId: string,
  userId: string,
  colorCode: string
): Promise<Result<void, CurrencyError>>
```

### 4. Web API

| 라우트                                           | 메서드 | 설명             |
| ------------------------------------------------ | ------ | ---------------- |
| `/api/guilds/[guildId]/shop/items`               | GET    | 상점 아이템 목록 |
| `/api/guilds/[guildId]/shop/items`               | POST   | 아이템 추가      |
| `/api/guilds/[guildId]/shop/items/[id]`          | PUT    | 아이템 수정      |
| `/api/guilds/[guildId]/shop/items/[id]`          | DELETE | 아이템 삭제      |
| `/api/guilds/[guildId]/shop/items/[id]/colors`   | GET    | 색상 옵션 목록   |
| `/api/guilds/[guildId]/shop/items/[id]/colors`   | POST   | 색상 옵션 추가   |
| `/api/guilds/[guildId]/shop/items/[id]/colors/[colorId]` | DELETE | 색상 옵션 삭제 |

### 5. Web 페이지

- 경로: `/dashboard/[guildId]/currency/shop`
- 아이템 목록 관리 (CRUD)
- 색상변경권 아이템 > 색상 관리 버튼 > 색상-역할-가격 매핑
