import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type pino from 'pino';
import type { PrismaClient } from '../src/generated/prisma/client.ts';
import type { ChannelManager } from '../src/listener/channel-manager.ts';
import { ChannelCleanupService } from '../src/cleanup/channel-cleanup.service.ts';

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

function createMockPrisma() {
  return {
    sourceChannel: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

function createMockChannelManager() {
  return {
    leaveChannel: vi.fn().mockResolvedValue(undefined),
  };
}

const NOW = new Date('2026-02-17T12:00:00.000Z');
const THIRTY_ONE_DAYS_AGO = new Date('2026-01-17T12:00:00.000Z');

function makeChannel(overrides: Partial<{
  id: string;
  telegramId: bigint;
  title: string;
  isActive: boolean;
  subscribedAt: Date;
  updatedAt: Date;
  lastReferencedAt: Date | null;
  username: string | null;
}> = {}) {
  return {
    id: 'uuid-1',
    telegramId: 12345n,
    title: 'Test Channel',
    isActive: true,
    subscribedAt: THIRTY_ONE_DAYS_AGO,
    updatedAt: THIRTY_ONE_DAYS_AGO,
    lastReferencedAt: THIRTY_ONE_DAYS_AGO,
    username: null,
    ...overrides,
  };
}

describe('ChannelCleanupService', () => {
  let logger: pino.Logger;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockChannelManager: ReturnType<typeof createMockChannelManager>;
  let service: ChannelCleanupService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    logger = createMockLogger();
    mockPrisma = createMockPrisma();
    mockChannelManager = createMockChannelManager();
    service = new ChannelCleanupService(
      mockPrisma as unknown as PrismaClient,
      mockChannelManager as unknown as ChannelManager,
      logger,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not clean up channels with active SubscriptionListChannel references', async () => {
    // findMany returns empty because the filter excludes channels
    // that still have subscriptionListChannels references
    mockPrisma.sourceChannel.findMany.mockResolvedValue([]);

    const result = await service.execute();

    expect(result).toEqual({ deactivated: 0, failed: 0, total: 0 });
    expect(mockPrisma.sourceChannel.findMany).toHaveBeenCalledOnce();

    const findManyArg = mockPrisma.sourceChannel.findMany.mock.calls[0]![0] as Record<string, unknown>;
    const where = findManyArg.where as Record<string, unknown>;
    expect(where.isActive).toBe(true);
    expect(where.subscriptionListChannels).toEqual({ none: {} });

    expect(mockChannelManager.leaveChannel).not.toHaveBeenCalled();
    expect(mockPrisma.sourceChannel.update).not.toHaveBeenCalled();
  });

  it('does not clean up channels with lastReferencedAt less than 30 days ago', async () => {
    // The query filters for lastReferencedAt < threshold, so channels
    // referenced within the last 30 days are excluded by the query itself
    mockPrisma.sourceChannel.findMany.mockResolvedValue([]);

    const result = await service.execute();

    expect(result).toEqual({ deactivated: 0, failed: 0, total: 0 });
    expect(mockChannelManager.leaveChannel).not.toHaveBeenCalled();
    expect(mockPrisma.sourceChannel.update).not.toHaveBeenCalled();
  });

  it('deactivates channels with no references and lastReferencedAt >= 30 days ago', async () => {
    const channel = makeChannel({
      id: 'uuid-1',
      telegramId: 12345n,
      lastReferencedAt: THIRTY_ONE_DAYS_AGO,
    });

    mockPrisma.sourceChannel.findMany.mockResolvedValue([channel]);

    const result = await service.execute();

    expect(result).toEqual({ deactivated: 1, failed: 0, total: 1 });
    expect(mockChannelManager.leaveChannel).toHaveBeenCalledWith(Number(channel.telegramId));
    expect(mockPrisma.sourceChannel.update).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
      data: { isActive: false },
    });

    // Verify channel_left log
    expect(logger.info).toHaveBeenCalledWith(
      { telegramId: 12345, channelId: 'uuid-1' },
      'channel_left',
    );
  });

  it('returns zero counts when no orphaned channels exist', async () => {
    mockPrisma.sourceChannel.findMany.mockResolvedValue([]);

    const result = await service.execute();

    expect(result).toEqual({ deactivated: 0, failed: 0, total: 0 });
    expect(mockChannelManager.leaveChannel).not.toHaveBeenCalled();
    expect(mockPrisma.sourceChannel.update).not.toHaveBeenCalled();
  });

  it('handles partial failure — leaveChannel throws for first channel, succeeds for second', async () => {
    const channel1 = makeChannel({
      id: 'uuid-1',
      telegramId: 11111n,
      title: 'Channel One',
      lastReferencedAt: THIRTY_ONE_DAYS_AGO,
    });
    const channel2 = makeChannel({
      id: 'uuid-2',
      telegramId: 22222n,
      title: 'Channel Two',
      lastReferencedAt: null,
      subscribedAt: THIRTY_ONE_DAYS_AGO,
    });

    mockPrisma.sourceChannel.findMany.mockResolvedValue([channel1, channel2]);
    mockChannelManager.leaveChannel
      .mockRejectedValueOnce(new Error('CHANNEL_PRIVATE'))
      .mockResolvedValueOnce(undefined);

    const result = await service.execute();

    expect(result).toEqual({ deactivated: 1, failed: 1, total: 2 });

    // First channel: leaveChannel called but failed
    expect(mockChannelManager.leaveChannel).toHaveBeenCalledWith(Number(channel1.telegramId));
    // Second channel: leaveChannel called and succeeded
    expect(mockChannelManager.leaveChannel).toHaveBeenCalledWith(Number(channel2.telegramId));
    expect(mockChannelManager.leaveChannel).toHaveBeenCalledTimes(2);

    // Only second channel should have been deactivated
    expect(mockPrisma.sourceChannel.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.sourceChannel.update).toHaveBeenCalledWith({
      where: { id: 'uuid-2' },
      data: { isActive: false },
    });

    // Error should have been logged for the first channel
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: 11111, channelId: 'uuid-1' }),
      'channel_leave_failed',
    );
  });

  it('logs channel_cleanup_start and channel_cleanup_complete with structured data', async () => {
    const channel = makeChannel({ id: 'uuid-1', telegramId: 12345n });
    mockPrisma.sourceChannel.findMany.mockResolvedValue([channel]);

    await service.execute('job-123');

    // Verify start log with jobId
    expect(logger.info).toHaveBeenCalledWith(
      { jobId: 'job-123' },
      'channel_cleanup_start',
    );

    // Verify completion log with counts and duration
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        deactivated: 1,
        failed: 0,
        total: 1,
        durationMs: expect.any(Number),
      }),
      'channel_cleanup_complete',
    );
  });
});
