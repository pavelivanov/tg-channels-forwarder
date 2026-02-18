import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { DedupService } from '../src/dedup/dedup.service.ts';
import { ForwarderService } from '../src/forwarder/forwarder.service.ts';
import { MessageSender } from '../src/forwarder/message-sender.ts';
import { RateLimiterService } from '../src/forwarder/rate-limiter.service.ts';
import { QueueConsumer } from '../src/queue/queue-consumer.ts';
import {
  createMockApi,
  createMockLogger,
  createForwardJob,
  getTestPrisma,
  disconnectTestPrisma,
  createTestFixtures,
  cleanupFixtures,
  waitForJob,
  getTestRedis,
  flushDedupKeys,
  createTestQueue,
  type MockApi,
  type TestFixtureIds,
} from './e2e-helpers.ts';

const QUEUE_NAME = 'test-e2e-forward';
const DLQ_NAME = 'test-e2e-forward-dlq';

describe('E2E: Forward Pipeline', () => {
  let redis: Redis;
  let prisma: PrismaClient;
  let queue: Queue;
  let dlq: Queue;
  let consumer: QueueConsumer;
  let mockApi: MockApi;
  let fixtures: TestFixtureIds;

  beforeAll(async () => {
    redis = getTestRedis();
    prisma = getTestPrisma();
    fixtures = await createTestFixtures(prisma);
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, fixtures);
    await disconnectTestPrisma();
    await redis.quit();
  });

  beforeEach(async () => {
    await flushDedupKeys(redis);

    queue = await createTestQueue(QUEUE_NAME, redis);
    dlq = await createTestQueue(DLQ_NAME, redis);

    mockApi = createMockApi();
    const logger = createMockLogger();
    const dedupService = new DedupService(redis, logger);
    const rateLimiter = new RateLimiterService(logger);
    const messageSender = new MessageSender(
      mockApi as unknown as import('grammy').Api,
      logger,
    );
    const forwarderService = new ForwarderService(
      messageSender,
      prisma,
      dedupService,
      rateLimiter,
      logger,
    );
    consumer = new QueueConsumer(QUEUE_NAME, dlq, redis, forwarderService, logger);
  });

  afterEach(async () => {
    await consumer.close();
    await queue.obliterate({ force: true });
    await dlq.obliterate({ force: true });
    await queue.close();
    await dlq.close();
  });

  it('forwards text message to destination channel', async () => {
    const job = createForwardJob();
    const waiter = waitForJob(consumer['worker']);

    await queue.add('forward', job);
    const result = await waiter;

    expect(result.status).toBe('completed');
    expect(mockApi.sendMessage).toHaveBeenCalledOnce();
    expect(mockApi.sendMessage).toHaveBeenCalledWith(
      fixtures.destinationChannelId,
      job.text,
      expect.objectContaining({}),
    );
  });

  it('skips duplicate message based on Redis dedup key', async () => {
    // First forward — should succeed
    const job = createForwardJob();
    const waiter1 = waitForJob(consumer['worker']);
    await queue.add('forward', job);
    await waiter1;
    expect(mockApi.sendMessage).toHaveBeenCalledOnce();

    // Second forward — same text, same source → dedup should skip
    const waiter2 = waitForJob(consumer['worker']);
    await queue.add('forward', job);
    await waiter2;

    // sendMessage should still have been called only once
    expect(mockApi.sendMessage).toHaveBeenCalledOnce();
  });

  it('forwards new message after duplicate is rejected', async () => {
    // First forward
    const job1 = createForwardJob();
    const waiter1 = waitForJob(consumer['worker']);
    await queue.add('forward', job1);
    await waiter1;
    expect(mockApi.sendMessage).toHaveBeenCalledOnce();

    // Duplicate — skipped
    const waiter2 = waitForJob(consumer['worker']);
    await queue.add('forward', job1);
    await waiter2;
    expect(mockApi.sendMessage).toHaveBeenCalledOnce();

    // Different text — should forward
    const job2 = createForwardJob({ text: 'A completely different message', messageId: 2 });
    const waiter3 = waitForJob(consumer['worker']);
    await queue.add('forward', job2);
    await waiter3;

    expect(mockApi.sendMessage).toHaveBeenCalledTimes(2);
    expect(mockApi.sendMessage).toHaveBeenLastCalledWith(
      fixtures.destinationChannelId,
      job2.text,
      expect.objectContaining({}),
    );
  });

  it('sends failed job to DLQ after max retries', async () => {
    mockApi.sendMessage.mockRejectedValue(new Error('Bot API unavailable'));

    const job = createForwardJob({ text: 'This will fail', messageId: 99 });
    const waiter = waitForJob(consumer['worker']);

    await queue.add('forward', job);
    const result = await waiter;

    expect(result.status).toBe('failed');

    // Check DLQ has the failed job
    const dlqCounts = await dlq.getJobCounts('waiting');
    expect(dlqCounts.waiting).toBeGreaterThanOrEqual(1);

    const dlqJobs = await dlq.getJobs(['waiting']);
    const deadLetter = dlqJobs.find(
      (j) => j.data.data?.messageId === 99,
    );
    expect(deadLetter).toBeDefined();
    expect(deadLetter!.data.failedReason).toBe('Bot API unavailable');
  });
});
