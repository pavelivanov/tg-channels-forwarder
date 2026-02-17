# Quickstart: Redis Connection & Deduplication Service

**Feature Branch**: `006-redis-dedup-service`
**Date**: 2026-02-17

## Prerequisites

- Docker Compose running (provides Redis 7 on port 6379)
- Node.js 20 LTS + pnpm
- Existing monorepo with `apps/api`, `apps/worker`, `packages/shared`

## Setup

### 1. Install ioredis

```bash
# Add ioredis to api and worker apps
pnpm --filter @aggregator/api add ioredis
pnpm --filter @aggregator/api add -D @types/ioredis
pnpm --filter @aggregator/worker add ioredis
pnpm --filter @aggregator/worker add -D @types/ioredis

# Add to shared for types (if needed for type exports)
# Note: shared only gets pure functions, no ioredis dependency
```

### 2. Environment Variables

Already configured in both apps:
- `apps/api/src/env.schema.ts`: `REDIS_URL: z.string().url()` (required)
- `apps/worker/src/config.ts`: `REDIS_URL: z.string().url().default('redis://localhost:6379')`
- `docker-compose.yml`: `REDIS_URL: redis://redis:6379` for both services

### 3. Shared Package: Pure Functions

Create `packages/shared/src/dedup/index.ts`:

```typescript
import { createHash } from 'node:crypto';

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 10)
    .join(' ');
}

export function computeHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
```

Export from `packages/shared/src/index.ts`:
```typescript
export * from './constants/index.ts';
export * from './dedup/index.ts';
```

### 4. API: Redis Module (Global)

Create `apps/api/src/redis/redis.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService): Redis => {
        return new Redis(config.get<string>('REDIS_URL')!);
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
```

### 5. API: Redis Health Indicator

Create `apps/api/src/redis/redis.health.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module.ts';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.getStatus(key, true);
    } catch (error) {
      const result = this.getStatus(key, false, {
        message: (error as Error).message,
      });
      throw new HealthCheckError('Redis check failed', result);
    }
  }
}
```

### 6. Worker: DedupService

Create `apps/worker/src/dedup/dedup.service.ts`:

```typescript
import Redis from 'ioredis';
import pino from 'pino';
import { normalizeText, computeHash, DEDUP_TTL_HOURS } from '@aggregator/shared';

const DEDUP_TTL_SECONDS = DEDUP_TTL_HOURS * 3600;

export class DedupService {
  private readonly logger: pino.Logger;

  constructor(
    private readonly redis: Redis,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'DedupService' });
  }

  async isDuplicate(destinationChannelId: number, text: string): Promise<boolean> {
    const normalized = normalizeText(text);
    if (normalized === '') return false;

    const hash = computeHash(normalized);
    const key = `dedup:${String(destinationChannelId)}:${hash}`;

    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Redis unavailable during dedup check, failing open');
      return false;
    }
  }

  async markAsForwarded(destinationChannelId: number, text: string): Promise<void> {
    const normalized = normalizeText(text);
    if (normalized === '') return;

    const hash = computeHash(normalized);
    const key = `dedup:${String(destinationChannelId)}:${hash}`;

    try {
      await this.redis.set(key, '1', 'EX', DEDUP_TTL_SECONDS);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Redis unavailable during markAsForwarded, skipping');
    }
  }
}
```

## Running Tests

```bash
# Shared package unit tests (normalizeText, computeHash)
pnpm --filter @aggregator/shared exec vitest run

# Worker dedup integration tests (requires Redis)
pnpm --filter @aggregator/worker exec vitest run

# API health check integration tests (requires Redis + PostgreSQL)
pnpm --filter @aggregator/api exec vitest run test/health.spec.ts

# Full monorepo
pnpm turbo run build test lint
```

## Verification

```bash
# Verify Redis is running
docker compose exec redis redis-cli ping
# Expected: PONG

# Verify health endpoint includes Redis
curl http://localhost:3000/health | jq '.details.redis'
# Expected: { "status": "up" }
```
