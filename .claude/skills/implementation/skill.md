---
name: implementation
description: 기능 구현 시 필요한 규칙. 새 기능 구현, 코드 수정 및 코드 작성, API 개발, UI 컴포넌트 생성, 파일 추가 시 사용.
---

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
- [ ] 현재 DB 스키마 파악 (`sql/schema/` 폴더 확인)
- [ ] 구현하고자 하는 기능에 필요한 테이블 설계
- [ ] `sql/schema/` - 테이블 스키마 파일 생성

## MySQL

- 직접 SQL 쿼리 작성
- connection pool은 `packages/infra/src/database/pool.ts`
- 테이블 생성 시 `sql/schema/` 폴더에 SQL 파일 저장

## 웹-봇 연동 (설정 변경 알림)

웹에서 설정 변경 시 봇에 실시간 알림을 보내야 합니다.

### 사용법

1. `@/lib/bot-notify.ts`의 `notifyBotSettingsChanged` 함수 사용
2. POST/PATCH/DELETE 성공 후 호출
3. **`await` 없이 호출** (봇 알림은 실패해도 에러를 던지지 않으므로 대기 불필요)

```typescript
import { notifyBotSettingsChanged } from "@/lib/bot-notify";

// ✅ 올바른 사용법 - await 없이 호출
notifyBotSettingsChanged({
  guildId,
  type: 'feature-name',  // 기능 타입
  action: '추가',        // '추가' | '수정' | '삭제' | '변경'
  details: '상세 내용',  // 선택사항
});

// ❌ 잘못된 사용법 - 불필요한 대기로 응답 지연
await notifyBotSettingsChanged({ ... });
```

### 새 타입 추가 시

1. `apps/web/src/lib/bot-notify.ts`의 `SettingType`에 타입 추가
2. `apps/bot/src/index.ts`의 `typeLabels`에 한글 라벨 추가

## 유기적 동작 원칙 (중요!)

**설정 변경은 연관된 모든 기능에 연쇄적으로 반영되어야 합니다.**

### 원칙

1. **하나의 설정 변경 → 연관된 모든 데이터/상태 동기화**
2. 변경의 영향 범위를 항상 분석하고, 누락 없이 처리
3. 웹 → DB → 봇 → Discord가 모두 일관된 상태 유지

### 예시: 레벨 설정 변경 시 연쇄 동작

```
웹에서 레벨 설정 변경
    ↓
DB에 레벨 요구사항 저장
    ↓
봇에 알림 (notifyBotSettingsChanged)
    ↓
├─ 유저 레벨 재계산 (XP는 그대로, 레벨만 변경)
├─ 역할 보상 동기화 (레벨 기반 역할 부여/제거)
└─ 해금 채널 동기화 (레벨 기반 채널 권한 부여/제거)
```

### 체크리스트

새 기능 구현 시 다음을 확인하세요:

- [ ] 이 설정이 변경되면 영향받는 다른 기능이 있는가?
- [ ] 영향받는 기능들이 모두 동기화되는가?
- [ ] 역방향도 고려했는가? (예: 레벨↔역할↔채널)
- [ ] 기존 유저 데이터도 소급 적용되는가?

## 봇 재시작 없이 즉시 반영 원칙

**웹에서 설정 변경 시 봇 재시작 없이 바로 적용되어야 합니다.**

### 원칙

1. **설정은 캐싱하지 않음** - 봇이 설정을 메모리에 캐싱하면 웹 변경이 반영 안됨
2. **매번 DB에서 조회** - 설정이 필요할 때마다 Repository에서 조회
3. **실시간 동기화** - 웹 변경 → DB 저장 → 봇의 다음 요청에서 새 설정 사용

### 올바른 패턴

```typescript
// ✅ 올바른 패턴 - 매번 DB 조회
async grantXp(guildId: string, userId: string) {
  const settings = await this.settingsRepo.findByGuild(guildId);  // 매번 조회
  const exclusions = await this.settingsRepo.getExcludedChannels(guildId);
  // ...
}

// ❌ 잘못된 패턴 - 캐싱 (재시작 전까지 변경 미반영)
class XpService {
  private settingsCache = new Map<string, Settings>();

  async grantXp(guildId: string, userId: string) {
    const settings = this.settingsCache.get(guildId);  // 캐시 사용
  }
}
```

