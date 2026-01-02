# 봇 일회성 내전 설정 기획서

## 1. 개요

### 1.1 현재 상태
| 기능 | 웹 | 봇 |
|------|----|----|
| 카테고리 생성/저장 | ✅ | ❌ |
| 커스텀 순위보상 설정 | ✅ (카테고리) | ❌ |
| 2팀 승자독식 설정 | ✅ (카테고리) | ❌ |
| 팀당 인원 제한 | ✅ (카테고리) | ❌ |
| 직접 입력 내전 생성 | ❌ | ✅ (제목, 팀 수만) |

### 1.2 요청 사항
봇에서 "직접 입력"으로 내전 생성 시, 웹의 카테고리 설정처럼 **일회성으로** 다음을 설정 가능하게:
- 커스텀 순위보상 (순위별 % 지정)
- 2팀 승자독식 (1등 100%, 2등 0%)
- 팀당 인원 제한

> **저장하지 않음**: 카테고리로 저장되지 않고, 해당 내전에만 적용

---

## 2. UI/UX 설계

### 2.1 현재 흐름
```
[패널] → [직접 입력 버튼] → [모달: 제목, 팀 수] → [내전 생성]
```

### 2.2 제안 흐름

#### Option A: 모달 확장 (권장)
```
[패널] → [직접 입력 버튼] → [모달: 제목, 팀 수, 옵션들] → [내전 생성]
```

**장점**: 한 번에 모든 설정 가능
**단점**: Discord 모달 제한 (최대 5개 Text Input)

#### Option B: 다단계 설정
```
[패널] → [직접 입력 버튼] → [모달: 제목, 팀 수]
    → [고급 설정 버튼] → [Select Menu: 옵션 선택]
    → [추가 모달/Select] → [내전 생성]
```

**장점**: 더 많은 옵션 설정 가능
**단점**: 복잡한 UX

### 2.3 권장: Option A (모달 확장)

Discord 모달은 최대 5개의 Text Input을 지원합니다.

**확장된 모달 구성**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| 제목 | Text | ✅ | 내전 제목 |
| 팀 수 | Text | ✅ | 2~100 |
| 팀당 인원 | Text | ❌ | 비워두면 무제한 |
| 순위보상 | Text | ❌ | 예: `50,30,15,5` 또는 `승자독식` |
| 참가비 | Text | ❌ | 비워두면 전역 설정 사용 |

**순위보상 입력 형식** (비율 기반, 자동 정규화):
- `승자독식` 또는 `winner` → 1등 100%, 나머지 0%
- `1,1` → 1등 50%, 2등 50%
- `3,2,1` → 1등 50%, 2등 33.3%, 3등 16.7%
- `12,98` → 1등 10.9%, 2등 89.1% (자동 정규화)
- `50,30,15,5` → 1등 50%, 2등 30%, 3등 15%, 4등 5%
- 비워두기 → 전역 설정 사용

> 합계가 100%가 아니어도 됩니다. 입력한 비율대로 자동 정규화됩니다.

---

## 3. 기술 설계

### 3.1 Game 엔티티 확장

현재 `Game` 엔티티는 `categoryId`를 통해 카테고리 설정을 참조합니다.
일회성 설정을 위해 Game에 직접 저장할 필드 추가:

```typescript
// packages/core/src/currency-system/domain/game.ts
interface Game {
  // 기존 필드들...
  categoryId: number | null;

  // 새로운 필드들 (일회성 설정)
  customRankRewards: RankRewards | null;     // 커스텀 순위보상
  customWinnerTakesAll: boolean | null;      // 승자독식 (null = 기본값 사용)
  customEntryFee: bigint | null;             // 커스텀 참가비 (null = 전역 설정)
}
```

### 3.2 보상 정산 로직 수정

**현재 우선순위**:
1. 카테고리 설정 (winnerTakesAll, rankRewards)
2. 전역 설정

**변경된 우선순위**:
1. **Game 일회성 설정** (customRankRewards, customWinnerTakesAll)
2. 카테고리 설정 (winnerTakesAll, rankRewards)
3. 전역 설정

