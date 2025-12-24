# 세금/수수료 시스템

> 참조: `00_money_sys.md` 8️⃣ 수수료 체계

## 개요

인플레이션 제어를 위한 세금 및 수수료 시스템

## 현재 상태

- [ ] 월말 세금 자동 차감
- [ ] 세금 면제권 처리
- [x] 이체 수수료 (03_transfer.md)
- [x] 상점 수수료 (05_shop.md)
- [x] 장터 수수료 (06_market.md)

## 수치/규칙

| 항목 | 수수료 | 비고 |
|------|--------|------|
| 월말 세금 | **3.3%** | 토피만, 매월 말일 자정 |
| 유저 이체 | **1.2%** | 토피만, 루비 면제 |
| 상점 거래 | **1.2%** | 디토뱅크 골드 면제 |
| 장터 | **5% / 3%** | 토피 5%, 루비 3% |
| 게임센터 | **20%** | 배팅 수익에서 차감 |

### 면제 조건

| 항목 | 면제 조건 |
|------|-----------|
| 월말 세금 | 세금 면제권 보유 |
| 이체 수수료 | 디토뱅크 실버/골드 |
| 상점 수수료 | 디토뱅크 골드 |
| 장터 수수료 | 디토뱅크 골드 (3%로 감소) |

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/27_tax_history.sql
CREATE TABLE tax_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    tax_type ENUM('monthly', 'transfer', 'purchase', 'market', 'game') NOT NULL,
    amount BIGINT NOT NULL,
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    exempted TINYINT(1) NOT NULL DEFAULT 0,
    exemption_reason VARCHAR(50) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_guild_user (guild_id, user_id),
    INDEX idx_type (guild_id, tax_type),
    INDEX idx_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. 월말 세금 로직

```typescript
// packages/core/src/currency-system/service/tax.service.ts

interface TaxResult {
  userId: string;
  balanceBefore: bigint;
  taxAmount: bigint;
  balanceAfter: bigint;
  exempted: boolean;
  exemptionReason?: string;
}

// 월말 세금 계산 및 차감
async processMonthlyTax(guildId: string): Promise<Result<TaxResult[], CurrencyError>>

// 세금 미리보기 (차감 전 확인용)
async previewMonthlyTax(guildId: string): Promise<Result<TaxResult[], CurrencyError>>
```

### 3. 월말 세금 처리 흐름

1. 매월 마지막 날 자정 (스케줄러)
2. 모든 유저의 토피 잔액 조회
3. 세금 면제권 보유 여부 확인
4. 3.3% 계산 및 차감
5. 거래 기록 저장 (type: 'tax')
6. 세금 히스토리 저장

### 4. 수수료 통합 함수

```typescript
// packages/core/src/currency-system/functions/calculate-fee.ts

export interface FeeCalculationContext {
  guildId: string;
  userId: string;
  amount: bigint;
  currencyType: 'topy' | 'ruby';
  feeType: 'transfer' | 'purchase' | 'market' | 'game';
  bankTier?: 'silver' | 'gold' | null;
}

export function calculateFee(context: FeeCalculationContext): bigint {
  const { amount, currencyType, feeType, bankTier } = context;

  // 루비는 이체 수수료 면제
  if (currencyType === 'ruby' && feeType === 'transfer') {
    return BigInt(0);
  }

  // 디토뱅크 혜택 적용
  if (bankTier === 'gold') {
    if (feeType === 'transfer' || feeType === 'purchase') return BigInt(0);
    if (feeType === 'market' && currencyType === 'ruby') return (amount * BigInt(3)) / BigInt(100);
  }
  if (bankTier === 'silver' && feeType === 'transfer') {
    return BigInt(0);
  }

  // 기본 수수료율
  const rates: Record<string, number> = {
    transfer: 12,      // 1.2%
    purchase: 12,      // 1.2%
    market_topy: 50,   // 5%
    market_ruby: 30,   // 3%
    game: 200,         // 20%
  };

  const rateKey = feeType === 'market' ? `market_${currencyType}` : feeType;
  const rate = rates[rateKey] ?? 0;

  return (amount * BigInt(rate)) / BigInt(1000);
}
```

### 5. 스케줄러 (Bot)

```typescript
// apps/bot/src/schedulers/monthly-tax.ts

import cron from 'node-cron';

// 매월 마지막 날 자정 실행
cron.schedule('0 0 L * *', async () => {
  // 모든 서버에 대해 월말 세금 처리
});
```

### 6. Web API

| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/guilds/[guildId]/tax/history` | GET | 세금 내역 조회 |
| `/api/guilds/[guildId]/tax/preview` | GET | 월말 세금 미리보기 |
