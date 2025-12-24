# 디토뱅크

> 참조: `00_money_sys.md` 7️⃣ 디토뱅크

## 개요

프리미엄 뱅킹 서비스 - 보관 한도 증가, 수수료 면제 혜택

## 현재 상태

- [ ] DB 테이블: `bank_subscriptions`
- [ ] Domain: `BankSubscription`
- [ ] Repository: `BankRepository`
- [ ] Service: 뱅크 메서드
- [ ] 상점 연동: 실버/골드 구독권

## 수치/규칙

| 구분 | 실버 | 골드 |
|------|------|------|
| 가격 | 10루비/월 | 15루비/월 |
| 보관 한도 | 100,000토피 | 200,000토피 |
| 이체 수수료 | **면제** | **면제** |
| 구매 수수료 | 1.2% | **면제** |
| 장터 수수료 | 5% | 3% |

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/26_bank_subscriptions.sql
CREATE TABLE bank_subscriptions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    tier ENUM('silver', 'gold') NOT NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    auto_renew TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user (guild_id, user_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Core Domain

```typescript
// packages/core/src/currency-system/domain/bank-subscription.ts
export interface BankSubscription {
  id: bigint;
  guildId: string;
  userId: string;
  tier: 'silver' | 'gold';
  startedAt: Date;
  expiresAt: Date;
  autoRenew: boolean;
}

export interface BankBenefits {
  storageLimit: bigint;
  transferFeeExempt: boolean;
  purchaseFeeExempt: boolean;
  marketFeeRate: number;
}

export function getBankBenefits(tier: 'silver' | 'gold' | null): BankBenefits {
  if (tier === 'gold') {
    return {
      storageLimit: BigInt(200000),
      transferFeeExempt: true,
      purchaseFeeExempt: true,
      marketFeeRate: 0.03,
    };
  }
  if (tier === 'silver') {
    return {
      storageLimit: BigInt(100000),
      transferFeeExempt: true,
      purchaseFeeExempt: false,
      marketFeeRate: 0.05,
    };
  }
  // 일반 유저
  return {
    storageLimit: BigInt(50000), // 기본 한도
    transferFeeExempt: false,
    purchaseFeeExempt: false,
    marketFeeRate: 0.05,
  };
}
```

### 3. Core 서비스

```typescript
// 구독 상태 조회
async getBankSubscription(
  guildId: string,
  userId: string
): Promise<Result<BankSubscription | null, CurrencyError>>

// 구독 활성화 (상점 구매 후 호출)
async activateBankSubscription(
  guildId: string,
  userId: string,
  tier: 'silver' | 'gold',
  durationDays: number
): Promise<Result<BankSubscription, CurrencyError>>

// 혜택 조회
async getUserBankBenefits(
  guildId: string,
  userId: string
): Promise<Result<BankBenefits, CurrencyError>>
```

### 4. 수수료 계산 연동

기존 이체/구매/장터 함수에서 뱅크 구독 상태 확인 후 수수료 조정

```typescript
// 예시: 이체 수수료 계산
async calculateTransferFee(guildId: string, userId: string, amount: bigint): Promise<bigint> {
  const subscription = await this.getBankSubscription(guildId, userId);
  if (subscription.success && subscription.data) {
    const benefits = getBankBenefits(subscription.data.tier);
    if (benefits.transferFeeExempt) return BigInt(0);
  }
  return (amount * BigInt(12)) / BigInt(1000); // 1.2%
}
```

### 5. 만료 처리

- 매일 자정 만료된 구독 체크
- 자동 갱신 설정 시 루비 자동 차감
- 잔액 부족 시 구독 해제
