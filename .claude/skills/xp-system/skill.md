# XP/레벨링 시스템

XP 시스템 구현 시 이 규칙을 따르세요.

## 시스템 개요

| 항목 | 내용 |
|------|------|
| 목적 | 디스코드 서버 활동에 따라 XP를 부여하고, 레벨업과 보상으로 참여도 향상 |
| 연동 방식 | 디스코드 봇 + 웹 대시보드 |
| 대상 사용자 | 서버 관리자 및 일반 유저 |

## 핵심 기능

### XP 부여

| 기능 | 설명 | 설정 옵션 |
|------|------|-----------|
| 텍스트 XP | 채팅 메시지 기반 경험치 부여 | N XP, N분마다 최대 N회 획득, 핫타임 설정 |
| 음성 XP | 음성 채널 활동 기반 경험치 부여 | N XP, N분마다 최대 N회 획득, 핫타임 설정 |
| XP 차단 채널 | XP를 받을 수 없는 채널 지정 | 채널 선택 |
| XP 차단 역할 | XP를 받을 수 없는 역할 지정 | 역할 선택 |

### 레벨업 시스템

| 기능 | 설명 | 설정 옵션 |
|------|------|-----------|
| 레벨업 조건 | 레벨 달성 기준 XP 설정 | 레벨당 N XP 필요 |
| 레벨업 알림 | 레벨업 시 채널에 알림 발송 | 알림 채널 지정 |
| 레벨업 보상 | 레벨 달성 시 역할 부여/제거 | 이전 역할 유지 여부, 역할 지정 |
| 해금 채널 | 특정 레벨 달성 시 접근 가능한 채널 | 채널 선택 |

### XP 핫타임

| 기능 | 설명 | 설정 옵션 |
|------|------|-----------|
| 텍스트 XP 핫타임 | 특정 시간대 텍스트 XP 배율 증가 | 시작 시간, 종료 시간, 배율, 쿨다운 |
| 음성 XP 핫타임 | 특정 시간대 음성 XP 배율 증가 | 시작 시간, 종료 시간, 배율, 쿨다운 |

## 기본 설정값

| 항목 | 기본값 |
|------|--------|
| 텍스트 XP | 15~25 XP |
| 텍스트 쿨다운 | 60초 |
| 음성 XP | 10~20 XP |
| 음성 쿨다운 | 60초 |
| 레벨업 공식 | `5 * (level^2) + 50 * level + 100` |

## 기능 플로우

```
1. 유저 활동 감지 (채팅/음성)
           ↓
2. XP 지급 조건 체크
   ├── 채널/역할 제외 여부
   ├── 쿨다운 체크
   └── 핫타임 적용
           ↓
3. XP 추가
           ↓
4. 레벨업 조건 충족 시
   ├── 레벨업 처리
   ├── 보상 역할 부여/제거
   ├── 레벨업 알림 전송
   └── 해금 채널 접근 허용
           ↓
5. 대시보드에서 설정 값 즉시 반영 (Redis Pub/Sub)
```

## DB 스키마

> 모든 테이블은 `xp_` prefix로 통일

### guilds (기반 테이블)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | VARCHAR(20) | 서버 ID (PK) |
| name | VARCHAR(100) | 서버 이름 |
| icon_url | VARCHAR(255) | 서버 아이콘 URL |
| owner_id | VARCHAR(20) | 서버 소유자 ID |
| joined_at | DATETIME | 봇 입장 시간 |
| left_at | DATETIME | 봇 퇴장 시간 (NULL = 활성) |
| created_at | DATETIME | 생성일 |
| updated_at | DATETIME | 수정일 |

### xp_settings

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| guild_id | VARCHAR(20) | - | 서버 ID (PK, FK) |
| enabled | BOOLEAN | true | XP 시스템 활성화 |
| text_xp_enabled | BOOLEAN | true | 텍스트 XP 활성화 |
| text_xp_min | INT | 15 | 텍스트 XP 최소값 |
| text_xp_max | INT | 25 | 텍스트 XP 최대값 |
| text_cooldown_seconds | INT | 60 | 텍스트 XP 쿨다운 (초) |
| text_max_per_cooldown | INT | 1 | 쿨다운 내 최대 획득 횟수 |
| voice_xp_enabled | BOOLEAN | true | 음성 XP 활성화 |
| voice_xp_min | INT | 10 | 음성 XP 최소값 |
| voice_xp_max | INT | 20 | 음성 XP 최대값 |
| voice_cooldown_seconds | INT | 60 | 음성 XP 쿨다운 (초) |
| voice_max_per_cooldown | INT | 1 | 쿨다운 내 최대 획득 횟수 |
| level_up_channel_id | VARCHAR(20) | NULL | 레벨업 알림 채널 |
| level_up_message | TEXT | NULL | 커스텀 레벨업 메시지 |

