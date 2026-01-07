# 디폴트 상점 아이템 시스템

## 개요

상점에 기본 제공되는 시스템 아이템들입니다. 웹 관리 페이지에서 "기본 아이템 추가" 버튼을 통해 등록할 수 있습니다.

- 기본 가격: 0원 (관리자가 직접 설정)
- 기본 상태: 비활성화 (관리자가 직접 활성화)

---

## 아이템 목록

### 인벤토리형 (소모성)

| 아이템           | item_type                | 설명             | 동작 방식                  |
| ---------------- | ------------------------ | ---------------- | -------------------------- |
| 경고차감권       | `warning_reduction`      | 경고 1회 차감    | 티켓 문의를 통해 수동 처리 |
| 세금면제권       | `tax_exemption`          | 월말 세금 면제   | 세금 징수 시 자동 소모     |
| 이체수수료감면권 | `transfer_fee_reduction` | 이체 수수료 면제 | 이체 시 선택적 사용        |
| 색상선택권(기본) | `color_basic`            | 닉네임 색상 1회 변경 | 1회 사용, 색상 영구 유지 |

### 역할지급형 (기간제)

| 아이템              | item_type        | 기본 기간 | 설명                              |
| ------------------- | ---------------- | --------- | --------------------------------- |
| 활동부스트권        | `activity_boost` | 30일      | XP/화폐 배율 적용 (설정에서 조정) |
| 프리미엄잠수방      | `premium_afk`    | 30일      | 프리미엄 잠수방 채널 접근         |
| VIP라운지입장권     | `vip_lounge`     | 30일      | VIP 라운지 채널 접근              |
| 디토실버            | `dito_silver`    | 30일      | 디토뱅크 실버 혜택                |
| 디토골드            | `dito_gold`      | 30일      | 디토뱅크 골드 혜택                |
| 색상선택권(프리미엄) | `color_premium`  | 30일      | 기간 내 닉네임 색상 자유 변경     |

---

## 세금면제권 동작

### 자동 소모 로직

월말 세금 징수 시 (`TaxService.processMonthlyTax`):

1. 유저가 세금면제권을 보유하고 있는지 확인
2. 보유 시 1개 자동 소모
3. 해당 월 세금 면제 처리

```typescript
// tax.service.ts
const exemptionItem = await this.shopV2Repo.findUserItemByType(
  guildId,
  wallet.userId,
  "tax_exemption"
);

if (exemptionItem && exemptionItem.quantity > 0) {
  await this.shopV2Repo.decreaseUserItemQuantity(exemptionItem.id, 1);
  // 세금 면제 처리
}
```

---

## 이체수수료감면권 동작

### 선택적 사용 UI

이체 명령어 실행 시 수수료가 발생하고 감면권을 보유한 경우:

1. "감면권 사용" / "그냥 이체" 버튼 표시
2. 사용자 선택에 따라 처리
3. 감면권 사용 시 1개 소모, 수수료 면제

```
┌─────────────────────────────────────┐
│ 이체수수료감면권을 보유하고 있습니다     │
│ 사용하시겠습니까?                     │
│                                     │
│ [감면권 사용] [그냥 이체]              │
└─────────────────────────────────────┘
```

---

## 디토뱅크 구독 연동

### 디토실버/골드 구매 시

`ShopService.purchaseItem` 또는 `ShopV2Service.purchaseItem`에서:

1. `item_type`이 `dito_silver` 또는 `dito_gold`인지 확인
2. 기존 구독이 있으면 기간 연장
3. 없으면 새 구독 생성

```typescript
// shop.service.ts
if (item.itemType === "dito_silver" || item.itemType === "dito_gold") {
  const tier = item.itemType === "dito_silver" ? "silver" : "gold";
  // bank_subscriptions 테이블에 구독 생성/연장
}
```

---

## 웹 관리 페이지

### 기본 아이템 추가 버튼

`/dashboard/[guildId]/currency/shop` 페이지:

- "기본 아이템 추가" 버튼 클릭
- `POST /api/guilds/[guildId]/shop-v2/seed` 호출
- 이미 등록된 item_type은 스킵
- 등록 결과 토스트 메시지 표시

### 아이템 타입 배지

시스템 아이템(`custom`이 아닌 item_type)은 파란색 배지로 표시:

```
[활성] [세금면제권] 세금면제권
       ^^^^^^^^^^^ 시스템 아이템 배지
```

---

## DB 스키마

### shop_items_v2.item_type

```sql
ALTER TABLE shop_items_v2
ADD COLUMN item_type VARCHAR(50) NULL DEFAULT 'custom'
AFTER currency_type;

CREATE INDEX idx_shop_item_type ON shop_items_v2 (guild_id, item_type);
```

### item_type 값

| 값                       | 한글명              |
| ------------------------ | ------------------- |
| `custom`                 | 일반                |
| `warning_reduction`      | 경고차감권          |
| `tax_exemption`          | 세금면제권          |
| `transfer_fee_reduction` | 이체수수료감면권    |
| `activity_boost`         | 활동부스트권        |
| `premium_afk`            | 프리미엄잠수방      |
| `vip_lounge`             | VIP라운지입장권     |
| `dito_silver`            | 디토실버            |
| `dito_gold`              | 디토골드            |
| `color_basic`            | 색상선택권(기본)    |
| `color_premium`          | 색상선택권(프리미엄) |

---

## 관련 파일

| 파일                                                             | 설명               |
| ---------------------------------------------------------------- | ------------------ |
| `packages/core/src/currency-system/domain/default-shop-items.ts` | 디폴트 아이템 정의 |
| `packages/core/src/currency-system/domain/shop-item.ts`          | ShopItemType 타입  |
| `packages/core/src/currency-system/service/tax.service.ts`       | 세금면제권 로직    |
| `apps/bot/src/commands/transfer.ts`                              | 이체감면권 UI      |
| `apps/web/src/app/api/guilds/[guildId]/shop-v2/seed/route.ts`    | 시딩 API           |
