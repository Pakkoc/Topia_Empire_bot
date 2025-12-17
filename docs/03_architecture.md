# 코드베이스 아키텍처

## 설계 원칙

### 판단 기준
1. Presentation은 반드시 Business Logic과 분리
2. Pure Business Logic은 반드시 Persistence Layer와 분리
3. Internal Logic은 반드시 외부 연동 Contract, Caller와 분리
4. 하나의 모듈은 반드시 하나의 책임을 가짐

### 적용 패턴
- Layered Architecture
- SOLID Principles
- Ports & Adapters (Hexagonal)

---

## 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                         APPLICATIONS                                 │
│  ┌──────────────────────┐        ┌──────────────────────┐           │
│  │    apps/web          │        │    apps/bot          │           │
│  │   (Next.js 14)       │        │   (Discord.js)       │           │
│  │   - Presentation     │        │   - Presentation     │           │
│  │   - API Routes       │        │   - Commands/Events  │           │
│  └──────────┬───────────┘        └──────────┬───────────┘           │
└─────────────┼───────────────────────────────┼───────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CORE DOMAIN (packages/core)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ xp-system   │  │ welcome     │  │ moderation  │  │ logging     │ │
│  │ - domain    │  │ - domain    │  │ - domain    │  │ - domain    │ │
│  │ - service   │  │ - service   │  │ - service   │  │ - service   │ │
│  │ - port      │  │ - port      │  │ - port      │  │ - port      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE (packages/infra)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ database    │  │ cache       │  │ discord     │  │ event-bus   │ │
│  │ - mysql2    │  │ - redis     │  │ - api       │  │ - pub/sub   │ │
│  │ - pool      │  │ - client    │  │ - client    │  │ - emitter   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
topia_empire/
├── apps/
│   ├── web/                          # 웹 대시보드 (Next.js 14)
│   │   ├── src/
│   │   │   ├── pages/                # Pages Router
│   │   │   │   ├── api/              # API Routes (Express)
│   │   │   │   │   ├── auth/         # NextAuth endpoints
│   │   │   │   │   └── v1/           # REST API v1
│   │   │   │   │       ├── guilds/
│   │   │   │   │       └── xp/
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── [guildId]/
│   │   │   │   │       ├── xp.tsx
│   │   │   │   │       ├── welcome.tsx
│   │   │   │   │       └── moderation.tsx
│   │   │   │   ├── _app.tsx
│   │   │   │   └── index.tsx
│   │   │   │
│   │   │   ├── components/           # Presentation Layer
│   │   │   │   ├── ui/               # shadcn/ui
│   │   │   │   ├── layout/
│   │   │   │   └── features/
│   │   │   │       ├── xp/
│   │   │   │       ├── welcome/
│   │   │   │       └── moderation/
│   │   │   │
│   │   │   ├── hooks/                # React Hooks (TanStack Query)
│   │   │   │   ├── queries/
│   │   │   │   └── mutations/
│   │   │   │
│   │   │   └── lib/                  # Web-specific utilities
│   │   │       └── api-client.ts
│   │   │
│   │   ├── package.json
│   │   └── next.config.js
│   │
│   └── bot/                          # 디스코드 봇 (Discord.js)
│       ├── src/
│       │   ├── index.ts              # Bot entry point
│       │   │
│       │   ├── commands/             # Slash Commands (Presentation)
│       │   │   ├── xp/
│       │   │   │   ├── rank.ts
│       │   │   │   └── leaderboard.ts
│       │   │   └── admin/
│       │   │       └── settings.ts
│       │   │
│       │   ├── events/               # Discord Events (Presentation)
│       │   │   ├── message-create.ts
│       │   │   ├── voice-state-update.ts
│       │   │   └── guild-member-add.ts
│       │   │
│       │   ├── handlers/             # Event → Service 연결
│       │   │   ├── xp-handler.ts
│       │   │   └── welcome-handler.ts
│       │   │
│       │   └── lib/                  # Bot-specific utilities
│       │       ├── client.ts
│       │       └── command-loader.ts
│       │
│       └── package.json
│
├── packages/
│   ├── core/                         # Pure Business Logic
│   │   ├── src/
│   │   │   ├── xp-system/            # XP 시스템 모듈
│   │   │   │   ├── domain/           # Entities, Value Objects
│   │   │   │   │   ├── xp-settings.ts
│   │   │   │   │   ├── user-xp.ts
│   │   │   │   │   └── level.ts
│   │   │   │   │
│   │   │   │   ├── service/          # Use Cases (Business Logic)
│   │   │   │   │   ├── xp-service.ts
│   │   │   │   │   ├── level-service.ts
│   │   │   │   │   └── reward-service.ts
│   │   │   │   │
│   │   │   │   ├── port/             # Interfaces (Contracts)
│   │   │   │   │   ├── xp-repository.port.ts
│   │   │   │   │   └── xp-settings-repository.port.ts
│   │   │   │   │
│   │   │   │   └── index.ts          # Public exports
│   │   │   │
│   │   │   ├── welcome/              # 환영 시스템 모듈
│   │   │   │   ├── domain/
│   │   │   │   ├── service/
│   │   │   │   ├── port/
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── moderation/           # 모더레이션 모듈
│   │   │   │   ├── domain/
│   │   │   │   ├── service/
│   │   │   │   ├── port/
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── shared/               # 공유 도메인
│   │   │       ├── guild.ts
│   │   │       ├── user.ts
│   │   │       └── types.ts
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── infra/                        # Infrastructure Layer
│   │   ├── src/
│   │   │   ├── database/             # MySQL (mysql2)
│   │   │   │   ├── pool.ts           # Connection pool
│   │   │   │   ├── query-builder.ts  # SQL helpers
│   │   │   │   └── repositories/     # Port 구현체
│   │   │   │       ├── xp.repository.ts
│   │   │   │       ├── xp-settings.repository.ts
│   │   │   │       └── guild.repository.ts
│   │   │   │
│   │   │   ├── cache/                # Redis
│   │   │   │   ├── client.ts
│   │   │   │   └── cache-manager.ts
│   │   │   │
│   │   │   ├── event-bus/            # Redis Pub/Sub
│   │   │   │   ├── publisher.ts
│   │   │   │   ├── subscriber.ts
│   │   │   │   └── events.ts         # Event type definitions
│   │   │   │
│   │   │   ├── discord/              # Discord API client
│   │   │   │   └── api-client.ts
│   │   │   │
│   │   │   └── index.ts
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                       # 공유 타입/유틸리티
│       ├── src/
│       │   ├── types/
│       │   │   ├── api.ts            # API 응답 타입
│       │   │   └── events.ts         # Pub/Sub 이벤트 타입
│       │   │
│       │   ├── constants/
│       │   │   └── defaults.ts       # ProBot 기본값 등
│       │   │
│       │   ├── utils/
│       │   │   ├── validation.ts
│       │   │   └── format.ts
│       │   │
│       │   └── index.ts
│       │
│       └── package.json
│
├── sql/                              # SQL 스키마 및 마이그레이션
│   ├── schema/
│   │   ├── 001_guilds.sql
│   │   ├── 002_users.sql
│   │   ├── 003_xp_settings.sql
│   │   └── 004_user_xp.sql
│   └── seeds/
│       └── default_settings.sql
│
├── docs/
│   ├── 00_backgorund.md
│   ├── 01_xp_system.md
│   ├── 02_techstack.md
│   └── 03_architecture.md
│
├── package.json                      # Workspace root
├── turbo.json                        # Turborepo 설정 (선택)
└── tsconfig.base.json
```

---

## Top Level Building Blocks

### 1. Core Domain (packages/core)

**순수 비즈니스 로직** - 외부 의존성 없음

```typescript
// packages/core/src/xp-system/domain/user-xp.ts
export interface UserXp {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  lastMessageAt: Date | null;
  lastVoiceAt: Date | null;
}

