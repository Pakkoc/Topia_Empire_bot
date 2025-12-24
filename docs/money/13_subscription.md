# 후원 구독 보상

> 참조: `00_money_sys.md` 2-5. 후원 구독 보상

## 개요

서버 후원자(구독자)에게 매일 토피를 지급하는 시스템
**자동 지급 아님** - `/구독보상` 명령어로 수령

## 현재 상태

- [ ] DB 테이블: `subscription_rewards`
- [ ] Service: 구독 보상 메서드
- [ ] Bot: `/구독보상` 명령어

## 수치/규칙

| 등급 | 일일 토피 |
|------|-----------|
| PREMIUM | **350토피** |
| DELUXE | **300토피** |
| STANDARD | **250토피** |
| BASIC | **200토피** |
| CLASSIC | **150토피** |

- 쿨다운: **24시간**
- 자동 지급 아님 (수령형)

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/39_subscription_tiers.sql
CREATE TABLE subscription_tiers (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    role_id VARCHAR(20) NOT NULL,
    daily_reward INT NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_guild_role (guild_id, role_id),
    INDEX idx_guild (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/40_subscription_claims.sql
CREATE TABLE subscription_claims (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    tier_id INT NOT NULL,
    tier_name VARCHAR(50) NOT NULL,
    amount INT NOT NULL,
    claimed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_user_date (guild_id, user_id, claimed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Core 서비스

```typescript
// 구독 보상 수령 가능 여부 확인
async canClaimSubscriptionReward(
  guildId: string,
  userId: string,
  roleIds: string[]
): Promise<Result<{ canClaim: boolean; tier: SubscriptionTier | null; nextClaimAt: Date | null }, Error>>

// 구독 보상 수령
async claimSubscriptionReward(
  guildId: string,
  userId: string,
  roleIds: string[]
): Promise<Result<ClaimResult, Error>>
```

### 3. 보상 로직

1. 유저의 역할 목록 확인
2. 구독 등급 역할 매칭 (가장 높은 등급)
3. 24시간 쿨다운 확인
4. 토피 지급 및 기록

### 4. Bot 명령어

```
/구독보상
- 구독 등급 확인
- 쿨다운 확인
- 보상 지급
```

### 5. Web 관리

- 구독 등급 설정 (역할 매핑)
- 일일 보상 금액 설정
- 수령 내역 조회
