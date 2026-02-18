import { createServer, type Server } from 'node:http';
import type { Logger } from 'pino';
import type { Queue } from 'bullmq';
import express from 'express';
import { createDashboard } from './dashboard.ts';

export function startHealthServer(
  port: number,
  logger: Logger,
  queue?: Queue,
  dlq?: Queue,
  cleanupQueue?: Queue,
): Server {
  const healthHandler = async (): Promise<string> => {
    const response: Record<string, unknown> = { status: 'ok' };

    if (queue && dlq) {
      const counts = await queue.getJobCounts(
        'active',
        'waiting',
        'failed',
        'delayed',
      );
      const dlqCounts = await dlq.getJobCounts('waiting');
      response.queue = { ...counts, dlq: dlqCounts.waiting };
    }

    if (cleanupQueue) {
      const cleanupCounts = await cleanupQueue.getJobCounts(
        'active',
        'waiting',
        'failed',
        'delayed',
      );
      response.cleanup = cleanupCounts;
    }

    return JSON.stringify(response);
  };

  if (process.env.NODE_ENV !== 'production' && queue && dlq) {
    const app = express();

    app.get('/', async (_req, res) => {
      const body = await healthHandler();
      res.setHeader('Content-Type', 'application/json');
      res.end(body);
    });

    const dashboardQueues = [queue, dlq];
    if (cleanupQueue) dashboardQueues.push(cleanupQueue);
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
    res.end(body);
  });

  server.listen(port, () => {
    logger.info({ port }, 'Health server listening');
  });

  return server;
}