// packages/core/src/xp-system/domain/xp-settings.ts
export interface XpSettings {
  guildId: string;
  textXp: number;
  textCooldown: number;
  voiceXp: number;
  voiceCooldown: number;
  excludedChannels: string[];
  excludedRoles: string[];
  levelUpChannel: string | null;
  rewards: LevelReward[];
}
```

```typescript
// packages/core/src/xp-system/port/xp-repository.port.ts
export interface XpRepositoryPort {
  findByUser(guildId: string, userId: string): Promise<UserXp | null>;
  save(userXp: UserXp): Promise<void>;
  getLeaderboard(guildId: string, limit: number): Promise<UserXp[]>;
}
```

```typescript
// packages/core/src/xp-system/service/xp-service.ts
export class XpService {
  constructor(
    private readonly xpRepo: XpRepositoryPort,
    private readonly settingsRepo: XpSettingsRepositoryPort
  ) {}

  async grantTextXp(guildId: string, userId: string): Promise<XpGrantResult> {
    const settings = await this.settingsRepo.findByGuild(guildId);
    if (!settings) return { granted: false, reason: 'no_settings' };

    const userXp = await this.xpRepo.findByUser(guildId, userId);

    // Pure business logic - cooldown check
    if (userXp?.lastMessageAt) {
      const elapsed = Date.now() - userXp.lastMessageAt.getTime();
      if (elapsed < settings.textCooldown * 1000) {
        return { granted: false, reason: 'cooldown' };
      }
    }

    // Calculate new XP and level
    const newXp = (userXp?.xp ?? 0) + settings.textXp;
    const newLevel = this.calculateLevel(newXp);
    const leveledUp = newLevel > (userXp?.level ?? 0);

    await this.xpRepo.save({
      guildId,
      userId,
      xp: newXp,
      level: newLevel,
      lastMessageAt: new Date(),
      lastVoiceAt: userXp?.lastVoiceAt ?? null,
    });

    return { granted: true, xp: newXp, level: newLevel, leveledUp };
  }