### 체크리스트

- [ ] 설정을 메모리에 캐싱하고 있지 않은가?
- [ ] 웹에서 설정 변경 후 봇 재시작 없이 테스트했는가?

## UI 일관성 규칙

### 채널 선택 드롭다운

채널 선택 시 **음성 채널**과 **텍스트 채널**을 그룹으로 분리하여 표시합니다.

#### Select 컴포넌트 사용 시

```tsx
import { SelectGroup, SelectLabel } from "@/components/ui/select";

<SelectContent>
  {voiceChannels.length > 0 && (
    <SelectGroup>
      <SelectLabel className="text-xs text-slate-400">🔊 음성 채널</SelectLabel>
      {voiceChannels.map((ch) => (
        <SelectItem key={ch.id} value={ch.id}>...</SelectItem>
      ))}
    </SelectGroup>
  )}
  {textChannels.length > 0 && (
    <SelectGroup>
      <SelectLabel className="text-xs text-slate-400"># 텍스트 채널</SelectLabel>
      {textChannels.map((ch) => (
        <SelectItem key={ch.id} value={ch.id}>...</SelectItem>
      ))}
    </SelectGroup>
  )}
</SelectContent>
```

#### MultiSelect 컴포넌트 사용 시

`group` 필드를 추가하면 자동으로 그룹화됩니다.

```tsx
const channelOptions: MultiSelectOption[] = channels.map(ch => ({
  value: ch.id,
  label: ch.name,
  icon: isVoiceChannel(ch.type) ? <VoiceIcon /> : <TextIcon />,
  group: isVoiceChannel(ch.type) ? "🔊 음성 채널" : "# 텍스트 채널",
}));
```

### 목록 UI 패턴

목록(핫타임, 제외, 배율 등)은 **카드 형태 컨테이너**로 통일합니다.

```tsx
{/* 목록 컨테이너 */}
<div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
  {/* 헤더 */}
  <div className="p-6 border-b border-white/10">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
        <Icon icon="solar:fire-bold" className="w-5 h-5 text-white" />
      </div>
      <div>
        <h3 className="font-semibold text-white">목록 제목</h3>
        <p className="text-sm text-white/50">목록 설명</p>
      </div>
    </div>
  </div>

  {/* 목록 내용 */}
  <div className="p-6">
    {items.length > 0 ? (
      <div className="space-y-3">
        {items.map((item) => (
          <div className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 transition-all">
            {/* 아이템 내용 */}
          </div>
        ))}
      </div>
    ) : (
      {/* 빈 상태 */}
      <div className="py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
          <Icon icon="solar:fire-linear" className="w-8 h-8 text-white/20" />
        </div>
        <p className="text-white/50">항목이 없습니다.</p>
        <p className="text-sm text-white/30 mt-1">안내 메시지</p>
      </div>
    )}
  </div>
</div>
```

### 아이템 정보 표시

Badge를 사용하여 유형, 배율 등을 표시합니다.

```tsx
<div className="flex items-center gap-2 flex-wrap">
  <span className="font-medium text-white">주요 정보</span>
  <Badge variant="secondary" className="bg-white/10 text-white/70">유형</Badge>
  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">x2.0</Badge>
</div>
<div className="flex items-center gap-1 text-sm text-white/40 mt-1">
  <Icon icon="solar:clock-circle-linear" className="h-3 w-3" />
  부가 정보
</div>
```

### 드롭다운이 있는 카드

**드롭다운(Select, MultiSelect)이 포함된 카드에는 `overflow-hidden`을 사용하지 마세요.**

드롭다운이 카드 영역을 벗어나면 잘리는 문제가 발생합니다.

```tsx
// ❌ 잘못된 패턴 - 드롭다운이 잘림
<div className="rounded-2xl border border-white/10 overflow-hidden">
  <MultiSelect ... />
</div>

// ✅ 올바른 패턴 - overflow-hidden 제거
<div className="rounded-2xl border border-white/10">
  <MultiSelect ... />
</div>
```

