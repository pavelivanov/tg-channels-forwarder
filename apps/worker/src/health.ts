import { createServer, type Server } from 'node:http';
import type { Logger } from 'pino';
import type { Queue } from 'bullmq';
import type { PrismaClient } from './generated/prisma/client.ts';
import type { Redis } from 'ioredis';
import type { ListenerService } from './listener/listener.service.ts';
import type { Api } from 'grammy';
import express from 'express';
import { Prisma } from './generated/prisma/client.ts';
import { createDashboard } from './dashboard.ts';
import {
  HEALTH_CHECK_TIMEOUT_MS,
  computeHealthStatus,
  type HealthResponse,
  type ServiceCheck,
  type ConnectionCheck,
  type QueueCheck,
} from '@aggregator/shared';

export interface HealthContext {
  prisma: PrismaClient;
  redis: Redis;
  listener: ListenerService;
  api: Api;
  forwardQueue: Queue;
  dlq: Queue;
  cleanupQueue: Queue;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), ms),
    ),
  ]);
}

export function startHealthServer(
  port: number,
  logger: Logger,
  ctx: HealthContext,
): Server {
  const healthHandler = async (): Promise<HealthResponse> => {
    const uptime = process.uptime() * 1000;
    const checks: Record<string, ServiceCheck | ConnectionCheck | QueueCheck> = {};

    try {
      // Postgres check
      const pgStart = Date.now();
      try {
        await withTimeout(
          ctx.prisma.$queryRaw(Prisma.sql`SELECT 1`),
          HEALTH_CHECK_TIMEOUT_MS,
        );
        checks['postgres'] = { status: 'up', latencyMs: Date.now() - pgStart };
      } catch {
        checks['postgres'] = { status: 'down', latencyMs: Date.now() - pgStart };
      }

      // Redis check
      const redisStart = Date.now();
      try {
        await withTimeout(ctx.redis.ping(), HEALTH_CHECK_TIMEOUT_MS);
        checks['redis'] = { status: 'up', latencyMs: Date.now() - redisStart };
      } catch {
        checks['redis'] = { status: 'down', latencyMs: Date.now() - redisStart };
      }

      // Userbot check
      checks['userbot'] = {
        status: ctx.listener.isConnected() ? 'connected' : 'disconnected',
      };

      // Bot check
      try {
        await withTimeout(ctx.api.getMe(), HEALTH_CHECK_TIMEOUT_MS);
        checks['bot'] = { status: 'connected' };
      } catch {
        checks['bot'] = { status: 'disconnected' };
      }

      // Queue check
      const queueCounts = await ctx.forwardQueue.getJobCounts(
        'active',
        'waiting',
        'failed',
      );
      const dlqCounts = await ctx.dlq.getJobCounts('waiting');
      checks['queue'] = {
        active: queueCounts.active ?? 0,
        waiting: queueCounts.waiting ?? 0,
        failed: queueCounts.failed ?? 0,
        dlq: dlqCounts.waiting ?? 0,
      };

      const status = computeHealthStatus({
        postgres: checks['postgres'] as ServiceCheck,
        redis: checks['redis'] as ServiceCheck,
        userbot: checks['userbot'] as ConnectionCheck,
        bot: checks['bot'] as ConnectionCheck,
        queue: checks['queue'] as QueueCheck,
      });

      return { status, uptime, checks };
    } catch {
      return { status: 'unhealthy', uptime, checks };
    }
  };

  if (process.env.NODE_ENV !== 'production' && ctx.forwardQueue && ctx.dlq) {
    const app = express();

    app.get('/', async (_req, res) => {
      const body = await healthHandler();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    });

    const dashboardQueues = [ctx.forwardQueue, ctx.dlq];
    if (ctx.cleanupQueue) dashboardQueues.push(ctx.cleanupQueue);
    const dashboard = createDashboard(dashboardQueues);
    app.use('/admin/queues', dashboard.getRouter());

    const server = app.listen(port, () => {
      logger.info({ port }, 'Health server listening (with dashboard)');
    });

    return server;
  }

  const server = createServer(async (_req, res) => {
    const body = await healthHandler();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });

  server.listen(port, () => {
    logger.info({ port }, 'Health server listening');
  });

  return server;
}
