# 출석 보상

> 참조: `00_money_sys.md` 2-3. 기타 활동

## 개요

매일 출석체크로 토피를 획득하는 기능

## 현재 상태

- [ ] DB 테이블: `daily_rewards`
- [ ] Domain: `DailyReward`
- [ ] Repository: `DailyRewardRepository`
- [ ] Service: 출석체크 메서드
- [ ] Bot: 출석 버튼 (UI 마지막에)

## 수치/규칙

| 항목 | 값 |
|------|-----|
| 출석 보상 | **10토피** |
| 쿨다운 | **24시간** |
| 연속 출석 보너스 | 추후 검토 |

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/20_daily_rewards.sql
CREATE TABLE daily_rewards (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    reward_type ENUM('attendance', 'subscription') NOT NULL,
    last_claimed_at DATETIME NOT NULL,
    streak_count INT NOT NULL DEFAULT 0,
    total_count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id, reward_type),
    INDEX idx_guild (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Core Domain

```typescript
// packages/core/src/currency-system/domain/daily-reward.ts

export interface DailyReward {
  guildId: string;
  userId: string;
  rewardType: 'attendance' | 'subscription';
  lastClaimedAt: Date;
  streakCount: number;
  totalCount: number;
}
```

### 3. Core 서비스

```typescript
// packages/core/src/currency-system/service/currency.service.ts

interface AttendanceResult {
  success: boolean;
  reward: number;
  streakCount: number;
  totalCount: number;
  nextClaimAt: Date;
}

async claimAttendance(
  guildId: string,
  userId: string
): Promise<Result<AttendanceResult, CurrencyError>>

async getAttendanceStatus(
  guildId: string,
  userId: string
): Promise<Result<{ canClaim: boolean; nextClaimAt: Date | null; totalCount: number }, CurrencyError>>
```

### 4. 출석 로직

1. 마지막 출석 시간 확인
2. 24시간 경과 여부 체크
3. 연속 출석 계산 (24~48시간 내: streak+1, 그 외: streak=1)
4. 토피 지급
5. 거래 기록 저장

### 5. 에러 케이스

| 에러 | 설명 |
|------|------|
| `ALREADY_CLAIMED` | 24시간 내 이미 출석 |
| `NO_SETTINGS` | 서버 설정 없음 |
