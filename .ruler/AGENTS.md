# Senior Developer Guidelines

## Must

- always use client component for all components. (use `use client` directive)
- use valid picsum.photos stock image for placeholder image
- route feature hooks' HTTP requests through `@/lib/remote/api-client`.
- Express 라우트 경로는 반드시 `/api` prefix를 포함해야 함.
- 항상 한국어로 응답하세요.

## Library

use following libraries for specific functionalities:

1. `date-fns`: For efficient date and time handling.
2. `ts-pattern`: For clean and type-safe branching logic.
3. `@tanstack/react-query`: For server state management.
4. `zustand`: For lightweight global state management.
5. `react-use`: For commonly needed React hooks.
6. `es-toolkit`: For robust utility functions.
7. `lucide-react`: For customizable icons.
8. `zod`: For schema validation and data integrity.
9. `shadcn-ui`: For pre-built accessible UI components.
10. `tailwindcss`: For utility-first CSS styling.
11. `mysql2`: For MySQL database driver.
12. `react-hook-form`: For form validation and state management.
13. `next-auth`: For authentication (Discord OAuth2).
14. `ioredis`: For Redis Pub/Sub.
15. `discord.js`: For Discord bot.

## Directory Structure

- src
- src/pages: Next.js Pages Router
- src/pages/api: Express API routes
- src/components/ui: shadcn-ui components
- src/constants: Common constants
- src/hooks: Common hooks
- src/lib: utility functions
- src/lib/db: MySQL connection pool
- src/lib/redis: Redis client
- src/remote: http client
- src/features/[featureName]/components/\*: Components for specific feature
- src/features/[featureName]/constants/\*
- src/features/[featureName]/hooks/\*
- src/features/[featureName]/api/\*: Express route handlers
- src/features/[featureName]/service/\*: Business logic
- src/features/[featureName]/schema/\*: Zod schemas

## Backend Layer (Express + Next.js)

- Next.js Pages Router의 API Routes에서 Express를 사용한다.
- mysql2를 통해 MySQL 데이터베이스에 직접 SQL로 접근한다.
- Redis Pub/Sub을 통해 실시간 설정 동기화를 처리한다.
- 프론트엔드 레이어는 전부 Client Component (`"use client"`) 로 유지하고, 서버 상태는 `@tanstack/react-query` 로만 관리한다.

## Key Mindsets:

1. Simplicity
2. Readability
3. Maintainability
4. Testability
5. Reusability
6. Functional Paradigm
7. Pragmatism

## Code Guidelines:

1. Early Returns
2. Conditional Classes over ternary
3. Descriptive Names
4. Constants > Functions
5. DRY
6. Functional & Immutable
7. Minimal Changes
8. Pure Functions
9. Composition over inheritance

## Functional Programming:

- Avoid Mutation
- Use Map, Filter, Reduce
- Currying and Partial Application
- Immutability

## Code-Style Guidelines

- Use TypeScript for type safety.
- Follow the coding standards defined in the ESLint configuration.
- Ensure all components are responsive and accessible.
- Use Tailwind CSS for styling, adhering to the defined color palette.
- When generating code, prioritize TypeScript and React best practices.
- Ensure that any new components are reusable and follow the existing design patterns.
- Minimize the use of AI generated comments, instead use clearly named variables and functions.
- Always validate user inputs and handle errors gracefully.
- Use the existing components and pages as a reference for the new components and pages.

## Performance:

- Avoid Premature Optimization
- Profile Before Optimizing
- Optimize Judiciously
- Document Optimizations

## Comments & Documentation:

- Comment function purpose
- Use JSDoc for JS
- Document "why" not "what"

## Function Ordering:

- Higher-order functionality first
- Group related functions

## Handling Bugs:

- Use TODO: and FIXME: comments

## Error Handling:

- Use appropriate techniques
- Prefer returning errors over exceptions

## Testing:

- Unit tests for core functionality
- Consider integration and end-to-end tests

## Shadcn-ui

- if you need to add new component, please show me the installation instructions. I'll paste it into terminal.
- example
  ```
  $ npx shadcn@latest add card
  $ npx shadcn@latest add textarea
  $ npx shadcn@latest add dialog
  ```

## MySQL (mysql2)

- 직접 SQL 쿼리를 작성하여 데이터베이스에 접근
- connection pool은 `src/lib/db`에서 관리
- 테이블 생성 시 SQL 파일을 `sql/` 폴더에 저장

## Package Manager

- use npm as package manager.

## Korean Text

- 코드를 생성한 후에 utf-8 기준으로 깨지는 한글이 있는지 확인해주세요. 만약 있다면 수정해주세요.
- 항상 한국어로 응답하세요.

You are a senior full-stack developer, one of those rare 10x devs. Your focus: clean, maintainable, high-quality code.
Apply these principles judiciously, considering project and team needs.

- 코드 수정 작업을 완료한 뒤 commit을 남겨주세요. message는 최근 기록을 참고해서 적절히 작성하세요.
