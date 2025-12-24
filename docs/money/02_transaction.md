# 거래 기록 조회

> 참조: `00_money_sys.md` 11️⃣ 봇 핵심 로직

## 개요

유저의 토피/루비 거래 내역을 조회하는 기능

## 현재 상태

- [x] DB 테이블: `currency_transactions`
- [x] Domain: `CurrencyTransaction`
- [x] Repository: `CurrencyTransactionRepository`
- [ ] Service: 거래 내역 조회 메서드
- [ ] Web API: 거래 내역 조회
- [ ] Web 페이지: 거래 내역 목록

## 구현 계획

### 1. Core 서비스

```typescript
// packages/core/src/currency-system/service/currency.service.ts

async getTransactions(
  guildId: string,
  userId?: string,
  limit?: number,
  offset?: number
): Promise<Result<CurrencyTransaction[], CurrencyError>>

async getTransactionsByType(
  guildId: string,
  type: TransactionType,
  limit?: number,
  offset?: number
): Promise<Result<CurrencyTransaction[], CurrencyError>>
```

### 2. Infra Repository

```typescript
// packages/infra/src/database/repositories/currency-transaction.repository.ts

// 기존 save 메서드 외 추가
findByGuild(guildId: string, limit: number, offset: number): Promise<Result<CurrencyTransaction[], Error>>
findByUser(guildId: string, userId: string, limit: number, offset: number): Promise<Result<CurrencyTransaction[], Error>>
```

### 3. Web API

| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/guilds/[guildId]/currency/transactions` | GET | 거래 기록 목록 |

**Query Parameters:**
- `userId`: 특정 유저 필터 (선택)
- `type`: 거래 유형 필터 (선택)
- `limit`: 페이지 크기 (기본 20)
- `offset`: 오프셋

### 4. Web 페이지

- 경로: `/dashboard/[guildId]/currency/transactions`
- 테이블: 날짜, 유저, 유형, 금액, 잔액
- 필터: 유저 검색, 거래 유형, 날짜 범위

## 거래 유형 (TransactionType)

| 타입 | 설명 |
|------|------|
| `earn_text` | 채팅 활동 보상 |
| `earn_voice` | 음성 활동 보상 |
| `transfer_send` | 이체 송금 |
| `transfer_receive` | 이체 수신 |
| `shop_purchase` | 상점 구매 |
| `market_sell` | 장터 판매 |
| `market_buy` | 장터 구매 |
| `attendance` | 출석 보상 |
| `tax` | 세금 차감 |
| `fee` | 수수료 차감 |
| `admin_give` | 관리자 지급 |
| `admin_take` | 관리자 차감 |
