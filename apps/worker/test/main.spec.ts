import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Worker startup', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('logs structured startup message via pino', async () => {
    const logMessages: Array<{ msg: string; level: number }> = [];

    vi.doMock('pino', () => {
      const createLogger = () => {
        const logger = {
          info: (objOrMsg: unknown, maybeMsg?: string) => {
            const msg =
              typeof objOrMsg === 'string' ? objOrMsg : (maybeMsg ?? '');
            logMessages.push({ msg, level: 30 });
          },
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
          child: () => logger,
        };
        return logger;
      };
      return { default: createLogger };
    });

    vi.doMock('ioredis', () => ({
      Redis: class MockRedis {
        options = {};
        status = 'ready';
        duplicate() { return new MockRedis(); }
        disconnect() { return Promise.resolve(); }
        quit() { return Promise.resolve(); }
      },
    }));

    vi.doMock('bullmq', () => ({
      Queue: class MockQueue {
        constructor() {}
        close() { return Promise.resolve(); }
        getJobCounts() { return Promise.resolve({}); }
        add() { return Promise.resolve(); }
        upsertJobScheduler() { return Promise.resolve(); }
      },
      Worker: class MockWorker {
        constructor() {}
        on() { return this; }
        close() { return Promise.resolve(); }
      },
    }));

    vi.doMock('../src/health.ts', () => ({
      startHealthServer: vi.fn(),
    }));

    vi.doMock('grammy', () => ({
      Api: class MockApi {
        config = { use: vi.fn() };
      },
    }));

    vi.doMock('@grammyjs/auto-retry', () => ({
      autoRetry: () => vi.fn(),
    }));

    vi.doMock('../src/config.ts', () => ({
      loadConfig: () => ({
        NODE_ENV: 'test',
        REDIS_URL: 'redis://localhost:6379',
        WORKER_HEALTH_PORT: 3001,
        TELEGRAM_API_ID: 12345,
        TELEGRAM_API_HASH: 'testhash',
        TELEGRAM_SESSION: 'testsession',
        DATABASE_URL: 'postgresql://localhost:5432/test',
        BOT_TOKEN: 'test-bot-token',
      }),
    }));

    vi.doMock('../src/prisma.ts', () => ({
      getPrisma: () => ({
        sourceChannel: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      }),
      disconnectPrisma: vi.fn().mockResolvedValue(undefined),
    }));

    vi.doMock('../src/queue/queue-consumer.ts', () => ({
      QueueConsumer: class MockQueueConsumer {
        constructor() {}
        close() { return Promise.resolve(); }
      },
    }));

    vi.doMock('../src/queue/queue-producer.ts', () => ({
      QueueProducer: class MockQueueProducer {
        constructor() {}
        enqueueMessage() { return Promise.resolve(); }
      },
    }));

    vi.doMock('../src/listener/listener.service.ts', () => ({
      ListenerService: class MockListenerService {
        constructor() {}
        start() { return Promise.resolve(); }
        stop() { return Promise.resolve(); }
        setAlbumGrouper() {}
        isConnected() { return true; }
      },
    }));

    vi.doMock('../src/listener/album-grouper.ts', () => ({
      AlbumGrouper: class MockAlbumGrouper {
        constructor() {}
        addMessage() {}
        flush() {}
        clear() {}
      },
    }));

    vi.doMock('../src/listener/channel-manager.ts', () => ({
      ChannelManager: class MockChannelManager {
        constructor() {}
        joinChannel() { return Promise.resolve({ telegramId: 1, title: 'test' }); }
        leaveChannel() { return Promise.resolve(); }
      },
    }));

    vi.doMock('../src/listener/channel-ops-consumer.ts', () => ({
      ChannelOpsConsumer: class MockChannelOpsConsumer {
        constructor() {}
        startWorker() {}
        close() { return Promise.resolve(); }
      },
    }));

    vi.doMock('../src/dedup/dedup.service.ts', () => ({
      DedupService: class MockDedupService {
        constructor() {}
        isDuplicate() { return Promise.resolve(false); }
        markAsForwarded() { return Promise.resolve(); }
      },
    }));

    vi.doMock('../src/forwarder/message-sender.ts', () => ({
      MessageSender: class MockMessageSender {
        constructor() {}
        send() { return Promise.resolve(); }
      },
    }));

    vi.doMock('../src/forwarder/rate-limiter.service.ts', () => ({
      RateLimiterService: class MockRateLimiterService {
        constructor() {}
        execute(_id: number, fn: () => Promise<unknown>) { return fn(); }
        close() { return Promise.resolve(); }
      },
    }));

    vi.doMock('../src/forwarder/forwarder.service.ts', () => ({
      ForwarderService: class MockForwarderService {
        constructor() {}
        forward() { return Promise.resolve(); }
      },
    }));

    vi.doMock('../src/cleanup/channel-cleanup.service.ts', () => ({
      ChannelCleanupService: class MockChannelCleanupService {
        constructor() {}
        execute() { return Promise.resolve({ deactivated: 0, failed: 0, total: 0 }); }
      },
    }));

    vi.doMock('../src/cleanup/channel-cleanup.consumer.ts', () => ({
      ChannelCleanupConsumer: class MockChannelCleanupConsumer {
        constructor() {}
        startWorker() {}
        close() { return Promise.resolve(); }
      },
    }));

    await import('../src/main.ts');

    expect(logMessages.length).toBeGreaterThanOrEqual(1);
    const startupMsg = logMessages.find(
      (m) =>
        m.msg.toLowerCase().includes('worker start'),
    );
    expect(startupMsg).toBeDefined();
  });
});
