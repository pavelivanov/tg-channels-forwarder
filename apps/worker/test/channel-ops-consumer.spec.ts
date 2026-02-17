import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type pino from 'pino';
import type { ChannelOpsJob } from '@aggregator/shared';
import type { ChannelManager } from '../src/listener/channel-manager.ts';
import { ChannelOpsConsumer } from '../src/listener/channel-ops-consumer.ts';

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

function createMockChannelManager() {
  return {
    joinChannel: vi.fn().mockResolvedValue({ telegramId: 12345, title: 'Test' }),
    leaveChannel: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ChannelOpsConsumer', () => {
  let logger: pino.Logger;
  let mockManager: ReturnType<typeof createMockChannelManager>;
  beforeEach(() => {
    vi.resetModules();
    logger = createMockLogger();
    mockManager = createMockChannelManager();
  });

  it('processes join job by delegating to ChannelManager.joinChannel', async () => {
    const consumer = new ChannelOpsConsumer(mockManager as unknown as ChannelManager, logger);
    const result = await consumer.processJob({
      data: {
        operation: 'join',
        channelId: 'uuid-1',
        username: 'testchannel',
      } as ChannelOpsJob,
    } as unknown as Job<ChannelOpsJob>);

    expect(mockManager.joinChannel).toHaveBeenCalledWith('uuid-1', 'testchannel');
    expect(result).toEqual({ telegramId: 12345, title: 'Test' });
  });

  it('processes leave job by delegating to ChannelManager.leaveChannel', async () => {
    const consumer = new ChannelOpsConsumer(mockManager as unknown as ChannelManager, logger);
    await consumer.processJob({
      data: {
        operation: 'leave',
        telegramId: 12345,
      } as ChannelOpsJob,
    } as unknown as Job<ChannelOpsJob>);

    expect(mockManager.leaveChannel).toHaveBeenCalledWith(12345);
  });

  it('failed job propagates error from ChannelManager', async () => {
    mockManager.joinChannel.mockRejectedValue(new Error('CHANNEL_PRIVATE'));
    const consumer = new ChannelOpsConsumer(mockManager as unknown as ChannelManager, logger);

    await expect(
      consumer.processJob({
        data: {
          operation: 'join',
          channelId: 'uuid-1',
          username: 'privatechannel',
        } as ChannelOpsJob,
      } as unknown as Job<ChannelOpsJob>),
    ).rejects.toThrow('CHANNEL_PRIVATE');
  });
});
