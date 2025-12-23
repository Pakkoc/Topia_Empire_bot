# XP/레벨링 시스템 기획서

## 1. 시스템 개요

| 항목 | 내용 |
|------|------|
| 목적 | 디스코드 서버 활동에 따라 XP를 부여하고, 레벨업과 보상으로 참여도 향상 |
| 연동 방식 | 디스코드 봇 + 웹 대시보드 |
| 대상 사용자 | 서버 관리자 및 일반 유저 |

### 지원 기능
- 텍스트 및 음성 XP 관리
- 레벨업 및 보상 시스템
- 웹 대시보드를 통한 직관적 설정

---

## 2. 핵심 기능

### 2-1. XP 부여

| 기능 | 설명 | 설정 옵션 |
|------|------|-----------|
| 텍스트 XP | 채팅 메시지 기반 경험치 부여 | N XP, N분마다 최대 N회 획득 |
| 음성 XP | 음성 채널 활동 기반 경험치 부여 | N XP, N분마다 최대 N회 획득 |
| XP 차단 채널 | XP를 받을 수 없는 채널 지정 | 채널 선택 |
| XP 차단 역할 | XP를 받을 수 없는 역할 지정 | 역할 선택 (예: 미인증 유저) |

### 2-2. 레벨업 시스템

| 기능 | 설명 | 설정 옵션 |
|------|------|-----------|
| 레벨업 조건 | 레벨 달성 기준 XP 설정 | 레벨당 N XP 필요 |
| 레벨업 알림 | 레벨업 시 채널에 알림 발송 | 알림 채널 지정 |
| 레벨업 보상 | 레벨 달성 시 역할 부여/제거 | 이전 역할 유지 여부 선택, 역할 지정 |
| 해금 채널 | 특정 레벨 달성 시 접근 가능한 채널 | 채널 선택 |

### 2-3. XP 핫타임

| 기능 | 설명 | 설정 옵션 |
|------|------|-----------|
| 텍스트 XP 핫타임 | 특정 시간대 텍스트 XP 배율 증가 | 시작 시간, 종료 시간, 배율 |
| 음성 XP 핫타임 | 특정 시간대 음성 XP 배율 증가 | 시작 시간, 종료 시간, 배율 |
| 핫타임 적용 채널 | 핫타임이 적용될 채널 선택 | 채널 선택 (미선택 시 모든 채널 적용) |

> 핫타임 적용 채널을 지정하지 않으면 모든 채널에서 핫타임이 적용됩니다. 특정 채널에서만 핫타임을 적용하려면 채널을 선택하세요.

### 2-4. XP 배율 시스템

> **배율 우선순위: 핫타임 > 역할 > 채널 (중첩 없음, 하나만 적용)**

| 기능 | 설명 | 설정 옵션 |
|------|------|-----------|
| 역할 배율 | 특정 역할에 XP 배율 적용 | 역할 선택, 배율 설정 |
| 채널 배율 | 특정 채널에 XP 배율 적용 | 채널 선택, 배율 설정 |

#### 배율 적용 규칙

```
1. 핫타임 활성 시간 + 핫타임 적용 채널 → 핫타임 배율 적용
2. 그 외 + 역할 배율 존재 → 역할 배율 적용 (여러 역할 시 최대값)
3. 그 외 + 채널 배율 존재 → 채널 배율 적용
4. 위 조건 모두 해당 없음 → 배율 1.0 (기본)
```

#### 예시 시나리오

| 상황 | 핫타임 | 역할 배율 | 채널 배율 | 적용 배율 |
|------|--------|-----------|-----------|----------|
| 일반채팅 + 핫타임 시간 + 핫타임 적용 채널 | 1.5x | - | - | **1.5x** |
| 수면실 + 핫타임 시간 (핫타임 채널 아님) | - | - | 0.5x | **0.5x** |
| 수면실 + VIP역할 | - | 0.8x | 0.5x | **0.8x** |
| 수면실 + 일반유저 | - | - | 0.5x | **0.5x** |
| 일반채널 + 일반유저 | - | - | - | **1.0x** |

---

## 3. 웹 대시보드 UI 설계

### 3-1. 좌측 메뉴 구조

```
Dashboard
└── XP / Level System
    ├── XP 설정 (텍스트/음성)
    ├── XP 배율 설정
    ├── XP 핫타임
    ├── XP 차단 채널/역할
    ├── 레벨 설정
    ├── 레벨별 보상 설정
    ├── 레벨업 알림 채널
    ├── 해금 채널
    └── Logs / 통계
```

### 3-2. 주요 UI 화면

#### XP 설정 화면
- 텍스트 XP: 입력창(N XP), 쿨다운(N분), 최대 획득 횟수
- 음성 XP: 입력창(N XP), 쿨다운(N분), 최대 획득 횟수

#### XP 배율 설정 화면
- 역할별 배율 설정 (역할 선택 + 배율 입력)
- 채널별 배율 설정 (채널 선택 + 배율 입력)
- 배율 우선순위 안내 표시

#### XP 핫타임 화면
- 핫타임 ON/OFF, 시간 선택, 배율 선택
- 핫타임 적용 채널 선택 (다중 선택)

#### XP 차단 화면
- 채널 선택 체크박스
- 역할 선택 체크박스

#### 레벨업 설정 화면
- 레벨별 필요 XP 입력
- 레벨업 알림 채널 선택
- 레벨별 보상 역할 선택 + 이전 역할 제거 여부

#### 해금 채널 화면
- 특정 레벨 달성 시 접근 가능 채널 체크

### 3-3. 알림/로그
- 레벨업 이벤트 발생 시 대시보드 알림 기록
- XP 획득 통계, 레벨업 유저 통계

---

