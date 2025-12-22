# 화폐 시스템 (Currency System) 구현 계획

## 개요

XP 시스템과 동일한 아키텍처 패턴으로 토피/루비 화폐 시스템을 구현합니다.

### 결정사항
- **구현 범위**: 핵심 기능 먼저 (지갑, 활동 보상, 상점)
- **화폐 구조**: 별도 테이블 분리 (topy_wallets, ruby_wallets)
- **로그 수준**: 모든 활동 기록 (채팅/음성 보상 포함)
- **XP 연동**: 독립 운영 (별도 쿨다운/설정)
- **채널 구분**: 카테고리(normal/music/afk/premium)로 음성 보상 차등

---

## 1단계: 데이터베이스 스키마

### 생성할 SQL 파일

| 파일명 | 설명 |
|--------|------|
| `sql/10_currency_settings.sql` | 길드별 화폐 설정 |
| `sql/11_topy_wallets.sql` | 토피 지갑 |
| `sql/12_ruby_wallets.sql` | 루비 지갑 |
| `sql/13_currency_transactions.sql` | 거래 기록 |
| `sql/14_currency_hot_times.sql` | 핫타임 설정 |
| `sql/15_currency_exclusions.sql` | 제외 채널/역할 |
| `sql/16_currency_multipliers.sql` | 배율 설정 |
| `sql/17_currency_channel_categories.sql` | 채널 카테고리 설정 |

### 핵심 테이블 스키마

```sql
-- 10_currency_settings.sql
CREATE TABLE currency_settings (
    guild_id VARCHAR(20) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,

    -- 텍스트 보상 설정
    text_earn_enabled TINYINT(1) NOT NULL DEFAULT 1,
    text_earn_min INT NOT NULL DEFAULT 1,
    text_earn_max INT NOT NULL DEFAULT 1,
    text_min_length INT NOT NULL DEFAULT 15,
    text_cooldown_seconds INT NOT NULL DEFAULT 30,
    text_max_per_cooldown INT NOT NULL DEFAULT 1,
    text_daily_limit INT NOT NULL DEFAULT 300,

    -- 음성 보상 설정
    voice_earn_enabled TINYINT(1) NOT NULL DEFAULT 1,
    voice_earn_min INT NOT NULL DEFAULT 1,
    voice_earn_max INT NOT NULL DEFAULT 1,
    voice_cooldown_seconds INT NOT NULL DEFAULT 60,
    voice_daily_limit INT NOT NULL DEFAULT 2000,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (guild_id),
    CONSTRAINT fk_currency_settings_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11_topy_wallets.sql
CREATE TABLE topy_wallets (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0,
    total_earned BIGINT NOT NULL DEFAULT 0,
    daily_earned INT NOT NULL DEFAULT 0,
    daily_reset_at DATETIME NOT NULL,
    last_text_earn_at DATETIME NULL,
    text_count_in_cooldown INT NOT NULL DEFAULT 0,
    last_voice_earn_at DATETIME NULL,
    voice_count_in_cooldown INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (guild_id, user_id),
    KEY idx_topy_balance (guild_id, balance DESC),
    CONSTRAINT fk_topy_wallets_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12_ruby_wallets.sql
CREATE TABLE ruby_wallets (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0,
    total_earned BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (guild_id, user_id),
    KEY idx_ruby_balance (guild_id, balance DESC),
    CONSTRAINT fk_ruby_wallets_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13_currency_transactions.sql
CREATE TABLE currency_transactions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    currency_type ENUM('topy', 'ruby') NOT NULL,
    transaction_type ENUM('earn_text', 'earn_voice', 'earn_attendance', 'transfer_in', 'transfer_out', 'shop_purchase', 'tax', 'admin_add', 'admin_remove') NOT NULL,
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    fee BIGINT NOT NULL DEFAULT 0,
    related_user_id VARCHAR(20) NULL,
    description TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_tx_user (guild_id, user_id, created_at DESC),
    KEY idx_tx_type (guild_id, transaction_type, created_at DESC),
    CONSTRAINT fk_currency_tx_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14_currency_hot_times.sql
CREATE TABLE currency_hot_times (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    type ENUM('text', 'voice', 'all') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.50,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_currency_hot_times_lookup (guild_id, type, enabled),
    CONSTRAINT fk_currency_hot_times_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15_currency_exclusions.sql
CREATE TABLE currency_exclusions (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    target_type ENUM('channel', 'role') NOT NULL,
    target_id VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uk_currency_exclusions (guild_id, target_type, target_id),
    KEY idx_currency_exclusions_lookup (guild_id, target_type),
    CONSTRAINT fk_currency_exclusions_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16_currency_multipliers.sql
CREATE TABLE currency_multipliers (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    target_type ENUM('channel', 'role') NOT NULL,
    target_id VARCHAR(20) NOT NULL,
    multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uk_currency_multipliers (guild_id, target_type, target_id),
    KEY idx_currency_multipliers_lookup (guild_id, target_type),
    CONSTRAINT fk_currency_multipliers_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17_currency_channel_categories.sql (음성 채널 타입별 보상 설정)
CREATE TABLE currency_channel_categories (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    category ENUM('normal', 'music', 'afk', 'premium') NOT NULL DEFAULT 'normal',
    -- normal: 일반 통화방 (1분당 1토피)
    -- music: 음감방 (1분당 0.1토피)
    -- afk: 일반 잠수방 (1분당 0.1토피)
    -- premium: 프리미엄 잠수방 (1분당 1토피)
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uk_currency_channel (guild_id, channel_id),
    KEY idx_currency_channel_guild (guild_id),
    CONSTRAINT fk_currency_channel_categories_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 2단계: Core 패키지 구조

### 디렉토리 구조

```
packages/core/src/currency-system/
├── domain/
│   ├── topy-wallet.ts          # TopyWallet 엔티티
│   ├── ruby-wallet.ts          # RubyWallet 엔티티
│   ├── currency-settings.ts    # CurrencySettings 엔티티
│   ├── currency-transaction.ts # Transaction 엔티티
│   └── index.ts
├── functions/
│   ├── check-cooldown.ts       # XP와 동일한 패턴
│   ├── check-hot-time.ts       # 핫타임 배율 검사
│   ├── generate-random-currency.ts
│   ├── apply-multiplier.ts
│   ├── calculate-fee.ts        # 수수료 계산
│   ├── check-daily-limit.ts    # 일일 상한 검사
│   └── index.ts
├── service/
│   ├── currency.service.ts     # 핵심 비즈니스 로직
│   └── index.ts
├── port/
│   ├── topy-wallet-repository.port.ts
│   ├── ruby-wallet-repository.port.ts
│   ├── currency-settings-repository.port.ts
│   ├── transaction-repository.port.ts
│   └── index.ts
├── errors/
│   └── index.ts
└── index.ts
```

### 핵심 도메인 엔티티

```typescript
// domain/topy-wallet.ts
export interface TopyWallet {
  guildId: string;
  userId: string;
  balance: bigint;
  totalEarned: bigint;
  dailyEarned: number;
  dailyResetAt: Date;
  lastTextEarnAt: Date | null;
  textCountInCooldown: number;
  lastVoiceEarnAt: Date | null;
  voiceCountInCooldown: number;
  createdAt: Date;
  updatedAt: Date;
}

