import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GrammyError } from 'grammy';
import type { ForwardJob } from '@aggregator/shared';
import { ForwarderService } from '../src/forwarder/forwarder.service.ts';
import type { MessageSender } from '../src/forwarder/message-sender.ts';
import type { RateLimiterService } from '../src/forwarder/rate-limiter.service.ts';
import type { DedupService } from '../src/dedup/dedup.service.ts';
import type { PrismaClient } from '../src/generated/prisma/client.ts';

function createMockLogger() {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => logger,
  };
  return logger as unknown as import('pino').Logger;
}

function createMockMessageSender(): MessageSender {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    sendText: vi.fn(),
    sendPhoto: vi.fn(),
    sendVideo: vi.fn(),
    sendDocument: vi.fn(),
    sendAnimation: vi.fn(),
    sendAudio: vi.fn(),
    sendAlbum: vi.fn(),
  } as unknown as MessageSender;
}

function createMockDedupService(): DedupService {
  return {
    isDuplicate: vi.fn().mockResolvedValue(false),
    markAsForwarded: vi.fn().mockResolvedValue(undefined),
  } as unknown as DedupService;
}

function createMockRateLimiter(): RateLimiterService {
  return {
    execute: vi.fn().mockImplementation(
      (_destId: number, fn: () => Promise<unknown>) => fn(),
    ),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as RateLimiterService;
}

function createMockPrisma(destinationChannelIds: bigint[] = []): PrismaClient {
  const lists = destinationChannelIds.map((id, i) => ({
    id: `list-${String(i)}`,
    destinationChannelId: id,
  }));
  return {
    subscriptionList: {
      findMany: vi.fn().mockResolvedValue(lists),
    },
  } as unknown as PrismaClient;
}

function createJob(overrides: Partial<ForwardJob> = {}): ForwardJob {
  return {
    messageId: 1,
    sourceChannelId: 100,
    text: 'Hello world',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('ForwarderService', () => {
  let messageSender: MessageSender;
  let prisma: PrismaClient;
  let dedupService: DedupService;
  let rateLimiter: RateLimiterService;
  let logger: ReturnType<typeof createMockLogger>;
  let service: ForwarderService;

  beforeEach(() => {
    messageSender = createMockMessageSender();
    dedupService = createMockDedupService();
    rateLimiter = createMockRateLimiter();
    logger = createMockLogger();
  });

  describe('T009 [US1]: text message forwarding', () => {
    it('sends text message to destination with formatting preserved', async () => {
      prisma = createMockPrisma([BigInt(-1001234567890)]);
      service = new ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger);

      const job = createJob({
        text: 'Hello **bold**',
        entities: [{ type: 'bold', offset: 6, length: 8 }],
      });

      await service.forward(job);

      expect(messageSender.send).toHaveBeenCalledWith(
        Number(BigInt(-1001234567890)),
        job,
      );
    });

    it('queries active subscription lists for the source channel', async () => {
      prisma = createMockPrisma([BigInt(-100)]);
      service = new ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger);

      await service.forward(createJob({ sourceChannelId: 42 }));

      expect(prisma.subscriptionList.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });

    it('marks message as forwarded on success', async () => {
      prisma = createMockPrisma([BigInt(-100)]);
      service = new ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger);

      await service.forward(createJob({ text: 'Test message' }));

      expect(dedupService.markAsForwarded).toHaveBeenCalledWith(
        Number(BigInt(-100)),
        'Test message',
      );
    });

    it('logs no_destinations when no matching subscription lists', async () => {
      prisma = createMockPrisma([]);
      service = new ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger);

      await service.forward(createJob());

      expect(messageSender.send).not.toHaveBeenCalled();
    });

    it('sends via rate limiter', async () => {
      prisma = createMockPrisma([BigInt(-100)]);
      service = new ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger);

      await service.forward(createJob());

      expect(rateLimiter.execute).toHaveBeenCalledWith(
        Number(BigInt(-100)),
        expect.any(Function),
      );
    });
  });

  describe('T016 [US4]: duplicate message is skipped', () => {
    it('does not send when dedup returns true', async () => {
      prisma = createMockPrisma([BigInt(-100)]);
      vi.mocked(dedupService.isDuplicate).mockResolvedValue(true);
      service = new ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger);

      await service.forward(createJob());

      expect(messageSender.send).not.toHaveBeenCalled();
      expect(dedupService.markAsForwarded).not.toHaveBeenCalled();
    });
  });

  describe('T017 [US4]: message to two different destinations', () => {
    it('sends to both destinations', async () => {
      prisma = createMockPrisma([BigInt(-100), BigInt(-200)]);
      service = new ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger);

      await service.forward(createJob());

      expect(messageSender.send).toHaveBeenCalledTimes(2);
      expect(messageSender.send).toHaveBeenCalledWith(Number(BigInt(-100)), expect.anything());
      expect(messageSender.send).toHaveBeenCalledWith(Number(BigInt(-200)), expect.anything());
    });
  });

  describe('T018 [US4]: same destination via two lists is sent only once', () => {
    it('deduplicates same destination across lists', async () => {
      prisma = createMockPrisma([BigInt(-100), BigInt(-100)]);
      service = new ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger);

      await service.forward(createJob());

      expect(messageSender.send).toHaveBeenCalledTimes(1);
      expect(dedupService.markAsForwarded).toHaveBeenCalledTimes(1);
    });
  });

  describe('T019 [US6]: 429 response triggers retry', () => {
    it('propagates GrammyError with 429 error code', async () => {
      prisma = createMockPrisma([BigInt(-100)]);
      const grammyError = new GrammyError(
        'Too Many Requests',
        {
          ok: false,
          error_code: 429,
          description: 'Too Many Requests: retry after 30',
          parameters: { retry_after: 30 },
        } as ReturnType<typeof Object>,
        'sendMessage',
        {} as ReturnType<typeof Object>,
      );
      vi.mocked(messageSender.send).mockRejectedValue(grammyError);
      service = new ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger);

      await expect(service.forward(createJob())).rejects.toThrow(GrammyError);
    });
  });

  describe('T020 [US6]: non-retryable error is logged and thrown', () => {
    it('logs forward_failed and throws on generic GrammyError', async () => {
      prisma = createMockPrisma([BigInt(-100)]);
      const grammyError = new GrammyError(
        'Forbidden: bot was kicked',
        {
          ok: false,
          error_code: 403,
          description: 'Forbidden: bot was kicked from the group chat',
        } as ReturnType<typeof Object>,
        'sendMessage',
        {} as ReturnType<typeof Object>,
      );
      vi.mocked(messageSender.send).mockRejectedValue(grammyError);
      service = new ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger);

      await expect(service.forward(createJob())).rejects.toThrow(GrammyError);
    });
  });
});
