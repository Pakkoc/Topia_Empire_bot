# 유저 이체

> 참조: `00_money_sys.md` 8️⃣ 수수료 체계

## 개요

유저 간 토피/루비 송금 기능

## 현재 상태

- [x] DB 테이블: `topy_wallets`, `ruby_wallets`, `currency_transactions`
- [x] Service: transfer 메서드
- [ ] Bot: 이체 버튼/모달 (UI 마지막에)

## 수치/규칙

| 항목 | 값 |
|------|-----|
| 토피 이체 수수료 | **1.2%** |
| 루비 이체 수수료 | **면제** |
| 최소 이체 금액 | 100토피 / 1루비 |

## 구현 계획

### 1. Core 함수

```typescript
// packages/core/src/currency-system/functions/calculate-fee.ts

export function calculateTransferFee(
  amount: bigint,
  currencyType: 'topy' | 'ruby'
): bigint {
  if (currencyType === 'ruby') return BigInt(0);
  // 토피: 1.2% 수수료
  return (amount * BigInt(12)) / BigInt(1000);
}
```

### 2. Core 서비스

```typescript
// packages/core/src/currency-system/service/currency.service.ts

interface TransferResult {
  success: boolean;
  amount: bigint;
  fee: bigint;
  fromBalance: bigint;
  toBalance: bigint;
}

async transfer(
  guildId: string,
  fromUserId: string,
  toUserId: string,
  amount: bigint,
  currencyType: 'topy' | 'ruby'
): Promise<Result<TransferResult, CurrencyError>>
```

### 3. 이체 로직

1. 송금자 잔액 확인 (amount + fee)
2. 수수료 계산
3. 송금자 잔액 차감 (amount + fee)
4. 수신자 잔액 증가 (amount)
5. 거래 기록 저장 (송금, 수신, 수수료 각각)

### 4. 에러 케이스

| 에러 | 설명 |
|------|------|
| `INSUFFICIENT_BALANCE` | 잔액 부족 (수수료 포함) |
| `SELF_TRANSFER` | 자기 자신에게 이체 |
| `INVALID_AMOUNT` | 최소 금액 미만 |
| `USER_NOT_FOUND` | 수신자 없음 |
