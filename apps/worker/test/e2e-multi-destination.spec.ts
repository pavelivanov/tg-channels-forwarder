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
  waitForJob,
  getTestRedis,
  flushDedupKeys,
  createTestQueue,
  type MockApi,
  type TestFixtureIds,
} from './e2e-helpers.ts';

const QUEUE_NAME = 'test-e2e-multi-dest';
const DLQ_NAME = 'test-e2e-multi-dest-dlq';

const DEST_A = -1001111111111;
const DEST_B = -1002222222222;
const SOURCE_CHANNEL_ID = 200; // unique to avoid collision with other e2e tests

describe('E2E: Multi-Destination Forwarding', () => {
  let redis: Redis;
  let prisma: PrismaClient;
  let queue: Queue;
  let dlq: Queue;
  let consumer: QueueConsumer;
  let mockApi: MockApi;
  let dedupService: DedupService;
  let fixturesA: TestFixtureIds;
  let fixturesB: TestFixtureIds;

  beforeAll(async () => {
    redis = getTestRedis();
    prisma = getTestPrisma();

    // Create a shared source channel
    const sourceChannel = await prisma.sourceChannel.create({
      data: {
        telegramId: BigInt(SOURCE_CHANNEL_ID),
        title: 'E2E Multi-Dest Source',
        username: `e2e_multi_src_${Date.now()}`,
        isActive: true,
      },
    });

    // Create two users with two subscription lists pointing to different destinations
    const userA = await prisma.user.create({
      data: {
        telegramId: BigInt(888001 + Math.floor(Math.random() * 100000)),
        firstName: 'E2E-A',
        username: `e2e_a_${Date.now()}`,
      },
    });

    const listA = await prisma.subscriptionList.create({
      data: {
        userId: userA.id,
        name: 'List A',
        destinationChannelId: BigInt(DEST_A),
        destinationUsername: 'dest_a',
        isActive: true,
      },
    });

    const linkA = await prisma.subscriptionListChannel.create({
      data: {
        subscriptionListId: listA.id,
        sourceChannelId: sourceChannel.id,
      },
    });

    const userB = await prisma.user.create({
      data: {
        telegramId: BigInt(888002 + Math.floor(Math.random() * 100000)),
        firstName: 'E2E-B',
        username: `e2e_b_${Date.now()}`,
      },
    });

    const listB = await prisma.subscriptionList.create({
      data: {
        userId: userB.id,
        name: 'List B',
        destinationChannelId: BigInt(DEST_B),
        destinationUsername: 'dest_b',
        isActive: true,
      },
    });

    const linkB = await prisma.subscriptionListChannel.create({
      data: {
        subscriptionListId: listB.id,
        sourceChannelId: sourceChannel.id,
      },
    });

    fixturesA = {
      userId: userA.id,
      sourceChannelId: sourceChannel.id,
      subscriptionListId: listA.id,
      subscriptionListChannelId: linkA.id,
      destinationChannelId: DEST_A,
    };

    fixturesB = {
      userId: userB.id,
      sourceChannelId: sourceChannel.id,
      subscriptionListId: listB.id,
      subscriptionListChannelId: linkB.id,
      destinationChannelId: DEST_B,
    };
  });

  afterAll(async () => {
    // Clean up fixtures — junction entries first, then lists, channel, users
    await prisma.subscriptionListChannel
      .delete({ where: { id: fixturesA.subscriptionListChannelId } })
      .catch(() => {});
    await prisma.subscriptionListChannel
      .delete({ where: { id: fixturesB.subscriptionListChannelId } })
      .catch(() => {});
    await prisma.subscriptionList
      .delete({ where: { id: fixturesA.subscriptionListId } })
      .catch(() => {});
    await prisma.subscriptionList
      .delete({ where: { id: fixturesB.subscriptionListId } })
      .catch(() => {});
    await prisma.sourceChannel
      .delete({ where: { id: fixturesA.sourceChannelId } })
      .catch(() => {});
    await prisma.user
      .delete({ where: { id: fixturesA.userId } })
      .catch(() => {});
    await prisma.user
      .delete({ where: { id: fixturesB.userId } })
      .catch(() => {});
    await disconnectTestPrisma();
    await redis.quit();
  });

  beforeEach(async () => {
    await flushDedupKeys(redis);

    queue = await createTestQueue(QUEUE_NAME, redis);
    dlq = await createTestQueue(DLQ_NAME, redis);

    mockApi = createMockApi();
    const logger = createMockLogger();
    dedupService = new DedupService(redis, logger);
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

  it('forwards message to both destination channels', async () => {
    const job = createForwardJob({ sourceChannelId: SOURCE_CHANNEL_ID });
    const waiter = waitForJob(consumer['worker']);

    await queue.add('forward', job);
    await waiter;

    expect(mockApi.sendMessage).toHaveBeenCalledTimes(2);

    const calls = mockApi.sendMessage.mock.calls;
    const destinations = calls.map((c: unknown[]) => c[0] as number).sort();
    expect(destinations).toEqual([DEST_A, DEST_B].sort());
  });

  it('respects per-destination dedup independence', async () => {
    const job = createForwardJob({ sourceChannelId: SOURCE_CHANNEL_ID });

    // Pre-mark as forwarded for destination A only
    await dedupService.markAsForwarded(DEST_A, job.text!);

    const waiter = waitForJob(consumer['worker']);
    await queue.add('forward', job);
    await waiter;

    // Should only send to destination B (A is deduped)
    expect(mockApi.sendMessage).toHaveBeenCalledOnce();
    expect(mockApi.sendMessage).toHaveBeenCalledWith(
      DEST_B,
      job.text,
      expect.objectContaining({}),
    );
  });
});