  private calculateLevel(xp: number): number {
    // Pure calculation - no external dependencies
    return Math.floor(Math.sqrt(xp / 100));
  }
}
```

---

### 2. Infrastructure (packages/infra)

**Port 인터페이스의 구현체** - 외부 시스템과 연결

```typescript
// packages/infra/src/database/repositories/xp.repository.ts
import { XpRepositoryPort, UserXp } from '@topia/core';
import { pool } from '../pool';

export class XpRepository implements XpRepositoryPort {
  async findByUser(guildId: string, userId: string): Promise<UserXp | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM user_xp WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );
    return rows[0] ? this.mapToEntity(rows[0]) : null;
  }

  async save(userXp: UserXp): Promise<void> {
    await pool.execute(
      `INSERT INTO user_xp (guild_id, user_id, xp, level, last_message_at, last_voice_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE xp = ?, level = ?, last_message_at = ?, last_voice_at = ?`,
      [/* params */]
    );
  }

  async getLeaderboard(guildId: string, limit: number): Promise<UserXp[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM user_xp WHERE guild_id = ? ORDER BY xp DESC LIMIT ?',
      [guildId, limit]
    );
    return rows.map(this.mapToEntity);
  }

  private mapToEntity(row: any): UserXp {
    return {
      guildId: row.guild_id,
      userId: row.user_id,
      xp: row.xp,
      level: row.level,
      lastMessageAt: row.last_message_at,
      lastVoiceAt: row.last_voice_at,
    };
  }
}
```

```typescript
// packages/infra/src/event-bus/publisher.ts
import { Redis } from 'ioredis';

export class EventPublisher {
  constructor(private readonly redis: Redis) {}

  async publish<T>(channel: string, event: T): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(event));
  }

  async publishSettingsChanged(guildId: string, module: string): Promise<void> {
    await this.publish('settings:changed', { guildId, module, timestamp: Date.now() });
  }
}
```

---

### 3. Web Application (apps/web)

**Presentation Layer** - API Routes + React Components

```typescript
// apps/web/src/pages/api/v1/guilds/[guildId]/xp/settings.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { XpSettingsService } from '@topia/core';
import { XpSettingsRepository, EventPublisher } from '@topia/infra';

const settingsRepo = new XpSettingsRepository();
const eventPublisher = new EventPublisher(redis);
const service = new XpSettingsService(settingsRepo);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { guildId } = req.query;

  if (req.method === 'GET') {
    const settings = await service.getSettings(guildId as string);
    return res.json(settings);
  }

  if (req.method === 'PUT') {
    await service.updateSettings(guildId as string, req.body);
    await eventPublisher.publishSettingsChanged(guildId as string, 'xp');
    return res.json({ success: true });
  }
}
```

```typescript
// apps/web/src/components/features/xp/XpSettingsForm.tsx
'use client';

