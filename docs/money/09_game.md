# 게임센터 & 내전 배팅

> 참조: `00_money_sys.md` 9️⃣ 게임센터 & 내전 배팅

## 개요

공식 내전 참여 및 배팅 시스템

## 현재 상태

- [ ] DB 테이블: `games`, `game_bets`
- [ ] Domain: `Game`, `GameBet`
- [ ] Repository: `GameRepository`
- [ ] Service: 게임/배팅 메서드
- [ ] Bot: 배팅 명령어 (UI 마지막에)

## 수치/규칙

| 항목 | 값 |
|------|-----|
| 참여비 | 500 ~ 2,000 토피 |
| 배팅 수수료 | **20%** |
| 최소 배팅 | 100 토피 |
| 최대 배팅 | 10,000 토피 |

## 구현 계획

### 1. 데이터베이스

```sql
-- sql/28_games.sql
CREATE TABLE games (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    game_type ENUM('1v1', 'team', 'tournament') NOT NULL,
    entry_fee BIGINT NOT NULL DEFAULT 0,
    prize_pool BIGINT NOT NULL DEFAULT 0,
    status ENUM('pending', 'open', 'in_progress', 'finished', 'cancelled') NOT NULL DEFAULT 'pending',
    winner_team VARCHAR(50) NULL,
    created_by VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    PRIMARY KEY (id),
    INDEX idx_guild_status (guild_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/29_game_participants.sql
CREATE TABLE game_participants (
    id BIGINT NOT NULL AUTO_INCREMENT,
    game_id BIGINT NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    team VARCHAR(50) NULL,
    entry_paid BIGINT NOT NULL DEFAULT 0,
    prize_received BIGINT NOT NULL DEFAULT 0,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_game_user (game_id, user_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- sql/30_game_bets.sql
CREATE TABLE game_bets (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    game_id BIGINT NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    bet_on VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    odds DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    status ENUM('pending', 'won', 'lost', 'refunded') NOT NULL DEFAULT 'pending',
    payout BIGINT NOT NULL DEFAULT 0,
    fee BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_at DATETIME NULL,
    PRIMARY KEY (id),
    INDEX idx_game (game_id),
    INDEX idx_user (guild_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. Core Domain

```typescript
// packages/core/src/currency-system/domain/game.ts
export interface Game {
  id: bigint;
  guildId: string;
  title: string;
  description: string | null;
  gameType: '1v1' | 'team' | 'tournament';
  entryFee: bigint;
  prizePool: bigint;
  status: 'pending' | 'open' | 'in_progress' | 'finished' | 'cancelled';
  winnerTeam: string | null;
  createdBy: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface GameBet {
  id: bigint;
  guildId: string;
  gameId: bigint;
  userId: string;
  betOn: string;
  amount: bigint;
  odds: number;
  status: 'pending' | 'won' | 'lost' | 'refunded';
  payout: bigint;
  fee: bigint;
}
```

### 3. Core 서비스

```typescript
// 게임 생성 (관리자)
async createGame(
  guildId: string,
  createdBy: string,
  data: CreateGameData
): Promise<Result<Game, CurrencyError>>

// 게임 참여
async joinGame(
  guildId: string,
  gameId: bigint,
  userId: string,
  team?: string
): Promise<Result<void, CurrencyError>>

// 배팅
async placeBet(
  guildId: string,
  gameId: bigint,
  userId: string,
  betOn: string,
  amount: bigint
): Promise<Result<GameBet, CurrencyError>>

// 게임 종료 및 정산
async finishGame(
  guildId: string,
  gameId: bigint,
  winnerTeam: string
): Promise<Result<SettlementResult, CurrencyError>>
```

### 4. 배팅 정산 로직

1. 게임 종료 시 승자팀 설정
2. 모든 배팅 조회
3. 승리 배팅: `payout = amount * odds`
4. 수수료 차감: `fee = payout * 0.2`
5. 실 지급액: `payout - fee`
6. 패배 배팅: 손실 처리
7. 거래 기록 저장

### 5. 배당률 계산

```typescript
// 단순 배당률: 총 배팅금 / 해당 팀 배팅금
function calculateOdds(totalPool: bigint, teamPool: bigint): number {
  if (teamPool === BigInt(0)) return 1;
  return Number(totalPool) / Number(teamPool);
}
```
