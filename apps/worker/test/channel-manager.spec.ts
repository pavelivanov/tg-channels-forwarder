import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type pino from 'pino';
import type { TelegramClient } from 'telegram';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import { ChannelManager, RateLimitError } from '../src/listener/channel-manager.ts';

function createMockLogger(): pino.Logger {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => logger),
  } as unknown as pino.Logger;
  return logger;
}

function createMockClient() {
  return {
    invoke: vi.fn().mockResolvedValue({
      chats: [{ id: BigInt(12345), title: 'Test Channel' }],
    }),
  };
}

function createMockPrisma() {
  return {
    sourceChannel: {
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
}

describe('ChannelManager', () => {
  let logger: pino.Logger;
  let mockClient: ReturnType<typeof createMockClient>;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.useFakeTimers();
    logger = createMockLogger();
    mockClient = createMockClient();
    mockPrisma = createMockPrisma();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('joinChannel()', () => {
    it('joins channel and returns ChannelInfo with telegramId and title', async () => {
      const manager = new ChannelManager(
        () => mockClient as unknown as TelegramClient,
        mockPrisma as unknown as PrismaClient,
        logger,
      );

      const resultPromise = manager.joinChannel('channel-uuid-1', 'testchannel');
      // Advance past the random delay (max 5s)
      await vi.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;

      expect(result.telegramId).toBe(12345);
      expect(result.title).toBe('Test Channel');
      expect(mockClient.invoke).toHaveBeenCalledOnce();
    });

    it('updates SourceChannel record on success', async () => {
      const manager = new ChannelManager(
        () => mockClient as unknown as TelegramClient,
        mockPrisma as unknown as PrismaClient,
        logger,
      );

      const resultPromise = manager.joinChannel('channel-uuid-1', 'testchannel');
      await vi.advanceTimersByTimeAsync(5000);
      await resultPromise;

      expect(mockPrisma.sourceChannel.update).toHaveBeenCalledWith({
        where: { id: 'channel-uuid-1' },
        data: { telegramId: BigInt(12345), title: 'Test Channel', isActive: true },
      });
    });

    it('deletes pending record and rethrows on join failure', async () => {
      mockClient.invoke.mockRejectedValue(new Error('CHANNEL_PRIVATE'));
      const manager = new ChannelManager(
        () => mockClient as unknown as TelegramClient,
        mockPrisma as unknown as PrismaClient,
        logger,
      );

      const resultPromise = manager.joinChannel('channel-uuid-1', 'testchannel');
      // Prevent unhandled rejection warning during timer advance
      resultPromise.catch(() => {});
      await vi.advanceTimersByTimeAsync(5000);
      await expect(resultPromise).rejects.toThrow('CHANNEL_PRIVATE');

      expect(mockPrisma.sourceChannel.delete).toHaveBeenCalledWith({
        where: { id: 'channel-uuid-1' },
      });
    });

    it('rate limiter blocks 6th join within 1 hour', async () => {
      const manager = new ChannelManager(
        () => mockClient as unknown as TelegramClient,
        mockPrisma as unknown as PrismaClient,
        logger,
      );

      // Perform 5 joins
      for (let i = 0; i < 5; i++) {
        const p = manager.joinChannel(`uuid-${String(i)}`, `channel-${String(i)}`);
        await vi.advanceTimersByTimeAsync(5000);
        await p;
      }

      // 6th join should be rate limited
      await expect(manager.joinChannel('uuid-5', 'channel-5')).rejects.toThrow(RateLimitError);
    });

    it('rate limiter allows join after 1 hour expires', async () => {
      const manager = new ChannelManager(
        () => mockClient as unknown as TelegramClient,
        mockPrisma as unknown as PrismaClient,
        logger,
      );

      // Perform 5 joins
      for (let i = 0; i < 5; i++) {
        const p = manager.joinChannel(`uuid-${String(i)}`, `channel-${String(i)}`);
        await vi.advanceTimersByTimeAsync(5000);
        await p;
      }

      // Advance 1 hour
      await vi.advanceTimersByTimeAsync(3600_000);

      // 6th join should now succeed
      const p = manager.joinChannel('uuid-5', 'channel-5');
      await vi.advanceTimersByTimeAsync(5000);
      const result = await p;
      expect(result.telegramId).toBe(12345);
    });
  });

  describe('leaveChannel()', () => {
    it('calls MTProto LeaveChannel', async () => {
      mockClient.invoke.mockResolvedValue({});
      const manager = new ChannelManager(
        () => mockClient as unknown as TelegramClient,
        mockPrisma as unknown as PrismaClient,
        logger,
      );

      await manager.leaveChannel(12345);

      expect(mockClient.invoke).toHaveBeenCalledOnce();
    });
  });
});
