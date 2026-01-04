# 금고 시스템

## 개요

디토뱅크 구독자 전용 금고 기능입니다. 토피를 예금하고 월 이자를 받을 수 있습니다.

---

## 티어별 혜택

| 티어 | 금고 한도 | 월 이자율 |
|------|-----------|-----------|
| 없음 | 0 (사용 불가) | 0% |
| 실버 (dito_silver) | 100,000 | 1% |
| 골드 (dito_gold) | 200,000 | 2% |

---

## 명령어

### /금고 확인

현재 금고 상태를 조회합니다.

```
📦 금고 현황

💰 예금액: 50,000 토피
📊 한도: 100,000 토피
💵 월 이자율: 1%
🏦 등급: 디토 실버
```

### /금고 예금 [금액]

지갑에서 금고로 토피를 예금합니다.

- 잔액 확인
- 한도 확인
- 성공 시 거래 기록 생성 (`vault_deposit`)

### /금고 출금 [금액]

금고에서 지갑으로 토피를 출금합니다.

- 금고 잔액 확인
- 성공 시 거래 기록 생성 (`vault_withdraw`)

---

## 월간 이자 지급

### 스케줄러

매월 1일 00:00 (Asia/Seoul)에 자동 실행됩니다.

```typescript
// vault-interest.scheduler.ts
schedule.scheduleJob('0 0 1 * *', async () => {
  // 모든 길드에 대해 이자 지급 처리
});
```

### 이자 계산

```typescript
이자 = 예금액 × (이자율 / 100)

// 예시: 50,000 토피, 1% 이자율
이자 = 50,000 × 0.01 = 500 토피
```

### 이자 지급 조건

1. 금고에 예금액이 있어야 함
2. 활성 디토뱅크 구독이 있어야 함
3. 해당 월에 아직 이자를 받지 않았어야 함

### 이자 지급 방식

- 이자는 금고에 추가됨 (지갑이 아님)
- 거래 기록 생성 (`vault_interest`)
- `last_interest_at` 업데이트

---

## DB 스키마

### user_vaults 테이블

```sql
CREATE TABLE IF NOT EXISTS user_vaults (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    deposited_amount BIGINT NOT NULL DEFAULT 0,
    last_interest_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_guild_user (guild_id, user_id)
);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | BIGINT | PK |
| guild_id | VARCHAR(20) | 길드 ID |
| user_id | VARCHAR(20) | 유저 ID |
| deposited_amount | BIGINT | 예금 금액 |
| last_interest_at | DATETIME | 마지막 이자 지급 시각 |
| created_at | DATETIME | 생성 시각 |
| updated_at | DATETIME | 수정 시각 |

---

## 거래 유형

| 유형 | 설명 | 금액 부호 |
|------|------|-----------|
| `vault_deposit` | 금고 예금 | 음수 (지갑에서 차감) |
| `vault_withdraw` | 금고 출금 | 양수 (지갑에 추가) |
| `vault_interest` | 이자 지급 | 양수 |

---

## 서비스 API

### VaultService

```typescript
class VaultService {
  // 금고 정보 조회 (구독 혜택 포함)
  getVaultSummary(guildId: string, userId: string): Promise<Result<VaultSummary, CurrencyError>>

  // 예금
  deposit(guildId: string, userId: string, amount: bigint): Promise<Result<VaultDepositResult, CurrencyError>>

  // 출금
  withdraw(guildId: string, userId: string, amount: bigint): Promise<Result<VaultWithdrawResult, CurrencyError>>

  // 월간 이자 지급 처리
  processMonthlyInterest(guildId: string): Promise<Result<MonthlyInterestSummary, CurrencyError>>
}
```

### VaultSummary

```typescript
interface VaultSummary {
  vault: UserVault | null;
  storageLimit: bigint;
  interestRate: number;
  tierName: string;
}
```

---

## 에러 타입

| 타입 | 설명 |
|------|------|
| `NO_SUBSCRIPTION` | 디토뱅크 구독이 없음 |
| `VAULT_LIMIT_EXCEEDED` | 금고 한도 초과 |
| `INSUFFICIENT_VAULT_BALANCE` | 금고 잔액 부족 |
| `INSUFFICIENT_BALANCE` | 지갑 잔액 부족 |
| `INVALID_AMOUNT` | 잘못된 금액 (0 이하) |

---

## 관련 파일

| 파일 | 설명 |
|------|------|
| `packages/core/src/currency-system/domain/user-vault.ts` | 금고 도메인 |
| `packages/core/src/currency-system/domain/bank-subscription.ts` | 티어별 혜택 (BankBenefits) |
| `packages/core/src/currency-system/port/vault-repository.port.ts` | 리포지토리 인터페이스 |
| `packages/core/src/currency-system/service/vault.service.ts` | 금고 서비스 |
| `packages/infra/src/database/repositories/vault.repository.ts` | 리포지토리 구현 |
| `apps/bot/src/commands/vault.ts` | 금고 명령어 |
| `apps/bot/src/schedulers/vault-interest.scheduler.ts` | 이자 스케줄러 |

---

## 흐름도

### 예금

```
사용자 → /금고 예금 10000
         ↓
    구독 확인 (디토뱅크 활성?)
         ↓
    한도 확인 (현재 + 예금액 ≤ 한도?)
         ↓
    잔액 확인 (지갑에 충분한 금액?)
         ↓
    지갑에서 차감 → 금고에 추가
         ↓
    거래 기록 생성
         ↓
    결과 메시지 표시
```

### 월간 이자 지급

```
스케줄러 (매월 1일 00:00)
         ↓
  모든 길드 순회
         ↓
  길드 내 모든 금고 조회
         ↓
  각 유저에 대해:
    - 예금액 > 0?
    - 구독 활성?
    - 이번 달 이자 미수령?
         ↓
  이자 계산 및 금고에 추가
         ↓
  거래 기록 생성
```