```typescript
// game.service.ts - finishGame 수정
async finishGame(guildId: string, gameId: bigint, results: RankResult[]) {
  const game = await this.gameRepo.findById(gameId);
  const category = game.categoryId
    ? await this.categoryRepo.findById(game.categoryId)
    : null;

  let rankPercents: Record<number, number>;

  // 1. 일회성 설정 체크 (최우선)
  if (game.customRankRewards) {
    rankPercents = this.normalizeRankPercents(game.customRankRewards, results);
  }
  // 2. 일회성 승자독식 체크
  else if (game.customWinnerTakesAll === true && game.teamCount === 2) {
    rankPercents = { 1: 100, 2: 0 };
  }
  // 3. 카테고리 설정 체크
  else if (category?.rankRewards) {
    rankPercents = this.normalizeRankPercents(category.rankRewards, results);
  }
  else if (game.teamCount === 2 && (category?.winnerTakesAll ?? true)) {
    rankPercents = { 1: 100, 2: 0 };
  }
  // 4. 전역 설정
  else {
    const settings = await this.getSettings(guildId);
    rankPercents = this.normalizeRankPercents(settings.rankRewards, results);
  }

  // ... 보상 지급 로직
}
```

### 3.3 DB 스키마 변경

```sql
-- Prisma 마이그레이션
ALTER TABLE "Game" ADD COLUMN "customRankRewards" JSONB;
ALTER TABLE "Game" ADD COLUMN "customWinnerTakesAll" BOOLEAN;
ALTER TABLE "Game" ADD COLUMN "customEntryFee" BIGINT;
```

### 3.4 봇 핸들러 수정

**파일**: `apps/bot/src/handlers/game-panel.ts`

#### 모달 수정
```typescript
// handleGamePanelCreate 함수 수정
const modal = new ModalBuilder()
  .setCustomId('game_create_modal')
  .setTitle('내전 생성')
  .addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('title')
        .setLabel('내전 제목')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('teamCount')
        .setLabel('팀 수 (2~100)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('예: 4')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('maxPlayers')
        .setLabel('팀당 인원 (선택사항, 비워두면 무제한)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('예: 5')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('rewards')
        .setLabel('순위보상 (선택사항)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('예: 50,30,15,5 또는 승자독식')
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('entryFee')
        .setLabel('참가비 (선택사항, 비워두면 기본값)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('예: 1000')
    )
  );
```

#### 모달 제출 처리
```typescript
// handleGameCreateModal 함수 수정
async function handleGameCreateModal(interaction: ModalSubmitInteraction) {
  const title = interaction.fields.getTextInputValue('title');
  const teamCount = parseInt(interaction.fields.getTextInputValue('teamCount'));
  const maxPlayersRaw = interaction.fields.getTextInputValue('maxPlayers');
  const rewardsRaw = interaction.fields.getTextInputValue('rewards');
  const entryFeeRaw = interaction.fields.getTextInputValue('entryFee');

  // 순위보상 파싱
  let customRankRewards: Record<number, number> | null = null;
  let customWinnerTakesAll: boolean | null = null;

  if (rewardsRaw.trim()) {
    const rewards = rewardsRaw.trim().toLowerCase();
    if (rewards === '승자독식' || rewards === 'winner') {
      customWinnerTakesAll = true;
    } else {
      // "3,2,1" 또는 "50,30,15,5" 형식 파싱 (비율 기반, 자동 정규화)
      const parts = rewards.split(',').map(s => parseInt(s.trim()));
      if (parts.some(isNaN) || parts.length === 0) {
        return interaction.reply({
          content: '❌ 순위보상 형식이 올바르지 않습니다.\n예: `3,2,1` 또는 `승자독식`',
          ephemeral: true
        });
      }

      if (parts.some(p => p < 0)) {
        return interaction.reply({
          content: '❌ 순위보상은 0 이상이어야 합니다.',
          ephemeral: true
        });
      }

      // 비율로 저장 (finishGame에서 자동 정규화됨)
      customRankRewards = {};
      parts.forEach((ratio, index) => {
        customRankRewards![index + 1] = ratio;
      });
    }
  }

  // 팀당 인원 파싱
  const maxPlayersPerTeam = maxPlayersRaw.trim()
    ? parseInt(maxPlayersRaw)
    : null;

  // 참가비 파싱
  const customEntryFee = entryFeeRaw.trim()
    ? BigInt(entryFeeRaw.trim())
    : null;

  // 게임 생성
  const result = await gameService.createGame({
    guildId,
    channelId,
    title,
    teamCount,
    maxPlayersPerTeam,
    customRankRewards,
    customWinnerTakesAll,
    customEntryFee,
    createdBy: userId,
  });
}
```

---

## 4. 내전 정보 표시

### 4.1 생성된 내전 Embed에 설정 표시

