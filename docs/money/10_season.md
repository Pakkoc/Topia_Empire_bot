# 시즌 환급 시스템

> 참조: `00_money_sys.md` 6️⃣ 시즌 환급 시스템

## 개요

분기별 루비를 현금으로 환급하는 시스템

## 현재 상태

- [ ] DB 테이블: `seasons`, `cashout_requests`
- [ ] Domain: `Season`, `CashoutRequest`
- [ ] Service: 환급 메서드
- [ ] Web: 환급 관리 페이지

## 수치/규칙

| 항목 | 값 |
|------|-----|
| 시즌 주기 | **분기제 (3개월)** |
| 환급 조건 | 서버 국고 충족 시만 |
| 루비 가치 | **1루비 = 1,000원** |

### 환급 한도

| 대상 | 월 1회 한도 |
|------|-------------|
| 일반 유저 | 5,000 ~ 20,000원 |
| 관리자 | 최대 30,000원 |
| 전속 디자이너 | 최대 50,000원 |

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/31_seasons.sql
CREATE TABLE seasons (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('upcoming', 'active', 'cashout_open', 'closed') NOT NULL DEFAULT 'upcoming',
    treasury_goal BIGINT NOT NULL,
    treasury_current BIGINT NOT NULL DEFAULT 0,
    cashout_enabled TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_guild_status (guild_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/32_cashout_requests.sql
CREATE TABLE cashout_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    season_id INT NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    ruby_amount INT NOT NULL,
    krw_amount INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50) NULL,
    payment_info TEXT NULL,
    admin_note TEXT NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL,
    processed_by VARCHAR(20) NULL,
    PRIMARY KEY (id),
    INDEX idx_guild_season (guild_id, season_id),
    INDEX idx_user (guild_id, user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/33_user_roles.sql (환급 한도용)
CREATE TABLE user_roles (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    role_type ENUM('user', 'admin', 'designer') NOT NULL DEFAULT 'user',
    monthly_cashout_limit INT NOT NULL DEFAULT 20000,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Core Domain

```typescript
// packages/core/src/currency-system/domain/season.ts
export interface Season {
  id: number;
  guildId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'upcoming' | 'active' | 'cashout_open' | 'closed';
  treasuryGoal: bigint;
  treasuryCurrent: bigint;
  cashoutEnabled: boolean;
}

export interface CashoutRequest {
  id: bigint;
  guildId: string;
  seasonId: number;
  userId: string;
  rubyAmount: number;
  krwAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  paymentMethod: string | null;
  paymentInfo: string | null;
  adminNote: string | null;
  requestedAt: Date;
  processedAt: Date | null;
  processedBy: string | null;
}
```

### 3. Core 서비스

```typescript
// 현재 시즌 조회
async getCurrentSeason(guildId: string): Promise<Result<Season | null, CurrencyError>>

// 환급 신청
async requestCashout(
  guildId: string,
  userId: string,
  rubyAmount: number,
  paymentMethod: string,
  paymentInfo: string
): Promise<Result<CashoutRequest, CurrencyError>>

// 환급 승인 (관리자)
async approveCashout(
  guildId: string,
  requestId: bigint,
  adminId: string
): Promise<Result<CashoutRequest, CurrencyError>>

// 환급 완료 처리
async completeCashout(
  guildId: string,
  requestId: bigint,
  adminId: string
): Promise<Result<CashoutRequest, CurrencyError>>

// 월간 환급 한도 확인
async getCashoutLimit(
  guildId: string,
  userId: string
): Promise<Result<{ limit: number; used: number; remaining: number }, CurrencyError>>
```

### 4. 환급 흐름

1. 시즌 종료 시 국고 목표 달성 여부 확인
2. 달성 시 `cashout_enabled = true`
3. 유저가 환급 신청 (루비 보유량 내에서)
4. 관리자가 신청 검토 및 승인
5. 실제 송금 후 완료 처리
6. 루비 차감

### 5. Web API

| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/guilds/[guildId]/seasons` | GET | 시즌 목록 |
| `/api/guilds/[guildId]/seasons/current` | GET | 현재 시즌 |
| `/api/guilds/[guildId]/cashout/requests` | GET | 환급 신청 목록 |
| `/api/guilds/[guildId]/cashout/requests` | POST | 환급 신청 |
| `/api/guilds/[guildId]/cashout/requests/[id]/approve` | POST | 승인 |
| `/api/guilds/[guildId]/cashout/requests/[id]/complete` | POST | 완료 |

### 6. 공지 템플릿

```
[환급 시즌 안내]
이번 시즌 서버 국고 조건 충족으로 환급이 진행됩니다.

- 환급 신청 기간: YYYY.MM.DD ~ YYYY.MM.DD
- 환급 비율: 1루비 = 1,000원
- 월간 한도: 일반 20,000원 / 관리자 30,000원 / 전속 50,000원

※ 환급은 보유 루비 내에서만 가능합니다.
```
