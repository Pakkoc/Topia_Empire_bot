# 퀘스트 / 이벤트

> 참조: `00_money_sys.md` 2-4. 퀘스트 / 이벤트

## 개요

일일 퀘스트 및 서버 이벤트 보상 시스템

## 현재 상태

- [ ] DB 테이블: `quests`, `user_quests`, `events`
- [ ] Domain: `Quest`, `Event`
- [ ] Service: 퀘스트/이벤트 메서드
- [ ] Bot: 퀘스트 명령어
- [ ] Web: 퀘스트/이벤트 관리

## 수치/규칙

| 항목 | 보상 |
|------|------|
| 일일 퀘스트 | **40 ~ 80 토피** |
| 서버 이벤트 | **100 ~ 1,000 토피** |
| 콘텐츠 이벤트 참여권 | 토피/루비로 구매 |

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/36_quests.sql
CREATE TABLE quests (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    quest_type ENUM('daily', 'weekly', 'event') NOT NULL,
    condition_type ENUM('message', 'voice', 'reaction', 'custom') NOT NULL,
    condition_value INT NOT NULL,
    reward_min INT NOT NULL,
    reward_max INT NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_guild_type (guild_id, quest_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/37_user_quests.sql
CREATE TABLE user_quests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    quest_id INT NOT NULL,
    progress INT NOT NULL DEFAULT 0,
    status ENUM('in_progress', 'completed', 'claimed') NOT NULL DEFAULT 'in_progress',
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    claimed_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_quest (guild_id, user_id, quest_id, started_at),
    INDEX idx_user (guild_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/38_events.sql
CREATE TABLE events (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    event_type ENUM('general', 'content', 'competition') NOT NULL,
    entry_fee BIGINT NOT NULL DEFAULT 0,
    entry_currency ENUM('topy', 'ruby') NOT NULL DEFAULT 'topy',
    reward_pool BIGINT NOT NULL DEFAULT 0,
    max_participants INT NULL,
    status ENUM('upcoming', 'open', 'in_progress', 'finished') NOT NULL DEFAULT 'upcoming',
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_guild_status (guild_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Core 서비스

```typescript
// 일일 퀘스트 목록
async getDailyQuests(guildId: string, userId: string): Promise<Result<UserQuest[], Error>>

// 퀘스트 진행도 업데이트
async updateQuestProgress(
  guildId: string,
  userId: string,
  conditionType: string,
  increment: number
): Promise<Result<void, Error>>

// 퀘스트 보상 수령
async claimQuestReward(
  guildId: string,
  userId: string,
  questId: number
): Promise<Result<ClaimResult, Error>>

// 이벤트 참여
async joinEvent(
  guildId: string,
  userId: string,
  eventId: number
): Promise<Result<void, Error>>
```

### 3. 일일 퀘스트 예시

| 퀘스트 | 조건 | 보상 |
|--------|------|------|
| 수다쟁이 | 메시지 30개 | 50토피 |
| 통화왕 | 음성 30분 | 60토피 |
| 리액션 마스터 | 반응 10개 | 40토피 |

### 4. Web 관리

- 퀘스트 CRUD
- 이벤트 생성/관리
- 참여자 목록
- 보상 지급
