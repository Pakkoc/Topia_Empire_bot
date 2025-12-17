# 기술 스택

## 선정 기준

1. AI가 잘 구현할 수 있는 인기 있는 기술
2. 믿을만한 기업/커뮤니티에 의해 활발히 유지보수
3. Breaking Change가 적고 하위호환성이 보장되는 기술

---

## 확정 스택

| 영역 | 기술 | 선정 이유 |
|------|------|----------|
| 프론트엔드 | Next.js 14 (Pages Router) | App Router보다 안정적, AI 학습 데이터 풍부 |
| 스타일링 | Tailwind CSS + shadcn/ui | 인기 최상위, 복사형이라 breaking change 없음 |
| 백엔드 API | Express.js | 10년+ 역사, 하위호환성 최고, AI 친화적 |
| DB 드라이버 | mysql2 | 직접 SQL 작성, 가볍고 빠름, Promise 지원 |
| 데이터베이스 | MySQL (자체 서버) | 팀 결정, Rocky Linux 8.10 |
| 캐시/메시징 | Redis + ioredis | Pub/Sub 실시간 동기화, 10년+ 안정성 |
| 인증 | NextAuth.js v4 | Discord OAuth 내장, 문서 풍부, v5보다 안정적 |
| 상태 관리 | Zustand | 간단하고 안정적 |
| 서버 상태 | TanStack Query | 서버 상태 관리 표준 |
| 폼 처리 | React Hook Form + Zod | 인기 조합, breaking change 적음 |
| 디스코드 봇 | Discord.js | 사실상 표준, 압도적 인기 |

---

## 서버 환경

| 항목 | 사양 |
|------|------|
| OS | Rocky Linux 8.10 |
| DB | MySQL 8.x |
| 캐시 | Redis |

---

## 주의 사항

### NextAuth v4 vs v5
- v5 (Auth.js)는 아직 불안정, breaking change 진행 중
- **v4 사용 권장** - 문서/예제 더 풍부

### Next.js App Router vs Pages Router
- App Router는 아직 생태계 전환 중
- **Pages Router 사용** - AI 코드 생성에 더 정확함

### mysql2 사용
- ORM 없이 직접 SQL 작성
- 타입은 수동으로 정의
- 팀이 SQL에 익숙할 경우 더 효율적

---

## 패키지 버전 (권장)

```json
{
  "next": "14.x",
  "react": "18.x",
  "next-auth": "4.x",
  "mysql2": "3.x",
  "express": "4.x",
  "ioredis": "5.x",
  "discord.js": "14.x",
  "tailwindcss": "3.x",
  "zustand": "4.x",
  "@tanstack/react-query": "5.x",
  "react-hook-form": "7.x",
  "zod": "3.x"
}
```
