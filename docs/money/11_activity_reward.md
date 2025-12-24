# 기타 활동 보상

> 참조: `00_money_sys.md` 2-3. 기타 활동

## 개요

추천, 업, 랭킹, 활동 TOP 등 기타 활동에 대한 토피 보상

## 현재 상태

- [ ] DB 테이블: `activity_rewards`
- [ ] Service: 활동 보상 메서드
- [ ] Bot: 자동 지급 로직

## 수치/규칙

| 항목 | 보상 | 조건 |
|------|------|------|
| 추천 10회 | **100토피** | 서버 추천 10회 달성 시 |
| 업 15회 | **150토피** | 서버 업 15회 달성 시 |
| 랭킹 1등 | **10토피** | 일일 XP 랭킹 1등 |
| 활동 TOP 1~5 | **500토피** | 주간 활동량 1~5위 |
| 활동 TOP 6~10 | **300토피** | 주간 활동량 6~10위 |

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/34_activity_rewards.sql
CREATE TABLE activity_rewards (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    reward_type ENUM('recommend', 'bump', 'daily_rank', 'weekly_top') NOT NULL,
    amount INT NOT NULL,
    reference_count INT NULL,
    reference_rank INT NULL,
    claimed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_guild_user (guild_id, user_id),
    INDEX idx_type_date (guild_id, reward_type, claimed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/35_user_activity_stats.sql
CREATE TABLE user_activity_stats (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    recommend_count INT NOT NULL DEFAULT 0,
    bump_count INT NOT NULL DEFAULT 0,
    last_recommend_reward_at DATETIME NULL,
    last_bump_reward_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Core 서비스

```typescript
// 추천/업 카운트 증가 및 보상 체크
async incrementRecommend(guildId: string, userId: string): Promise<Result<RewardResult | null, Error>>
async incrementBump(guildId: string, userId: string): Promise<Result<RewardResult | null, Error>>

// 일일 랭킹 보상 (매일 자정)
async processeDailyRankReward(guildId: string): Promise<Result<void, Error>>

// 주간 활동 TOP 보상 (매주 월요일)
async processWeeklyTopReward(guildId: string): Promise<Result<void, Error>>
```

### 3. 보상 로직

**추천/업 보상:**
1. 추천/업 발생 시 카운트 증가
2. 10회/15회 달성 시 보상 지급
3. 카운트 리셋

**일일 랭킹 보상:**
1. 매일 자정 XP 획득량 기준 1등 선정
2. 10토피 자동 지급

**주간 TOP 보상:**
1. 매주 월요일 자정 활동량 집계
2. 1~5위: 500토피, 6~10위: 300토피 지급
