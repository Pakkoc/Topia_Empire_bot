# 화폐 시스템 구현 계획 (Phase 2)

## 현재 구현 완료

### Phase 1: 기반 구축 ✅
- [x] SQL 스키마 (10~18번 파일)
- [x] Core 패키지: domain/, errors/, port/, functions/, service/
- [x] Infra: Repository 구현 (4개)
- [x] Infra: Container에 등록
- [x] Bot: currency.handler.ts
- [x] Bot: messageCreate, voiceStateUpdate 이벤트 연동

### Phase 2: 웹 대시보드 설정 ✅
- [x] 화폐 설정 페이지 (`/currency/settings`)
- [x] 화폐 규칙 페이지 (`/currency/rules`)
  - [x] 핫타임 설정
  - [x] 채널/역할별 배율
  - [x] 토피 차단 (채널/역할)

---

## 앞으로 구현할 기능

### Phase 3: 지갑 조회 (우선순위: 높음)

#### 3-1. 봇 명령어
| 명령어 | 설명 | 파일 |
|--------|------|------|
| `/지갑` | 본인 토피/루비 잔액 조회 | `apps/bot/src/commands/wallet.ts` |
| `/잔액 @유저` | 다른 유저 잔액 조회 | 위와 동일 |
| `/랭킹` | 토피 보유량 상위 10명 | `apps/bot/src/commands/leaderboard.ts` |

#### 3-2. 웹 API
| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/guilds/[guildId]/currency/wallets` | GET | 지갑 목록 (페이지네이션) |
| `/api/guilds/[guildId]/currency/wallets/[userId]` | GET | 특정 유저 지갑 |
| `/api/guilds/[guildId]/currency/leaderboard` | GET | 리더보드 |

#### 3-3. 웹 페이지
- `apps/web/src/app/dashboard/[guildId]/currency/wallets/page.tsx`

---

### Phase 4: 거래 기록 조회 (우선순위: 높음)

#### 4-1. 봇 명령어
| 명령어 | 설명 |
|--------|------|
| `/내역` | 최근 거래 내역 10건 |
| `/내역 @유저` | 특정 유저 거래 내역 (관리자) |

#### 4-2. 웹 API
| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/guilds/[guildId]/currency/transactions` | GET | 거래 기록 목록 |

#### 4-3. 웹 페이지
- `apps/web/src/app/dashboard/[guildId]/currency/transactions/page.tsx`

---

### Phase 5: 유저 이체 (우선순위: 높음)

#### 5-1. Core 서비스
```typescript
// packages/core/src/currency-system/service/currency.service.ts
async transfer(
  guildId: string,
  fromUserId: string,
  toUserId: string,
  amount: bigint
): Promise<Result<TransferResult, CurrencyError>>
```

#### 5-2. 봇 명령어
| 명령어 | 설명 | 수수료 |
|--------|------|--------|
| `/이체 @유저 100` | 토피 이체 | 1.2% |

#### 5-3. 구현 파일
| 파일 | 작업 |
|------|------|
| `packages/core/src/currency-system/functions/calculate-fee.ts` | 수수료 계산 함수 |
| `packages/core/src/currency-system/service/currency.service.ts` | transfer 메서드 추가 |
| `apps/bot/src/commands/transfer.ts` | 이체 명령어 |

---

### Phase 6: 상점 시스템 (우선순위: 중간)

#### 6-1. 데이터베이스
```sql
-- sql/20_shop_items.sql
CREATE TABLE shop_items (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    currency_type ENUM('topy', 'ruby') NOT NULL,
    item_type ENUM('role', 'color', 'premium_room', 'random_box', 'custom') NOT NULL,
    duration_days INT NULL,  -- NULL이면 영구
    role_id VARCHAR(20) NULL,
    stock INT NULL,  -- NULL이면 무제한
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- sql/21_shop_purchases.sql
CREATE TABLE shop_purchases (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    item_id INT NOT NULL,
    price BIGINT NOT NULL,
    fee BIGINT NOT NULL DEFAULT 0,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
```

#### 6-2. 봇 명령어
| 명령어 | 설명 |
|--------|------|
| `/상점` | 상점 아이템 목록 |
| `/구매 [아이템]` | 아이템 구매 |

#### 6-3. 웹 페이지
- `apps/web/src/app/dashboard/[guildId]/currency/shop/page.tsx`

---

### Phase 7: 기타 활동 보상 (우선순위: 중간)

#### 7-1. 봇 명령어
| 명령어 | 보상 | 쿨다운 |
|--------|------|--------|
| `/출석` | 10토피 | 24시간 |
| `/구독보상` | 등급별 150~350토피 | 24시간 |

#### 7-2. 데이터베이스
```sql
-- sql/22_daily_rewards.sql
CREATE TABLE daily_rewards (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    reward_type ENUM('attendance', 'subscription') NOT NULL,
    last_claimed_at DATETIME NOT NULL,
    PRIMARY KEY (guild_id, user_id, reward_type)
);
```

---

### Phase 8: 장터 시스템 (우선순위: 낮음)

#### 8-1. 데이터베이스
```sql
-- sql/25_market_listings.sql
CREATE TABLE market_listings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    seller_id VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    currency_type ENUM('topy', 'ruby') NOT NULL,
    status ENUM('active', 'sold', 'cancelled') NOT NULL DEFAULT 'active',
    buyer_id VARCHAR(20) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sold_at DATETIME NULL,
    PRIMARY KEY (id)
);
```

#### 8-2. 수수료
- 토피 장터: 5%
- 루비 장터: 3%

---

### Phase 9: 고급 기능 (우선순위: 낮음)

| 기능 | 설명 |
|------|------|
| 디토뱅크 | 실버/골드 등급, 보관 한도, 수수료 면제 |
| 시즌 환급 | 분기제, 루비 → 현금 환급 |
| 월말 세금 | 3.3% 자동 차감 |
| 게임센터 | 내전 배팅, 수수료 20% |

---

## 구현 순서 요약

```
Phase 3: 지갑 조회 API/명령어
    ↓
Phase 4: 거래 기록 조회
    ↓
Phase 5: 유저 이체
    ↓
Phase 6: 상점 시스템
    ↓
Phase 7: 기타 활동 보상 (출석, 구독)
    ↓
Phase 8: 장터 시스템
    ↓
Phase 9: 고급 기능
```

---

## 다음 작업 (Phase 3 상세)

### Step 1: CurrencyService에 메서드 추가
```typescript
// packages/core/src/currency-system/service/currency.service.ts
async getWallets(guildId: string, userId: string): Promise<Result<WalletsResult, CurrencyError>>
async getRubyWallet(guildId: string, userId: string): Promise<Result<RubyWallet | null, CurrencyError>>
```

### Step 2: 웹 API 구현
- `apps/web/src/app/api/guilds/[guildId]/currency/wallets/route.ts`
- `apps/web/src/app/api/guilds/[guildId]/currency/wallets/[userId]/route.ts`

### Step 3: 봇 명령어 구현
- `apps/bot/src/commands/wallet.ts`
- `apps/bot/src/commands/leaderboard.ts`

### Step 4: 웹 페이지 구현
- `apps/web/src/app/dashboard/[guildId]/currency/wallets/page.tsx`