### xp_users

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| guild_id | VARCHAR(20) | - | 서버 ID (PK, FK) |
| user_id | VARCHAR(20) | - | 유저 ID (PK) |
| xp | INT | 0 | 현재 XP |
| level | INT | 0 | 현재 레벨 |
| last_text_xp_at | DATETIME | NULL | 텍스트 XP 마지막 획득 시간 |
| text_count_in_cooldown | INT | 0 | 쿨다운 내 텍스트 XP 획득 횟수 |
| last_voice_xp_at | DATETIME | NULL | 음성 XP 마지막 획득 시간 |
| voice_count_in_cooldown | INT | 0 | 쿨다운 내 음성 XP 획득 횟수 |

**제약조건**: `PRIMARY KEY (guild_id, user_id)`

### xp_hot_times

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| id | INT | AUTO_INCREMENT | PK |
| guild_id | VARCHAR(20) | - | 서버 ID (FK) |
| type | ENUM | - | 'text', 'voice', 'all' |
| start_time | TIME | - | 핫타임 시작 시간 |
| end_time | TIME | - | 핫타임 종료 시간 |
| multiplier | DECIMAL(4,2) | - | XP 배율 (최대 99.99) |
| enabled | BOOLEAN | true | 활성화 여부 |

**인덱스**: `INDEX (guild_id, type, enabled)`

### xp_exclusions

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK (AUTO_INCREMENT) |
| guild_id | VARCHAR(20) | 서버 ID (FK) |
| target_type | ENUM('channel', 'role') | 대상 타입 |
| target_id | VARCHAR(20) | 채널 또는 역할 ID |

**제약조건**: `UNIQUE (guild_id, target_type, target_id)`

### xp_multipliers

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK (AUTO_INCREMENT) |
| guild_id | VARCHAR(20) | 서버 ID (FK) |
| target_type | ENUM('channel', 'role') | 대상 타입 |
| target_id | VARCHAR(20) | 채널 또는 역할 ID |
| multiplier | DECIMAL(4,2) | XP 배율 |

**제약조건**: `UNIQUE (guild_id, target_type, target_id)`

### xp_level_rewards

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| id | INT | AUTO_INCREMENT | PK |
| guild_id | VARCHAR(20) | - | 서버 ID (FK) |
| level | INT | - | 보상 레벨 |
| role_id | VARCHAR(20) | - | 부여할 역할 ID |
| remove_on_higher_level | BOOLEAN | false | 다음 레벨 달성 시 제거 |

**제약조건**: `UNIQUE (guild_id, level, role_id)`

### xp_level_channels

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK (AUTO_INCREMENT) |
| guild_id | VARCHAR(20) | 서버 ID (FK) |
| level | INT | 해금 레벨 |
| channel_id | VARCHAR(20) | 해금할 채널 ID |

**제약조건**: `UNIQUE (guild_id, channel_id)`

## ERD 관계도

```
guilds (1) ─────┬───── (1) xp_settings
               │
               ├───── (N) xp_users
               │
               ├───── (N) xp_hot_times
               │
               ├───── (N) xp_exclusions
               │
               ├───── (N) xp_multipliers
               │
               ├───── (N) xp_level_rewards
               │
               └───── (N) xp_level_channels
```

## 웹 대시보드 메뉴 구조

```
Dashboard
└── XP / Level System
    ├── 텍스트 XP 설정
    ├── 음성 XP 설정
    ├── XP 핫타임
    ├── XP 차단 채널/역할
    ├── 레벨업 / 보상
    ├── 레벨별 보상 설정
    ├── 레벨업 알림 채널
    ├── 해금 채널
    └── Logs / 통계
```
