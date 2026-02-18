import { vi } from 'vitest';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import type { Job } from 'bullmq';
import type pino from 'pino';
import type { ForwardJob } from '@aggregator/shared';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

// ---------------------------------------------------------------------------
// Mock grammY Api
// ---------------------------------------------------------------------------

export interface MockApi {
  sendMessage: ReturnType<typeof vi.fn>;
  sendPhoto: ReturnType<typeof vi.fn>;
  sendVideo: ReturnType<typeof vi.fn>;
  sendDocument: ReturnType<typeof vi.fn>;
  sendAnimation: ReturnType<typeof vi.fn>;
  sendAudio: ReturnType<typeof vi.fn>;
  sendMediaGroup: ReturnType<typeof vi.fn>;
  config: { use: ReturnType<typeof vi.fn> };
}

export function createMockApi(): MockApi {
  return {
    sendMessage: vi.fn().mockResolvedValue({}),
    sendPhoto: vi.fn().mockResolvedValue({}),
    sendVideo: vi.fn().mockResolvedValue({}),
    sendDocument: vi.fn().mockResolvedValue({}),
    sendAnimation: vi.fn().mockResolvedValue({}),
    sendAudio: vi.fn().mockResolvedValue({}),
    sendMediaGroup: vi.fn().mockResolvedValue({}),
    config: { use: vi.fn() },
  };
}

// ---------------------------------------------------------------------------
// Mock pino logger
// ---------------------------------------------------------------------------

export function createMockLogger(): pino.Logger {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => logger),
    level: 'info',
  };
  return logger as unknown as pino.Logger;
}

// ---------------------------------------------------------------------------
// ForwardJob factory
// ---------------------------------------------------------------------------

export function createForwardJob(overrides: Partial<ForwardJob> = {}): ForwardJob {
  return {
    messageId: 1,
    sourceChannelId: 100,
    text: 'Hello integration test',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Prisma client for tests
// ---------------------------------------------------------------------------

const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://postgres:postgres@localhost:5432/aggregator';

let prismaInstance: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!prismaInstance) {
    const adapter = new PrismaPg({ connectionString: DATABASE_URL });
    prismaInstance = new PrismaClient({ adapter });
  }
  return prismaInstance;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = undefined;
  }
}

// ---------------------------------------------------------------------------
// Test fixture types and creation
// ---------------------------------------------------------------------------

export interface TestFixtureIds {
  userId: string;
  sourceChannelId: string;
  subscriptionListId: string;
  subscriptionListChannelId: string;
  destinationChannelId: number;
}

export async function createTestFixtures(
  prisma: PrismaClient,
  options?: {
    sourceChannelTelegramId?: number;
    destinationChannelId?: number;
    destinationUsername?: string;
  },
): Promise<TestFixtureIds> {
  const sourceChannelTelegramId = options?.sourceChannelTelegramId ?? 100;
  const destinationChannelId = options?.destinationChannelId ?? -1001234567890;

  const user = await prisma.user.create({
    data: {
      telegramId: BigInt(999000 + Math.floor(Math.random() * 100000)),
      firstName: 'E2E',
      username: `e2e_test_${Date.now()}`,
    },
  });

  const sourceChannel = await prisma.sourceChannel.create({
    data: {
      telegramId: BigInt(sourceChannelTelegramId),
      title: 'E2E Source Channel',
      username: `e2e_source_${Date.now()}`,
      isActive: true,
    },
  });

  const subscriptionList = await prisma.subscriptionList.create({
    data: {
      userId: user.id,
      name: 'E2E Test List',
      destinationChannelId: BigInt(destinationChannelId),
      destinationUsername: options?.destinationUsername ?? 'e2e_dest',
      isActive: true,
    },
  });

  const link = await prisma.subscriptionListChannel.create({
    data: {
      subscriptionListId: subscriptionList.id,
      sourceChannelId: sourceChannel.id,
    },
  });

  return {
    userId: user.id,
    sourceChannelId: sourceChannel.id,
    subscriptionListId: subscriptionList.id,
    subscriptionListChannelId: link.id,
    destinationChannelId,
  };
}

export async function cleanupFixtures(
  prisma: PrismaClient,
  ids: TestFixtureIds,
): Promise<void> {
  // Cascade should handle junction table, but be explicit
  await prisma.subscriptionListChannel
    .delete({ where: { id: ids.subscriptionListChannelId } })
    .catch(() => {});
  await prisma.subscriptionList
    .delete({ where: { id: ids.subscriptionListId } })
    .catch(() => {});
  await prisma.sourceChannel
    .delete({ where: { id: ids.sourceChannelId } })
    .catch(() => {});
  await prisma.user
    .delete({ where: { id: ids.userId } })
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Queue wait-for-completion utility
// ---------------------------------------------------------------------------

export interface JobResult {
  status: 'completed' | 'failed';
  jobId: string | undefined;
}

export function waitForJob(
  worker: Worker,
  timeout = 10_000,
): Promise<JobResult> {
  return new Promise<JobResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`waitForJob timed out after ${timeout}ms`));
    }, timeout);

    const onCompleted = (job: Job) => {
      clearTimeout(timer);
      worker.off('failed', onFailed);
      resolve({ status: 'completed', jobId: job.id });
    };

    const onFailed = (job: Job | undefined) => {
      if (!job) return;
      // Only resolve on final failure (all retries exhausted)
      if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
        clearTimeout(timer);
        worker.off('completed', onCompleted);
        resolve({ status: 'failed', jobId: job.id });
      }
    };

    worker.once('completed', onCompleted);
    worker.on('failed', onFailed);
  });
}

// ---------------------------------------------------------------------------
// Redis helpers
// ---------------------------------------------------------------------------

export function getTestRedis(): Redis {
  return new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
}

export async function flushDedupKeys(redis: Redis): Promise<void> {
  const keys = await redis.keys('dedup:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// ---------------------------------------------------------------------------
// Queue helpers
// ---------------------------------------------------------------------------

export async function createTestQueue(
  name: string,
  connection: Redis,
): Promise<Queue> {
  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 100 }, // fast retries for tests
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  });
  await queue.obliterate({ force: true });
  return queue;
}