## 4. 데이터 구조

> 모든 테이블은 확장성을 고려하여 설계됨. XP 시스템 테이블은 `xp_` prefix로 통일.

### 4-0. 기반 테이블: `guilds`

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

---

### 4-1. XP 설정 테이블: `xp_settings`

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
| created_at | DATETIME | - | 생성일 |
| updated_at | DATETIME | - | 수정일 |

---

### 4-2. 유저 XP 테이블: `xp_users`

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
| created_at | DATETIME | - | 생성일 |
| updated_at | DATETIME | - | 수정일 |

**제약조건**: `PRIMARY KEY (guild_id, user_id)`

---

### 4-3. XP 핫타임 테이블: `xp_hot_times`

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| id | INT | AUTO_INCREMENT | PK |
| guild_id | VARCHAR(20) | - | 서버 ID (FK) |
| type | ENUM | - | 'text', 'voice', 'all' |
| start_time | TIME | - | 핫타임 시작 시간 |
| end_time | TIME | - | 핫타임 종료 시간 |
| multiplier | DECIMAL(4,2) | - | XP 배율 (최대 99.99) |
| enabled | BOOLEAN | true | 활성화 여부 |
| created_at | DATETIME | - | 생성일 |

**인덱스**: `INDEX (guild_id, type, enabled)`

---

### 4-4. 핫타임 적용 채널 테이블: `xp_hot_time_channels`

> 핫타임이 적용될 채널을 지정합니다. 채널이 등록되지 않은 핫타임은 적용되지 않습니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK (AUTO_INCREMENT) |
| hot_time_id | INT | 핫타임 ID (FK → xp_hot_times.id) |
| channel_id | VARCHAR(20) | 적용할 채널 ID |
| created_at | DATETIME | 생성일 |

**제약조건**:
- `UNIQUE (hot_time_id, channel_id)`
- `FOREIGN KEY (hot_time_id) REFERENCES xp_hot_times(id) ON DELETE CASCADE`

---

### 4-5. XP 제외 테이블: `xp_exclusions`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK (AUTO_INCREMENT) |
| guild_id | VARCHAR(20) | 서버 ID (FK) |
| target_type | ENUM('channel', 'role') | 대상 타입 |
| target_id | VARCHAR(20) | 채널 또는 역할 ID |
| created_at | DATETIME | 생성일 |

**제약조건**: `UNIQUE (guild_id, target_type, target_id)`

---

### 4-6. XP 배율 테이블: `xp_multipliers`

> 특정 채널/역할에 XP 배율 적용. **배율은 중첩되지 않으며 우선순위(역할 > 채널)에 따라 하나만 적용됩니다.**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK (AUTO_INCREMENT) |
| guild_id | VARCHAR(20) | 서버 ID (FK) |
| target_type | ENUM('channel', 'role') | 대상 타입 |
| target_id | VARCHAR(20) | 채널 또는 역할 ID |
| multiplier | DECIMAL(4,2) | XP 배율 |
| created_at | DATETIME | 생성일 |

**제약조건**: `UNIQUE (guild_id, target_type, target_id)`

---

### 4-7. 레벨 보상 테이블: `xp_level_rewards`

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| id | INT | AUTO_INCREMENT | PK |
| guild_id | VARCHAR(20) | - | 서버 ID (FK) |
| level | INT | - | 보상 레벨 |
| role_id | VARCHAR(20) | - | 부여할 역할 ID |
| remove_on_higher_level | BOOLEAN | false | 다음 레벨 달성 시 제거 |
| created_at | DATETIME | - | 생성일 |

**제약조건**: `UNIQUE (guild_id, level, role_id)`

---

### 4-8. 레벨 해금 채널 테이블: `xp_level_channels`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT | PK (AUTO_INCREMENT) |
| guild_id | VARCHAR(20) | 서버 ID (FK) |
| level | INT | 해금 레벨 |
| channel_id | VARCHAR(20) | 해금할 채널 ID |
| created_at | DATETIME | 생성일 |

**제약조건**: `UNIQUE (guild_id, channel_id)` - 한 채널은 하나의 레벨에만 연결

---

### 4-9. ERD 관계도

```
guilds (1) ─────┬───── (1) xp_settings
               │
               ├───── (N) xp_users
               │
               ├───── (N) xp_hot_times ───── (N) xp_hot_time_channels
               │
               ├───── (N) xp_exclusions
               │
               ├───── (N) xp_multipliers
               │
               ├───── (N) xp_level_rewards
               │
               └───── (N) xp_level_channels
```

---

## 5. 기능 플로우

```
1. 유저 활동 감지 (채팅/음성)
           ↓
2. XP 지급 조건 체크
   ├── 채널/역할 제외 여부
   └── 쿨다운 체크
           ↓
3. 배율 결정 (우선순위: 핫타임 > 역할 > 채널)
   ├── 핫타임 활성 + 적용 채널? → 핫타임 배율
   ├── 역할 배율 존재? → 역할 배율 (최대값)
   ├── 채널 배율 존재? → 채널 배율
   └── 해당 없음 → 1.0
           ↓
4. XP 계산: 기본XP × 배율
           ↓
5. 레벨업 조건 충족 시
   ├── 레벨업 처리
   ├── 보상 역할 부여/제거
   ├── 레벨업 알림 전송
   └── 해금 채널 접근 허용
           ↓
6. 대시보드에서 설정 값 즉시 반영
```

---

## 6. 기본 설정값

| 항목 | 기본값 |
|------|--------|
| 텍스트 XP | 15~25 XP |
| 텍스트 쿨다운 | 60초 |
| 음성 XP | 10~20 XP |
| 음성 쿨다운 | 60초 |
| 기본 배율 | 1.0 |
