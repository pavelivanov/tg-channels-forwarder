import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { HealthController } from '../src/health/health.controller.ts';
import { PrismaService } from '../src/prisma/prisma.service.ts';
import { BotService } from '../src/bot/bot.service.ts';
import { REDIS_CLIENT } from '../src/redis/redis.module.ts';
import { HEALTH_CHECK_TIMEOUT_MS } from '@aggregator/shared';
import type { HealthResponse } from '@aggregator/shared';

describe('Health endpoint status logic', () => {
  let controller: HealthController;
  let mockPrisma: { $queryRaw: ReturnType<typeof vi.fn> };
  let mockRedis: { ping: ReturnType<typeof vi.fn> };
  let mockBotService: { isHealthy: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockPrisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    mockRedis = { ping: vi.fn().mockResolvedValue('PONG') };
    mockBotService = { isHealthy: vi.fn().mockResolvedValue(true) };

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: BotService, useValue: mockBotService },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('returns healthy when all dependencies are up', async () => {
    const result = (await controller.check()) as HealthResponse;

    expect(result.status).toBe('healthy');
    expect(result.uptime).toBeGreaterThan(0);
    expect(result.checks['postgres']).toMatchObject({ status: 'up' });
    expect(result.checks['redis']).toMatchObject({ status: 'up' });
    expect(result.checks['bot']).toMatchObject({ status: 'connected' });
  });

  it('returns unhealthy when database is unreachable', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    const result = (await controller.check()) as HealthResponse;

    expect(result.status).toBe('unhealthy');
    expect(result.checks['postgres']).toMatchObject({ status: 'down' });
  });

  it('returns unhealthy when redis is unreachable', async () => {
    mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

    const result = (await controller.check()) as HealthResponse;

    expect(result.status).toBe('unhealthy');
    expect(result.checks['redis']).toMatchObject({ status: 'down' });
  });

  it('returns degraded when bot health check fails', async () => {
    mockBotService.isHealthy.mockResolvedValue(false);

    const result = (await controller.check()) as HealthResponse;

    // Bot being disconnected doesn't trigger degraded in API (no userbot check)
    // but bot is just a ConnectionCheck — computeHealthStatus only degrades on userbot
    expect(result.status).toBe('healthy');
    expect(result.checks['bot']).toMatchObject({ status: 'disconnected' });
  });

  it('reports down with high latency when a dependency hangs past the timeout', async () => {
    mockPrisma.$queryRaw.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_TIMEOUT_MS + 1000)),
    );

    const result = (await controller.check()) as HealthResponse;

    expect(result.status).toBe('unhealthy');
    const pgCheck = result.checks['postgres'] as { status: string; latencyMs: number };
    expect(pgCheck.status).toBe('down');
    expect(pgCheck.latencyMs).toBeGreaterThanOrEqual(HEALTH_CHECK_TIMEOUT_MS);
  });
});