**규칙:**
- 드롭다운이 있는 폼 카드: `overflow-hidden` 사용 금지
- 드롭다운이 없는 목록 카드: `overflow-hidden` 사용 가능

### 참고 페이지

- XP 규칙: `/xp/rules` - 핫타임, 제외, 배율 목록 UI
- 화폐 규칙: `/currency/rules` - 동일한 패턴 적용

### Select 초기값 표시 (DB에서 불러온 값)

**DB에서 불러온 설정값을 Select에 표시할 때는 데이터 로딩 상태를 고려해야 합니다.**

설정(settings)이 먼저 로드되고, 옵션 목록(channels, roles 등)이 나중에 로드되면 Select에 값이 표시되지 않는 문제가 발생합니다.

```tsx
// ❌ 잘못된 패턴 - 옵션 목록 로드 전에는 선택된 값이 안 보임
<Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
  <SelectTrigger>
    <SelectValue placeholder="채널 선택..." />
  </SelectTrigger>
  <SelectContent>
    {channels?.map((ch) => (
      <SelectItem key={ch.id} value={ch.id}># {ch.name}</SelectItem>
    ))}
  </SelectContent>
</Select>

// ✅ 올바른 패턴 - 선택된 값을 직접 렌더링
<Select value={selectedChannelId || undefined} onValueChange={setSelectedChannelId}>
  <SelectTrigger>
    <SelectValue placeholder="채널 선택...">
      {selectedChannelId && channels?.find(c => c.id === selectedChannelId)
        ? `# ${channels.find(c => c.id === selectedChannelId)?.name}`
        : selectedChannelId
          ? "로딩 중..."
          : "채널 선택..."}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {channels?.map((ch) => (
      <SelectItem key={ch.id} value={ch.id}># {ch.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**핵심 포인트:**
1. `value={selectedId || undefined}` - 빈 문자열 대신 undefined 사용
2. `<SelectValue>` 안에 children으로 직접 표시할 내용 작성
3. 옵션 목록 로드 전이면 "로딩 중..." 표시
4. 값이 없으면 placeholder 텍스트 표시

## 동적 화폐 이름 규칙

화폐 이름(토피/루비)은 서버별로 커스텀 가능하므로, **하드코딩하지 않고 설정에서 가져와야 합니다.**

### 사용법

```tsx
import { useCurrencySettings } from "@/hooks/queries";

export default function MyPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { data: settings } = useCurrencySettings(guildId);

  const topyName = settings?.topyName ?? "토피";
  const rubyName = settings?.rubyName ?? "루비";

  return (
    <div>
      <p>{topyName} 잔액: 1,000</p>
      <p>{rubyName} 잔액: 5</p>
    </div>
  );
}
```

### 적용 위치

- 페이지 헤더/설명
- 테이블 헤더
- 필터 드롭다운 옵션
- 안내 문구
- 빈 상태 메시지
- Badge 텍스트

### 참고 페이지

- `/currency/wallets` - 지갑 페이지
- `/currency/transactions` - 거래 기록 페이지

## /내정보 프로필 카드 (최후순위)

**`/내정보` 명령어의 프로필 카드 UI는 모든 기능 구현 후 가장 마지막에 작업합니다.**

### 이유

- 프로필 카드에는 여러 시스템의 정보가 표시됨 (XP, 화폐, 출석, 경고 등)
- 각 기능이 완성되어야 프로필 카드에 연동 가능
- 디자인 작업은 데이터가 준비된 후에 진행하는 것이 효율적

### 현재 상태

`apps/bot/src/commands/my-info.ts`에 TODO로 표시:
```typescript
attendanceCount: 0, // TODO: 출석 시스템 구현 후 연동
clanName: undefined, // TODO: 클랜 시스템 구현 후 연동
warningCount: 0, // TODO: 경고 시스템 구현 후 연동
```

### 작업 시점

모든 화폐 시스템(04~15) 구현 완료 후:
1. 프로필 카드 디자인 리뉴얼
2. 각 시스템 데이터 연동
3. 캔버스 렌더링 최적화
