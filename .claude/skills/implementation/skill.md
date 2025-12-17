# 구현 규칙

기능 구현 시 이 규칙을 따르세요.

## 필수 규칙

- always use client component for all components (`"use client"` directive)
- use valid picsum.photos stock image for placeholder image
- route feature hooks' HTTP requests through `@/lib/remote/api-client`
- Express 라우트 경로는 반드시 `/api` prefix를 포함

## 라이브러리

| 라이브러리 | 용도 |
|-----------|------|
| `date-fns` | 날짜/시간 처리 |
| `ts-pattern` | 타입 안전 분기 로직 |
| `@tanstack/react-query` | 서버 상태 관리 |
| `zustand` | 전역 상태 관리 |
| `react-use` | React 훅 |
| `es-toolkit` | 유틸리티 함수 |
| `lucide-react` | 아이콘 |
| `zod` | 스키마 검증 |
| `shadcn-ui` | UI 컴포넌트 |
| `tailwindcss` | CSS 스타일링 |
| `mysql2` | MySQL 드라이버 |
| `react-hook-form` | 폼 관리 |
| `next-auth` | 인증 (Discord OAuth2) |
| `ioredis` | Redis Pub/Sub |
| `discord.js` | Discord 봇 |

## 디렉토리 구조

```
topia_empire/
├── apps/
│   ├── web/                          # Next.js 14 웹 대시보드
│   │   └── src/
│   │       ├── app/                  # App Router
│   │       │   ├── api/              # API Routes
│   │       │   └── dashboard/        # 대시보드 페이지
│   │       ├── components/
│   │       │   ├── ui/               # shadcn/ui
│   │       │   ├── layout/           # 레이아웃
│   │       │   └── features/         # 기능별 컴포넌트
│   │       ├── hooks/
│   │       │   ├── queries/          # React Query 훅
│   │       │   └── mutations/
│   │       └── lib/
│   │           └── api-client.ts     # HTTP 클라이언트
│   │
│   └── bot/                          # Discord.js 봇
│       └── src/
│           ├── commands/             # Slash Commands
│           ├── events/               # Discord Events
│           └── handlers/             # Event → Service 연결
│
├── packages/
│   ├── core/                         # Pure Business Logic
│   │   └── src/
│   │       └── {feature}/
│   │           ├── domain/           # Entities, Value Objects
│   │           ├── functions/        # 순수함수 (핵심)
│   │           ├── service/          # Orchestration
│   │           ├── port/             # Interfaces
│   │           └── errors/           # 도메인 에러
│   │
│   ├── infra/                        # Infrastructure Layer
│   │   └── src/
│   │       ├── database/
│   │       │   ├── pool.ts           # MySQL Connection Pool
│   │       │   └── repositories/     # Port 구현체
│   │       ├── cache/                # Redis Client
│   │       ├── event-bus/            # Redis Pub/Sub
│   │       └── container/            # DI Container
│   │
│   └── shared/                       # 공유 타입/유틸리티
│
└── sql/                              # SQL 스키마
    ├── schema/
    └── seeds/
```

## 아키텍처 원칙

### 레이어 규칙
1. Presentation은 Business Logic과 분리
2. Pure Business Logic은 Persistence Layer와 분리
3. 순수함수는 I/O 로직과 분리
4. 외부 의존성(시간, 랜덤 등)은 Port로 추상화

### 의존성 방향
```
apps/web ──┐
           ├──▶ packages/infra ──▶ packages/core
apps/bot ──┘                            │
                                        ▼
                                 packages/shared
```

## 코딩 스타일

### 원칙
- Early Returns
- Descriptive Names
- DRY
- Functional & Immutable
- Pure Functions
- Composition over inheritance

### 함수형 프로그래밍
- Avoid Mutation
- Use Map, Filter, Reduce
- Immutability

### 에러 처리
- Result<T, E> 패턴 사용
- exceptions보다 에러 반환 선호

```typescript
type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };
```

## 새 기능 추가 체크리스트

### 1. Core 패키지
- [ ] `domain/` - Entity, Value Object
- [ ] `functions/` - 순수함수
- [ ] `port/` - Repository 인터페이스
- [ ] `service/` - Orchestration
- [ ] `errors/` - 도메인 에러

### 2. Infra 패키지
- [ ] `repositories/` - Repository 구현
- [ ] `container/` - DI Container 등록

### 3. Bot 앱
- [ ] `handlers/` - Handler 추가
- [ ] `events/` 또는 `commands/` - 연결

### 4. Web 앱
- [ ] `app/api/` - API Route
- [ ] `components/features/` - UI 컴포넌트
- [ ] `hooks/queries/` - React Query 훅

### 5. 데이터베이스
- [ ] `sql/schema/` - 테이블 스키마

## MySQL

- 직접 SQL 쿼리 작성
- connection pool은 `packages/infra/src/database/pool.ts`
- 테이블 생성 시 `sql/schema/` 폴더에 SQL 파일 저장
