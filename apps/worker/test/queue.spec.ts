import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { ForwardJob } from '@aggregator/shared';
import { startHealthServer } from '../src/health.ts';
import {
  QUEUE_MAX_ATTEMPTS,
  QUEUE_BACKOFF_DELAY,
  QUEUE_KEEP_COMPLETED,
  QUEUE_KEEP_FAILED,
} from '@aggregator/shared';

const REDIS_URL = 'redis://localhost:6379';
const TEST_QUEUE_NAME = 'test-message-forward';
const TEST_DLQ_NAME = 'test-message-forward-dlq';

function makeJob(overrides: Partial<ForwardJob> = {}): ForwardJob {
  return {
    messageId: 1,
    sourceChannelId: -1001234567890,
    text: 'Hello world',
    timestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe('Queue Integration Tests', () => {
  let connection: Redis;
  let queue: Queue;
  let dlq: Queue;

  beforeAll(() => {
    connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  });

  afterAll(async () => {
    await connection.quit();
  });

  beforeEach(async () => {
    queue = new Queue(TEST_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: QUEUE_MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: QUEUE_BACKOFF_DELAY },
        removeOnComplete: { count: QUEUE_KEEP_COMPLETED },
        removeOnFail: { count: QUEUE_KEEP_FAILED },
      },
    });
    dlq = new Queue(TEST_DLQ_NAME, { connection });
    await queue.obliterate({ force: true });
    await dlq.obliterate({ force: true });
  });

  afterAll(async () => {
    if (queue) {
      await queue.obliterate({ force: true });
      await queue.close();
    }
    if (dlq) {
      await dlq.obliterate({ force: true });
      await dlq.close();
    }
  });

  describe('US1: Enqueue and Process', () => {
    it('enqueued job is consumed and reaches completed state', async () => {
      const job = makeJob();
      let resolveProcessed: () => void;
      const processed = new Promise<void>((r) => { resolveProcessed = r; });

      const worker = new Worker<ForwardJob>(
        TEST_QUEUE_NAME,
        async () => {
          // process successfully
        },
        { connection },
      );

      worker.on('completed', () => { resolveProcessed(); });

      await queue.add('forward', job);
      await processed;

      const counts = await queue.getJobCounts('completed');
      expect(counts.completed).toBeGreaterThanOrEqual(1);

      await worker.close();
    });

    it('job payload in the consumer matches ForwardJob fields', async () => {
      const job = makeJob({
        messageId: 42,
        sourceChannelId: -100999,
        text: 'test text',
        caption: 'test caption',
        mediaType: 'photo',
        mediaFileId: 'file123',
        timestamp: 1700000000,
      });

      let receivedData: ForwardJob | undefined;
      let resolveProcessed: () => void;
      const processed = new Promise<void>((r) => { resolveProcessed = r; });

      const worker = new Worker<ForwardJob>(
        TEST_QUEUE_NAME,
        async (j: Job<ForwardJob>) => {
          receivedData = j.data;
        },
        { connection },
      );

      worker.on('completed', () => { resolveProcessed(); });

      await queue.add('forward', job);
      await processed;

      expect(receivedData).toBeDefined();
      expect(receivedData!.messageId).toBe(42);
      expect(receivedData!.sourceChannelId).toBe(-100999);
      expect(receivedData!.text).toBe('test text');
      expect(receivedData!.caption).toBe('test caption');
      expect(receivedData!.mediaType).toBe('photo');
      expect(receivedData!.mediaFileId).toBe('file123');
      expect(receivedData!.timestamp).toBe(1700000000);

      await worker.close();
    });

    it('multiple jobs enqueued in rapid succession are all consumed', async () => {
      const jobCount = 10;
      let completedCount = 0;
      let resolveAll: () => void;
      const allDone = new Promise<void>((r) => { resolveAll = r; });

      const worker = new Worker<ForwardJob>(
        TEST_QUEUE_NAME,
        async () => {
          // process successfully
        },
        { connection },
      );

      worker.on('completed', () => {
        completedCount++;
        if (completedCount >= jobCount) resolveAll();
      });

      const jobs = Array.from({ length: jobCount }, (_, i) =>
        makeJob({ messageId: i + 1 }),
      );

      await Promise.all(jobs.map((j) => queue.add('forward', j)));
      await allDone;

      expect(completedCount).toBe(jobCount);

      await worker.close();
    });

    it('worker connecting to invalid Redis emits error event', async () => {
      let errorFired = false;
      let resolveError: () => void;
      const errorPromise = new Promise<void>((r) => { resolveError = r; });

      // Suppress unhandled rejections from the bad connection during this test
      const suppressUnhandled = (err: unknown) => {
        if (err instanceof Error && 'code' in err && err.code === 'ECONNREFUSED') return;
        if (err instanceof AggregateError) return;
      };
      process.on('unhandledRejection', suppressUnhandled);

      // Use connection options with invalid port — BullMQ creates its own connection
      const worker = new Worker<ForwardJob>(
        TEST_QUEUE_NAME,
        async () => {},
        {
          connection: {
            host: 'localhost',
            port: 59999,
            maxRetriesPerRequest: null,
            retryStrategy: () => null,
          },
        },
      );

      worker.on('error', () => {
        if (!errorFired) {
          errorFired = true;
          resolveError();
        }
      });

      await Promise.race([
        errorPromise,
        new Promise<void>((r) => setTimeout(r, 5000)),
      ]);

      expect(errorFired).toBe(true);

      await worker.close().catch(() => {});
      // Allow pending rejections to be caught before removing handler
      await new Promise((r) => setTimeout(r, 100));
      process.removeListener('unhandledRejection', suppressUnhandled);
    });
  });

  describe('US2: Retry and Dead Letter Queue', () => {
    it('a job that always throws is retried 3 times', async () => {
      // Use fast backoff for tests
      const fastQueue = new Queue(`${TEST_QUEUE_NAME}-retry`, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 100 },
        },
      });
      await fastQueue.obliterate({ force: true });

      let lastAttemptsMade = 0;
      let resolveFailed: () => void;
      const failedPromise = new Promise<void>((r) => { resolveFailed = r; });

      const worker = new Worker<ForwardJob>(
        `${TEST_QUEUE_NAME}-retry`,
        async () => {
          throw new Error('always fails');
        },
        { connection },
      );

      worker.on('failed', (job) => {
        if (!job) return;
        lastAttemptsMade = job.attemptsMade;
        if (job.attemptsMade >= 3) {
          resolveFailed();
        }
      });

      await fastQueue.add('forward', makeJob());
      await failedPromise;

      expect(lastAttemptsMade).toBe(3);

      await worker.close();
      await fastQueue.obliterate({ force: true });
      await fastQueue.close();
    });

    it('after 3 failures the job appears in the DLQ with correct fields', async () => {
      const fastQueue = new Queue(`${TEST_QUEUE_NAME}-dlq`, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 100 },
        },
      });
      await fastQueue.obliterate({ force: true });

      const testDlq = new Queue(`${TEST_DLQ_NAME}-test`, { connection });
      await testDlq.obliterate({ force: true });

      let resolveDlq: () => void;
      const dlqPromise = new Promise<void>((r) => { resolveDlq = r; });

      const worker = new Worker<ForwardJob>(
        `${TEST_QUEUE_NAME}-dlq`,
        async () => {
          throw new Error('permanent failure');
        },
        { connection },
      );

      worker.on('failed', async (job, error) => {
        if (!job) return;
        if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
          await testDlq.add('dead-letter', {
            originalJobId: job.id,
            originalQueue: job.queueName,
            data: job.data,
            failedReason: error.message,
            attemptsMade: job.attemptsMade,
            timestamp: Date.now(),
          });
          resolveDlq();
        }
      });

      const originalJob = makeJob({ messageId: 999 });
      await fastQueue.add('forward', originalJob);
      await dlqPromise;

      // Check DLQ has the job
      const dlqJobs = await testDlq.getJobs(['waiting']);
      expect(dlqJobs.length).toBe(1);

      const dlqJob = dlqJobs[0]!;
      expect(dlqJob.data.originalJobId).toBeDefined();
      expect(dlqJob.data.data.messageId).toBe(999);
      expect(dlqJob.data.failedReason).toBe('permanent failure');
      expect(dlqJob.data.attemptsMade).toBe(3);
      expect(dlqJob.data.originalQueue).toContain('message-forward');

      await worker.close();
      await fastQueue.obliterate({ force: true });
      await fastQueue.close();
      await testDlq.obliterate({ force: true });
      await testDlq.close();
    });

    it('exponential backoff is applied between retries', async () => {
      const fastQueue = new Queue(`${TEST_QUEUE_NAME}-backoff`, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 100 },
        },
      });
      await fastQueue.obliterate({ force: true });

      const failTimestamps: number[] = [];
      let resolveDone: () => void;
      const donePromise = new Promise<void>((r) => { resolveDone = r; });

      const worker = new Worker<ForwardJob>(
        `${TEST_QUEUE_NAME}-backoff`,
        async () => {
          throw new Error('backoff test');
        },
        { connection },
      );

      worker.on('failed', (job) => {
        if (!job) return;
        failTimestamps.push(Date.now());
        if (job.attemptsMade >= 3) resolveDone();
      });

      await fastQueue.add('forward', makeJob());
      await donePromise;

      // Should have 3 failure timestamps
      expect(failTimestamps.length).toBe(3);

      // Verify delays increase (exponential)
      if (failTimestamps.length >= 3) {
        const delay1 = failTimestamps[1]! - failTimestamps[0]!;
        const delay2 = failTimestamps[2]! - failTimestamps[1]!;
        // Second delay should be greater than first (exponential)
        expect(delay2).toBeGreaterThan(delay1);
      }

      await worker.close();
      await fastQueue.obliterate({ force: true });
      await fastQueue.close();
    });
  });

  describe('US3: Health Check Queue Statistics', () => {
    let healthServer: ReturnType<typeof startHealthServer>;
    let healthPort: number;
    let healthQueue: Queue;
    let healthDlq: Queue;
    let cleanupQueue: Queue;
    let originalNodeEnv: string | undefined;

    beforeEach(async () => {
      originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      healthQueue = new Queue(`${TEST_QUEUE_NAME}-health`, { connection });
      healthDlq = new Queue(`${TEST_DLQ_NAME}-health`, { connection });
      cleanupQueue = new Queue(`${TEST_QUEUE_NAME}-cleanup`, { connection });
      await healthQueue.obliterate({ force: true });
      await healthDlq.obliterate({ force: true });

      const mockLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, child: () => mockLogger } as never;

      // Use port 0 to get a random available port
      healthPort = 0;
      healthServer = startHealthServer(
        healthPort,
        mockLogger,
        {
          prisma: { $queryRaw: async () => [{ '?column?': 1 }] } as never,
          redis: { ping: async () => 'PONG' } as never,
          listener: { isConnected: () => true } as never,
          api: { getMe: async () => ({ id: 1 }) } as never,
          forwardQueue: healthQueue,
          dlq: healthDlq,
          cleanupQueue,
        },
      );
      await new Promise<void>((r) => healthServer.on('listening', r));
      const addr = healthServer.address();
      if (addr && typeof addr === 'object') healthPort = addr.port;
    });

    afterEach(async () => {
      process.env.NODE_ENV = originalNodeEnv;
      await new Promise<void>((resolve, reject) => {
        healthServer.close((err) => (err ? reject(err) : resolve()));
      });
      await healthQueue.obliterate({ force: true });
      await healthQueue.close();
      await healthDlq.obliterate({ force: true });
      await healthDlq.close();
      await cleanupQueue.close();
    });

    it('returns queue stats with all zeroes when queue is empty', async () => {
      const res = await fetch(`http://localhost:${healthPort}/`);
      const body = (await res.json()) as { status: string; checks: { queue: Record<string, number> } };

      expect(body.status).toBe('healthy');
      expect(body.checks.queue).toBeDefined();
      expect(body.checks.queue.active).toBe(0);
      expect(body.checks.queue.waiting).toBe(0);
      expect(body.checks.queue.failed).toBe(0);
      expect(body.checks.queue.dlq).toBe(0);
    });

    it('waiting count increases after enqueuing a job', async () => {
      await healthQueue.add('forward', makeJob());

      const res = await fetch(`http://localhost:${healthPort}/`);
      const body = (await res.json()) as { checks: { queue: Record<string, number> } };

      expect(body.checks.queue.waiting + body.checks.queue.active).toBeGreaterThanOrEqual(1);
    });
  });
});