일회성 설정이 적용된 경우 Embed에 명시:

```typescript
const embed = new EmbedBuilder()
  .setTitle(`🎮 ${title}`)
  .setDescription(`팀 수: ${teamCount}팀`)
  .addFields([
    { name: '참가비', value: `${entryFee} 토피`, inline: true },
    { name: '팀당 인원', value: maxPlayersPerTeam ? `${maxPlayersPerTeam}명` : '무제한', inline: true },
  ]);

// 커스텀 보상 표시
if (customWinnerTakesAll) {
  embed.addFields({ name: '보상 방식', value: '🏆 승자 독식 (1등 100%)', inline: false });
} else if (customRankRewards) {
  const rewardText = Object.entries(customRankRewards)
    .map(([rank, percent]) => `${rank}등: ${percent}%`)
    .join(' | ');
  embed.addFields({ name: '순위보상', value: rewardText, inline: false });
}
```

---

## 5. 구현 체크리스트

### 5.1 Core 패키지
- [ ] `Game` 도메인에 `customRankRewards`, `customWinnerTakesAll`, `customEntryFee` 필드 추가
- [ ] `CreateGameDto`에 새 필드 추가
- [ ] Prisma 스키마 수정 및 마이그레이션
- [ ] `gameService.createGame()` 수정
- [ ] `gameService.finishGame()` 보상 로직 수정 (우선순위 적용)

### 5.2 Bot 패키지
- [ ] `handleGamePanelCreate()` 모달 확장 (5개 필드)
- [ ] `handleGameCreateModal()` 새 필드 파싱 로직 추가
- [ ] 입력 검증 로직 추가 (순위보상 합계 100% 등)
- [ ] 내전 Embed에 커스텀 설정 표시

### 5.3 테스트 케이스
- [ ] 승자독식 입력 → 1등 100%, 2등 0% 적용 확인
- [ ] 비율 입력 `1,1` → 50%, 50% 정규화 확인
- [ ] 비율 입력 `12,98` → 10.9%, 89.1% 정규화 확인
- [ ] 비율 입력 `3,2,1` → 50%, 33.3%, 16.7% 정규화 확인
- [ ] 빈 입력 → 전역 설정 사용 확인
- [ ] 카테고리 선택 내전 → 기존 로직 유지 확인
- [ ] 음수 입력 → 에러 반환 확인

---

## 6. 예상 사용 시나리오

### 시나리오 1: 2팀 승자독식 내전
```
사용자: [직접 입력] 클릭
모달 입력:
  - 제목: "롤 1:1 대결"
  - 팀 수: 2
  - 순위보상: 승자독식

결과: 1등 100%, 2등 0% 적용
```

### 시나리오 2: 커스텀 4팀 내전 (비율 입력)
```
사용자: [직접 입력] 클릭
모달 입력:
  - 제목: "발로란트 토너먼트"
  - 팀 수: 4
  - 팀당 인원: 5
  - 순위보상: 6,3,2,1
  - 참가비: 500

결과: 팀당 5명, 1등 50%, 2등 25%, 3등 16.7%, 4등 8.3%, 참가비 500 토피
(6+3+2+1=12 → 각각 6/12, 3/12, 2/12, 1/12로 정규화)
```

### 시나리오 3: 기본 설정 내전
```
사용자: [직접 입력] 클릭
모달 입력:
  - 제목: "일반 내전"
  - 팀 수: 4
  (나머지 비워둠)

결과: 전역 설정의 참가비, 순위보상 적용
```

---

## 7. 대안 고려

### 7.1 별도 명령어 추가
슬래시 명령어 `/내전생성`을 추가하여 더 세밀한 옵션 제공 가능
- 장점: 자동완성, 더 많은 옵션
- 단점: 패널과 별도의 진입점, 복잡성 증가

### 7.2 고급 설정 버튼 추가
모달 제출 후 "고급 설정" 버튼 표시하여 추가 옵션 설정
- 장점: 기본 흐름 유지, 필요시만 사용
- 단점: 다단계 UX

**결론**: Discord 모달 5개 필드 제한 내에서 충분히 구현 가능하므로 **Option A (모달 확장)** 권장

---

## 8. 결론

- **구현 난이도**: 중간
- **예상 작업량**: Core 수정 + Bot 수정 + 마이그레이션
- **영향 범위**: 기존 카테고리 기반 내전은 영향 없음
- **호환성**: 기존 시스템과 완전 호환

사용자가 승인하면 구현을 시작하겠습니다.