import { useXpSettings, useUpdateXpSettings } from '@/hooks/queries/xp';

export function XpSettingsForm({ guildId }: { guildId: string }) {
  const { data: settings } = useXpSettings(guildId);
  const { mutate: updateSettings } = useUpdateXpSettings();

  // Pure presentation - no business logic
  return (
    <form onSubmit={(e) => { /* ... */ }}>
      <Input label="텍스트 XP" value={settings?.textXp} />
      <Input label="쿨타임 (초)" value={settings?.textCooldown} />
      {/* ... */}
    </form>
  );
}
```

---

### 4. Bot Application (apps/bot)

**Discord Event → Service 연결**

```typescript
// apps/bot/src/events/message-create.ts
import { Message } from 'discord.js';
import { xpHandler } from '../handlers/xp-handler';

export async function onMessageCreate(message: Message) {
  if (message.author.bot) return;

  // Presentation layer - delegates to handler
  await xpHandler.handleTextMessage(message.guildId!, message.author.id, message.channelId);
}
```

```typescript
// apps/bot/src/handlers/xp-handler.ts
import { XpService } from '@topia/core';
import { XpRepository, XpSettingsRepository, CacheManager } from '@topia/infra';

const xpRepo = new XpRepository();
const settingsRepo = new XpSettingsRepository();
const cache = new CacheManager();
const xpService = new XpService(xpRepo, settingsRepo);

export const xpHandler = {
  async handleTextMessage(guildId: string, userId: string, channelId: string) {
    // Check excluded channels from cache
    const settings = await cache.getOrFetch(`xp:settings:${guildId}`, () =>
      settingsRepo.findByGuild(guildId)
    );

    if (settings?.excludedChannels.includes(channelId)) return;

    const result = await xpService.grantTextXp(guildId, userId);

    if (result.leveledUp) {
      // Notify level up (presentation concern)
      await this.notifyLevelUp(guildId, userId, result.level);
    }
  },

  async notifyLevelUp(guildId: string, userId: string, level: number) {
    // Discord API interaction
  },
};
```

```typescript
// apps/bot/src/lib/settings-sync.ts
import { EventSubscriber } from '@topia/infra';

// Redis Pub/Sub으로 설정 변경 실시간 감지
export function startSettingsSync(cache: CacheManager) {
  const subscriber = new EventSubscriber(redis);

  subscriber.subscribe('settings:changed', async (event) => {
    // Invalidate cache when settings change from web dashboard
    await cache.invalidate(`${event.module}:settings:${event.guildId}`);
  });
}
```

---

## SOLID 원칙 적용

| 원칙 | 적용 |
|------|------|
| **S**ingle Responsibility | 각 모듈(xp-system, welcome 등)이 하나의 책임만 가짐 |
| **O**pen/Closed | Port 인터페이스로 확장에 열림, 수정에 닫힘 |
| **L**iskov Substitution | Repository 구현체 교체 가능 (테스트용 Mock 등) |
| **I**nterface Segregation | 작은 Port 인터페이스로 분리 |
| **D**ependency Inversion | Service가 Port(추상)에 의존, 구현체에 의존 X |

---

## 의존성 방향

```
apps/web ──┐
           ├──▶ packages/core ◀── packages/infra
apps/bot ──┘         │
                     ▼
              packages/shared
```

- **apps/** → **core**, **infra** 의존
- **core** → **shared**만 의존 (외부 의존성 없음)
- **infra** → **core**, **shared** 의존 (Port 구현)

---

## 새 기능 추가 시 체크리스트

1. `packages/core/src/{feature}/` 에 domain, service, port 생성
2. `packages/infra/src/database/repositories/` 에 Repository 구현
3. `apps/bot/src/handlers/` 에 Handler 추가
4. `apps/bot/src/events/` 또는 `commands/` 에서 Handler 연결
5. `apps/web/src/pages/api/v1/` 에 API Route 추가
6. `apps/web/src/components/features/` 에 UI 컴포넌트 추가
7. `sql/schema/` 에 테이블 스키마 추가
