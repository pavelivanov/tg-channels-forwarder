import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { CHANNEL_OPS_QUEUE } from '../src/channels/channel-ops.provider.ts';
import { ChannelsService } from '../src/channels/channels.service.ts';
import { PrismaService } from '../src/prisma/prisma.service.ts';

describe('Channel Ops Provider', () => {
  let channelsService: ChannelsService;
  let mockQueue: { add: ReturnType<typeof vi.fn> };
  let mockPrisma: {
    sourceChannel: {
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    };

    mockPrisma = {
      sourceChannel: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'uuid-1',
          telegramId: BigInt(-1700000000000),
          username: 'testchannel',
          title: 'testchannel',
          subscribedAt: new Date(),
          isActive: false,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CHANNEL_OPS_QUEUE, useValue: mockQueue },
      ],
    }).compile();

    channelsService = moduleRef.get(ChannelsService);
  });

  it('enqueues channel-ops join job when new channel is created', async () => {
    const { created } = await channelsService.findOrCreate('testchannel');

    expect(created).toBe(true);
    expect(mockQueue.add).toHaveBeenCalledOnce();
    expect(mockQueue.add).toHaveBeenCalledWith('join', {
      operation: 'join',
      channelId: 'uuid-1',
      username: 'testchannel',
    });
  });

  it('does not enqueue job when channel already exists', async () => {
    mockPrisma.sourceChannel.findFirst.mockResolvedValue({
      id: 'uuid-1',
      telegramId: BigInt(12345),
      username: 'testchannel',
      title: 'Test Channel',
      subscribedAt: new Date(),
      isActive: true,
    });

    const { created } = await channelsService.findOrCreate('testchannel');

    expect(created).toBe(false);
    expect(mockQueue.add).not.toHaveBeenCalled();
  });
});
