import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  WORKER_HEALTH_PORT: z.coerce.number().default(3001),
  TELEGRAM_API_ID: z.coerce.number(),
  TELEGRAM_API_HASH: z.string().min(1),
  TELEGRAM_SESSION: z.string().min(1),
  DATABASE_URL: z.string().url(),
  BOT_TOKEN: z.string().min(1),
});

export type WorkerConfig = z.infer<typeof envSchema>;

export function loadConfig(): WorkerConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(
      `Environment validation failed:\n${JSON.stringify(formatted, null, 2)}`,
    );
  }
  return result.data;
}
