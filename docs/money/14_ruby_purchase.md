# 루비 구매

> 참조: `00_money_sys.md` 3️⃣ 루비 시스템

## 개요

현금으로 루비를 구매하는 시스템 (관리자 수동 처리)

## 현재 상태

- [ ] DB 테이블: `ruby_purchases`
- [ ] Service: 루비 지급 메서드
- [ ] Web: 구매 요청/처리 페이지

## 수치/규칙

### 루비 패키지

| 패키지 | 가격 | 지급 루비 | 보너스 |
|--------|------|----------|--------|
| 소액 | 5,000원 | **5루비** | - |
| 중액 | 10,000원 | **10루비** | - |
| 고액 | 50,000원 | **55루비** | +5루비 |
| VIP | 100,000원 | **115루비** | +15루비 |

- **1루비 = 1,000원**
- **1루비 = 500토피 상당 가치**

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/41_ruby_packages.sql
CREATE TABLE ruby_packages (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    price_krw INT NOT NULL,
    ruby_amount INT NOT NULL,
    bonus_amount INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_guild (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/42_ruby_purchases.sql
CREATE TABLE ruby_purchases (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    package_id INT NULL,
    package_name VARCHAR(50) NOT NULL,
    price_krw INT NOT NULL,
    ruby_amount INT NOT NULL,
    bonus_amount INT NOT NULL DEFAULT 0,
    total_ruby INT NOT NULL,
    status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50) NULL,
    payment_note TEXT NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME NULL,
    confirmed_by VARCHAR(20) NULL,
    PRIMARY KEY (id),
    INDEX idx_guild_user (guild_id, user_id),
    INDEX idx_status (guild_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Core 서비스

```typescript
// 구매 요청 생성
async requestRubyPurchase(
  guildId: string,
  userId: string,
  packageId: number,
  paymentMethod?: string
): Promise<Result<RubyPurchase, Error>>

// 구매 확인 (관리자)
async confirmRubyPurchase(
  guildId: string,
  purchaseId: bigint,
  adminId: string
): Promise<Result<RubyPurchase, Error>>

// 수동 루비 지급 (관리자)
async giveRuby(
  guildId: string,
  userId: string,
  amount: number,
  adminId: string,
  reason: string
): Promise<Result<void, Error>>
```

### 3. 구매 흐름

1. 유저가 패키지 선택 후 구매 요청
2. 결제 정보 안내 (계좌번호 등)
3. 유저가 입금
4. 관리자가 입금 확인 후 승인
5. 루비 자동 지급
6. 거래 기록 저장

### 4. Web 관리

- 패키지 설정 (가격, 루비량, 보너스)
- 구매 요청 목록
- 승인/거절 처리
- 수동 지급 기능

### 5. 국고 연동

- 루비 판매 수익 → 서버 국고 적립
- 시즌 환급 재원으로 사용