// domain/currency-settings.ts
export interface CurrencySettings {
  guildId: string;
  enabled: boolean;

  // 텍스트 보상 설정
  textEarnEnabled: boolean;
  textEarnMin: number;        // 기본: 1
  textEarnMax: number;        // 기본: 1
  textMinLength: number;      // 기본: 15자
  textCooldownSeconds: number; // 기본: 30초
  textMaxPerCooldown: number;
  textDailyLimit: number;     // 기본: 300

  // 음성 보상 설정
  voiceEarnEnabled: boolean;
  voiceEarnMin: number;       // 기본: 1 (1분당)
  voiceEarnMax: number;
  voiceCooldownSeconds: number; // 기본: 60초
  voiceDailyLimit: number;    // 기본: 2000

  createdAt: Date;
  updatedAt: Date;
}
```

### 핵심 Service 메서드

```typescript
// service/currency.service.ts
export class CurrencyService {
  constructor(
    private readonly topyWalletRepo: TopyWalletRepositoryPort,
    private readonly rubyWalletRepo: RubyWalletRepositoryPort,
    private readonly settingsRepo: CurrencySettingsRepositoryPort,
    private readonly transactionRepo: TransactionRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  // 텍스트 채팅 보상
  async grantTextCurrency(
    guildId: string,
    userId: string,
    channelId: string,
    roleIds: string[],
    messageLength: number
  ): Promise<Result<CurrencyGrantResult, CurrencyError>>

  // 음성 채팅 보상
  async grantVoiceCurrency(
    guildId: string,
    userId: string,
    channelId: string,
    roleIds: string[]
  ): Promise<Result<CurrencyGrantResult, CurrencyError>>

  // 잔액 조회
  async getWallets(
    guildId: string,
    userId: string
  ): Promise<Result<{ topy: TopyWallet; ruby: RubyWallet }, CurrencyError>>

  // 이체 (수수료 포함)
  async transfer(
    guildId: string,
    fromUserId: string,
    toUserId: string,
    currencyType: 'topy' | 'ruby',
    amount: bigint
  ): Promise<Result<TransferResult, CurrencyError>>

  // 거래 기록 조회
  async getTransactions(
    guildId: string,
    userId: string,
    limit: number,
    offset?: number
  ): Promise<Result<CurrencyTransaction[], CurrencyError>>
}
```

---

## 3단계: Infra 패키지

### Repository 구현

```
packages/infra/src/database/repositories/
├── topy-wallet.repository.ts
├── ruby-wallet.repository.ts
├── currency-settings.repository.ts
├── currency-transaction.repository.ts
└── index.ts (export 추가)
```

### Container 등록

```typescript
// packages/infra/src/container/create-container.ts
// 추가할 내용:
const topyWalletRepo = new TopyWalletRepository(pool);
const rubyWalletRepo = new RubyWalletRepository(pool);
const currencySettingsRepo = new CurrencySettingsRepository(pool);
const transactionRepo = new TransactionRepository(pool);

const currencyService = new CurrencyService(
  topyWalletRepo,
  rubyWalletRepo,
  currencySettingsRepo,
  transactionRepo,
  clock
);

// Container 타입에 추가
export interface Container {
  xpService: XpService;
  currencyService: CurrencyService;  // 추가
}
```

---

## 4단계: Bot 앱

### Handler 구현

```
apps/bot/src/handlers/
└── currency.handler.ts
```

```typescript
// currency.handler.ts
export function createCurrencyHandler(container: Container, client: Client) {
  return {
    // 텍스트 메시지 보상 처리
    async handleTextMessage(
      guildId: string,
      userId: string,
      channelId: string,
      roleIds: string[],
      messageLength: number
    ): Promise<void>

    // 음성 보상 처리 (1분 주기)
    async handleVoiceReward(
      guildId: string,
      userId: string,
      channelId: string,
      roleIds: string[]
    ): Promise<void>
  };
}
```

### 이벤트 리스너 수정

```typescript
// apps/bot/src/index.ts
// messageCreate 이벤트에 화폐 보상 추가
client.on('messageCreate', async (message) => {
  // XP 처리 (기존)
  await xpHandler.handleTextMessage(...);

  // 화폐 처리 (추가)
  await currencyHandler.handleTextMessage(
    message.guildId,
    message.author.id,
    message.channelId,
    [...message.member.roles.cache.keys()],
    message.content.length
  );
});

// 음성 보상 타이머 추가
setInterval(async () => {
  // 음성 채널 유저들에게 화폐 보상
  for (const [guildId, voiceUsers] of voiceUserMap) {
    for (const [userId, data] of voiceUsers) {
      await currencyHandler.handleVoiceReward(guildId, userId, data.channelId, data.roleIds);
    }
  }
}, 60000); // 1분 주기
```

---

## 5단계: Web API 라우트

### API 구조

```
apps/web/src/app/api/guilds/[guildId]/currency/
├── settings/route.ts       # GET/PUT 설정
├── wallets/route.ts        # GET 지갑 목록
├── wallets/[userId]/route.ts  # GET 특정 유저 지갑
├── transactions/route.ts   # GET 거래 기록
├── hot-times/route.ts      # GET/POST/DELETE 핫타임
├── exclusions/route.ts     # GET/POST/DELETE 제외 설정
└── multipliers/route.ts    # GET/POST/DELETE 배율
```

---

## 구현 순서 (단계별)

### Phase 1: 기반 구축 (필수)
1. SQL 스키마 생성 (10~17번 파일들)
2. Core 패키지: domain/, errors/ 구현
3. Core 패키지: port/ 인터페이스 정의
4. Infra: Repository 구현
5. Infra: Container에 등록

### Phase 2: 활동 보상 기능
1. Core: functions/ 순수함수 구현
2. Core: service/ CurrencyService 구현 (grantTextCurrency, grantVoiceCurrency)
3. Bot: currency.handler.ts 구현
4. Bot: 이벤트 리스너에 화폐 보상 연동

### Phase 3: 조회/이체 기능
1. Core: service/ 조회/이체 메서드 추가
2. Web: API 라우트 구현

### Phase 4: 웹 대시보드 (나중에)
1. 화폐 설정 페이지
2. 거래 기록 조회 페이지

---

## 수정할 핵심 파일 목록

| 파일 경로 | 작업 |
|----------|------|
| `sql/10_currency_settings.sql` | 생성 |
| `sql/11_topy_wallets.sql` | 생성 |
| `sql/12_ruby_wallets.sql` | 생성 |
| `sql/13_currency_transactions.sql` | 생성 |
| `sql/14_currency_hot_times.sql` | 생성 |
| `sql/15_currency_exclusions.sql` | 생성 |
| `sql/16_currency_multipliers.sql` | 생성 |
| `sql/17_currency_channel_categories.sql` | 생성 |
| `packages/core/src/currency-system/**` | 생성 |
| `packages/infra/src/database/repositories/topy-wallet.repository.ts` | 생성 |
| `packages/infra/src/database/repositories/ruby-wallet.repository.ts` | 생성 |
| `packages/infra/src/database/repositories/currency-settings.repository.ts` | 생성 |
| `packages/infra/src/database/repositories/currency-transaction.repository.ts` | 생성 |
| `packages/infra/src/container/create-container.ts` | 수정 |
| `packages/infra/src/container/types.ts` | 수정 |
| `apps/bot/src/handlers/currency.handler.ts` | 생성 |
| `apps/bot/src/index.ts` | 수정 |
| `apps/web/src/app/api/guilds/[guildId]/currency/**` | 생성 |

---

## 참고: XP 시스템과 동일한 패턴

- Result<T, E> 패턴으로 에러 처리
- Port/Adapter 패턴으로 의존성 분리
- Factory 함수로 엔티티 생성 (createTopyWallet, createDefaultCurrencySettings)
- 순수함수로 계산 로직 분리 (checkCooldown, checkHotTime, calculateFee)
- ON DUPLICATE KEY UPDATE로 upsert 처리
