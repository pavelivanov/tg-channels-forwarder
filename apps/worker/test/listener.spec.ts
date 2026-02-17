import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Api } from 'telegram';
import type { TelegramClient } from 'telegram';
import type { NewMessageEvent } from 'telegram/events';
import type pino from 'pino';
import type { ForwardJob } from '@aggregator/shared';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import type { QueueProducer } from '../src/queue/queue-producer.ts';
import { ListenerService } from '../src/listener/listener.service.ts';

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
    connect: vi.fn().mockResolvedValue(undefined),
    getMe: vi.fn().mockResolvedValue({ id: BigInt(1) }),
    addEventHandler: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockPrisma(channels: Array<{ telegramId: bigint }> = []) {
  return {
    sourceChannel: {
      findMany: vi.fn().mockResolvedValue(channels),
    },
  };
}

function createMockProducer() {
  return {
    enqueueMessage: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockMessage(channelId: bigint, text: string, overrides: Record<string, unknown> = {}): Api.Message {
  return {
    id: 1,
    peerId: new Api.PeerChannel({ channelId }),
    message: text,
    date: 1700000000,
    media: undefined,
    groupedId: undefined,
    photo: undefined,
    video: undefined,
    document: undefined,
    gif: undefined,
    audio: undefined,
    sticker: undefined,
    voice: undefined,
    videoNote: undefined,
    ...overrides,
  } as unknown as Api.Message;
}

describe('ListenerService', () => {
  let logger: pino.Logger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  describe('start()', () => {
    it('connects client, loads channels, and registers event handler', async () => {
      const mockClient = createMockClient();
      const mockPrisma = createMockPrisma([
        { telegramId: BigInt(100) },
        { telegramId: BigInt(200) },
      ]);
      const mockProducer = createMockProducer();

      const service = new ListenerService(
        { apiId: 1, apiHash: 'test', sessionString: 'valid-session' },
        logger,
        mockProducer as unknown as QueueProducer,
        mockPrisma as unknown as PrismaClient,
        mockClient as unknown as TelegramClient,
      );

      await service.start();

      expect(mockClient.connect).toHaveBeenCalledOnce();
      expect(mockClient.getMe).toHaveBeenCalledOnce();
      expect(mockPrisma.sourceChannel.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(mockClient.addEventHandler).toHaveBeenCalledOnce();
    });

    it('throws on connection failure (fail fast)', async () => {
      const mockClient = createMockClient();
      mockClient.connect.mockRejectedValue(new Error('AUTH_KEY_INVALID'));
      const mockPrisma = createMockPrisma();
      const mockProducer = createMockProducer();

      const service = new ListenerService(
        { apiId: 1, apiHash: 'test', sessionString: 'bad-session' },
        logger,
        mockProducer as unknown as QueueProducer,
        mockPrisma as unknown as PrismaClient,
        mockClient as unknown as TelegramClient,
      );

      await expect(service.start()).rejects.toThrow('AUTH_KEY_INVALID');
    });
  });

  describe('handleNewMessage()', () => {
    it('enqueues ForwardJob for subscribed channel message', async () => {
      const mockClient = createMockClient();
      const mockPrisma = createMockPrisma([
        { telegramId: BigInt(100) },
      ]);
      const mockProducer = createMockProducer();

      const service = new ListenerService(
        { apiId: 1, apiHash: 'test', sessionString: 'valid' },
        logger,
        mockProducer as unknown as QueueProducer,
        mockPrisma as unknown as PrismaClient,
        mockClient as unknown as TelegramClient,
      );

      await service.start();

      // Get the event handler that was registered
      const handlerCall = mockClient.addEventHandler.mock.calls[0];
      const handler = handlerCall[0] as (event: NewMessageEvent) => Promise<void>;

      const message = createMockMessage(BigInt(100), 'Hello from channel');
      await handler({ message } as unknown as NewMessageEvent);

      expect(mockProducer.enqueueMessage).toHaveBeenCalledOnce();
      const job: ForwardJob = mockProducer.enqueueMessage.mock.calls[0][0];
      expect(job.sourceChannelId).toBe(100);
      expect(job.text).toBe('Hello from channel');
    });

    it('ignores messages from non-subscribed channels', async () => {
      const mockClient = createMockClient();
      const mockPrisma = createMockPrisma([
        { telegramId: BigInt(100) },
      ]);
      const mockProducer = createMockProducer();

      const service = new ListenerService(
        { apiId: 1, apiHash: 'test', sessionString: 'valid' },
        logger,
        mockProducer as unknown as QueueProducer,
        mockPrisma as unknown as PrismaClient,
        mockClient as unknown as TelegramClient,
      );

      await service.start();

      const handlerCall = mockClient.addEventHandler.mock.calls[0];
      const handler = handlerCall[0] as (event: NewMessageEvent) => Promise<void>;

      // Message from channel 999 which is NOT in the active set
      const message = createMockMessage(BigInt(999), 'Should be ignored');
      await handler({ message } as unknown as NewMessageEvent);

      expect(mockProducer.enqueueMessage).not.toHaveBeenCalled();
    });

    it('ignores service messages (no text and no media)', async () => {
      const mockClient = createMockClient();
      const mockPrisma = createMockPrisma([
        { telegramId: BigInt(100) },
      ]);
      const mockProducer = createMockProducer();

      const service = new ListenerService(
        { apiId: 1, apiHash: 'test', sessionString: 'valid' },
        logger,
        mockProducer as unknown as QueueProducer,
        mockPrisma as unknown as PrismaClient,
        mockClient as unknown as TelegramClient,
      );

      await service.start();

      const handlerCall = mockClient.addEventHandler.mock.calls[0];
      const handler = handlerCall[0] as (event: NewMessageEvent) => Promise<void>;

      // Service message: no text, no media
      const message = createMockMessage(BigInt(100), '');
      await handler({ message } as unknown as NewMessageEvent);

      expect(mockProducer.enqueueMessage).not.toHaveBeenCalled();
    });
  });

  describe('auto-reconnect', () => {
    it('disconnect logs userbot_disconnected at warn level', async () => {
      const mockClient = createMockClient();
      const mockPrisma = createMockPrisma([{ telegramId: BigInt(100) }]);
      const mockProducer = createMockProducer();

      const service = new ListenerService(
        { apiId: 1, apiHash: 'test', sessionString: 'valid' },
        logger,
        mockProducer as unknown as QueueProducer,
        mockPrisma as unknown as PrismaClient,
        mockClient as unknown as TelegramClient,
      );

      await service.start();
      service.onDisconnect();

      const childLogger = (logger.child as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(childLogger.warn).toHaveBeenCalledWith('userbot_disconnected');
    });

    it('reconnect logs userbot_reconnected at info level and reloads active channels', async () => {
      const mockClient = createMockClient();
      const mockPrisma = createMockPrisma([{ telegramId: BigInt(100) }]);
      const mockProducer = createMockProducer();

      const service = new ListenerService(
        { apiId: 1, apiHash: 'test', sessionString: 'valid' },
        logger,
        mockProducer as unknown as QueueProducer,
        mockPrisma as unknown as PrismaClient,
        mockClient as unknown as TelegramClient,
      );

      await service.start();

      // Reset call count from start() loading
      mockPrisma.sourceChannel.findMany.mockClear();

      await service.onReconnect();

      const childLogger = (logger.child as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(childLogger.info).toHaveBeenCalledWith('userbot_reconnected');
      expect(mockPrisma.sourceChannel.findMany).toHaveBeenCalledOnce();
    });
  });

  describe('stop()', () => {
    it('disconnects the client', async () => {
      const mockClient = createMockClient();
      const mockPrisma = createMockPrisma();
      const mockProducer = createMockProducer();

      const service = new ListenerService(
        { apiId: 1, apiHash: 'test', sessionString: 'valid' },
        logger,
        mockProducer as unknown as QueueProducer,
        mockPrisma as unknown as PrismaClient,
        mockClient as unknown as TelegramClient,
      );

      await service.start();
      await service.stop();

      expect(mockClient.disconnect).toHaveBeenCalledOnce();
    });
  });
});
