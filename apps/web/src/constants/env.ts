import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

const _clientEnv = clientEnvSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

if (!_clientEnv.success) {
  console.error('환경 변수 검증 실패:', _clientEnv.error.flatten().fieldErrors);
  throw new Error('환경 변수를 확인하세요.');
}

export const env: ClientEnv = _clientEnv.data;
