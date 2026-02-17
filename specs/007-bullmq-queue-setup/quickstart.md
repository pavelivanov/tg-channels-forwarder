# Quickstart: BullMQ Queue Setup

**Feature**: 007-bullmq-queue-setup
**Date**: 2026-02-17

## Prerequisites

- Redis running on `localhost:6379` (already in docker-compose.yml)
- `REDIS_URL` environment variable set (already validated in worker config)

## 1. Install Dependencies

```bash
# Worker app — BullMQ core
pnpm --filter @aggregator/worker add bullmq

# Worker app — Dashboard (dev dependency)
pnpm --filter @aggregator/worker add -D @bull-board/api @bull-board/express @types/express

# Worker app — Express for dashboard mounting
pnpm --filter @aggregator/worker add express
```

**Note**: `bullmq` depends on `ioredis` (already installed). Approve `bullmq` in `pnpm-workspace.yaml` `onlyBuiltDependencies` if it has postinstall scripts.

## 2. Shared Types & Constants

```typescript
// packages/shared/src/queue/index.ts

export interface ForwardJob {
  messageId: number;
  sourceChannelId: number;
  text?: string;
  caption?: string;
  mediaType?: string;
  mediaFileId?: string;
  mediaGroupId?: string;
  mediaGroup?: ForwardJob[];
  timestamp: number;
}

export const QUEUE_NAME_FORWARD = 'message-forward';
export const QUEUE_NAME_FORWARD_DLQ = 'message-forward-dlq';
export const QUEUE_MAX_ATTEMPTS = 3;
export const QUEUE_BACKOFF_DELAY = 5000;
export const QUEUE_KEEP_COMPLETED = 1000;
export const QUEUE_KEEP_FAILED = 5000;
```

Re-export from `packages/shared/src/index.ts`:
```typescript
export * from './queue/index.ts';
```

## 3. Queue Producer

```typescript
// apps/worker/src/queue/queue-producer.ts
import { Queue } from 'bullmq';
import type pino from 'pino';
import type { ForwardJob } from '@aggregator/shared';

export class QueueProducer {
  private readonly logger: pino.Logger;

  constructor(
    private readonly queue: Queue,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'QueueProducer' });
  }

  async enqueueMessage(job: ForwardJob): Promise<void> {
    await this.queue.add('forward', job);
    this.logger.info(
      { messageId: job.messageId, sourceChannelId: job.sourceChannelId },
      'Job enqueued',
    );
  }
}
```

## 4. Queue Consumer

```typescript
// apps/worker/src/queue/queue-consumer.ts
import { Worker, Queue, Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type pino from 'pino';
import type { ForwardJob } from '@aggregator/shared';

export class QueueConsumer {
  private worker: Worker;
  private readonly logger: pino.Logger;

  constructor(
    queueName: string,
    private readonly dlq: Queue,
    connection: Redis,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'QueueConsumer' });

    this.worker = new Worker<ForwardJob>(
      queueName,
      async (job: Job<ForwardJob>) => {
        this.logger.info(
          { jobId: job.id, data: job.data },
          'Processing forward job',
        );
        // Actual forwarding logic comes in Spec 09
      },
      { connection },
    );

    this.worker.on('completed', (job: Job<ForwardJob>) => {
      this.logger.debug({ jobId: job.id }, 'Job completed');
    });

    this.worker.on('failed', async (job, error) => {
      if (!job) return;
      if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
        this.logger.warn(
          { jobId: job.id, error: error.message, attempts: job.attemptsMade },
          'Job exhausted retries, moving to DLQ',
        );
        await this.dlq.add('dead-letter', {
          originalJobId: job.id,
          originalQueue: job.queueName,
          data: job.data,
          failedReason: error.message,
          attemptsMade: job.attemptsMade,
          timestamp: Date.now(),
        });
      }
    });

    this.worker.on('error', (err) => {
      this.logger.error(err, 'Worker error');
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
```

## 5. Health Server Extension

```typescript
// apps/worker/src/health.ts (extend existing)
import type { Queue } from 'bullmq';

export function startHealthServer(
  port: number,
  logger: Logger,
  queue?: Queue,
  dlq?: Queue,
): Server {
  const server = createServer(async (_req, res) => {
    const response: Record<string, unknown> = { status: 'ok' };

    if (queue && dlq) {
      const counts = await queue.getJobCounts('active', 'waiting', 'failed', 'delayed');
      const dlqCounts = await dlq.getJobCounts('waiting');
      response.queue = { ...counts, dlq: dlqCounts.waiting };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  });

  server.listen(port, () => {
    logger.info({ port }, 'Health server listening');
  });

  return server;
}
```

## 6. Worker Bootstrap (main.ts)

```typescript
// apps/worker/src/main.ts
import pino from 'pino';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { loadConfig } from './config.ts';
import { startHealthServer } from './health.ts';
import { QueueConsumer } from './queue/queue-consumer.ts';
import {
  QUEUE_NAME_FORWARD,
  QUEUE_NAME_FORWARD_DLQ,
  QUEUE_MAX_ATTEMPTS,
  QUEUE_BACKOFF_DELAY,
  QUEUE_KEEP_COMPLETED,
  QUEUE_KEEP_FAILED,
} from '@aggregator/shared';

const config = loadConfig();
const logger = pino({ /* ... */ });

// BullMQ connection (maxRetriesPerRequest: null for Worker)
const connection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Queues
const forwardQueue = new Queue(QUEUE_NAME_FORWARD, {
  connection,
  defaultJobOptions: {
    attempts: QUEUE_MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: QUEUE_BACKOFF_DELAY },
    removeOnComplete: { count: QUEUE_KEEP_COMPLETED },
    removeOnFail: { count: QUEUE_KEEP_FAILED },
  },
});

const dlq = new Queue(QUEUE_NAME_FORWARD_DLQ, { connection });

// Consumer
const consumer = new QueueConsumer(QUEUE_NAME_FORWARD, dlq, connection, logger);

// Health
startHealthServer(config.WORKER_HEALTH_PORT, logger, forwardQueue, dlq);

logger.info('Worker started successfully');
```

## 7. Bull Board Dashboard (Optional)

```typescript
// apps/worker/src/dashboard.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Queue } from 'bullmq';

export function createDashboard(queues: Queue[]) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });

  return serverAdapter;
}
```

Mount in health server or a separate Express app at `/admin/queues`.
