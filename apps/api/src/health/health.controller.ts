import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '../auth/public.decorator.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import { BotService } from '../bot/bot.service.ts';
import { REDIS_CLIENT } from '../redis/redis.module.ts';
import type { Redis } from 'ioredis';
import {
  HEALTH_CHECK_TIMEOUT_MS,
  computeHealthStatus,
  type HealthResponse,
  type ServiceCheck,
  type ConnectionCheck,
} from '@aggregator/shared';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), ms),
    ),
  ]);
}

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly botService: BotService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const uptime = process.uptime() * 1000;
    const checks: Record<string, ServiceCheck | ConnectionCheck> = {};

    try {
      // Postgres check
      const pgStart = Date.now();
      try {
        await withTimeout(
          this.prisma.$queryRaw`SELECT 1`,
          HEALTH_CHECK_TIMEOUT_MS,
        );
        checks['postgres'] = { status: 'up', latencyMs: Date.now() - pgStart };
      } catch {
        checks['postgres'] = { status: 'down', latencyMs: Date.now() - pgStart };
      }

      // Redis check
      const redisStart = Date.now();
      try {
        await withTimeout(this.redis.ping(), HEALTH_CHECK_TIMEOUT_MS);
        checks['redis'] = { status: 'up', latencyMs: Date.now() - redisStart };
      } catch {
        checks['redis'] = { status: 'down', latencyMs: Date.now() - redisStart };
      }

      // Bot check
      const botHealthy = await this.botService.isHealthy();
      checks['bot'] = { status: botHealthy ? 'connected' : 'disconnected' };

      const status = computeHealthStatus({
        postgres: checks['postgres'] as ServiceCheck,
        redis: checks['redis'] as ServiceCheck,
        bot: checks['bot'] as ConnectionCheck,
      });

      return { status, uptime, checks };
    } catch {
      return {
        status: 'unhealthy',
        uptime,
        checks,
      };
    }
  }
}
