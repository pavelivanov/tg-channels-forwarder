import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseArgs, resolveChannel, upsertChannel, joinChannel } from '../prisma/seed-channels.ts';
import { Api } from 'telegram';
import type { TelegramClient } from 'telegram';
import type { PrismaClient } from '../src/generated/prisma/client.ts';

describe('seed-channels', () => {
  describe('parseArgs', () => {
    it('parses space-separated usernames', () => {
      const result = parseArgs(['node', 'script.ts', '@channel1', '@channel2']);
      expect(result.usernames).toEqual(['channel1', 'channel2']);
      expect(result.join).toBe(false);
    });

    it('parses comma-separated usernames in a single arg', () => {
      const result = parseArgs(['node', 'script.ts', '@channel1,@channel2,@channel3']);
      expect(result.usernames).toEqual(['channel1', 'channel2', 'channel3']);
    });

    it('parses mixed comma and space-separated usernames', () => {
      const result = parseArgs(['node', 'script.ts', '@a,@b', '@c']);
      expect(result.usernames).toEqual(['a', 'b', 'c']);
    });

    it('strips @ prefix from usernames', () => {
      const result = parseArgs(['node', 'script.ts', '@channel1', 'channel2']);
      expect(result.usernames).toEqual(['channel1', 'channel2']);
    });

    it('deduplicates usernames (case-insensitive)', () => {
      const result = parseArgs(['node', 'script.ts', '@channel1', '@Channel1', '@CHANNEL1']);
      expect(result.usernames).toEqual(['channel1']);
    });

    it('extracts --join flag', () => {
      const result = parseArgs(['node', 'script.ts', '--join', '@channel1']);
      expect(result.join).toBe(true);
      expect(result.usernames).toEqual(['channel1']);
    });

    it('handles --join flag in any position', () => {
      const result = parseArgs(['node', 'script.ts', '@channel1', '--join', '@channel2']);
      expect(result.join).toBe(true);
      expect(result.usernames).toEqual(['channel1', 'channel2']);
    });

    it('returns empty array when no usernames provided', () => {
      const result = parseArgs(['node', 'script.ts']);
      expect(result.usernames).toEqual([]);
    });

    it('returns empty array when only --join provided', () => {
      const result = parseArgs(['node', 'script.ts', '--join']);
      expect(result.usernames).toEqual([]);
      expect(result.join).toBe(true);
    });

    it('ignores empty strings from comma splitting', () => {
      const result = parseArgs(['node', 'script.ts', '@a,,@b,']);
      expect(result.usernames).toEqual(['a', 'b']);
    });
  });

  describe('resolveChannel', () => {
    let mockClient: { getEntity: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockClient = {
        getEntity: vi.fn(),
      };
    });

    it('resolves a channel entity and returns telegramId, title, username', async () => {
      const fakeChannel = new Api.Channel({
        id: BigInt(1001234567),
        title: 'Test Channel',
        accessHash: BigInt(0),
        date: 0,
      });
      mockClient.getEntity.mockResolvedValue(fakeChannel);

      const result = await resolveChannel(mockClient as unknown as TelegramClient, 'testchannel');
      expect(result).toEqual({
        telegramId: 1001234567,
        title: 'Test Channel',
        username: 'testchannel',
      });
      expect(mockClient.getEntity).toHaveBeenCalledWith('testchannel');
    });

    it('throws if entity is not a Channel', async () => {
      const fakeUser = new Api.User({
        id: BigInt(12345),
        accessHash: BigInt(0),
      });
      mockClient.getEntity.mockResolvedValue(fakeUser);

      await expect(
        resolveChannel(mockClient as unknown as TelegramClient, 'someuser'),
      ).rejects.toThrow('not a channel');
    });

    it('retries once on FloodWaitError', async () => {
      const floodError = Object.assign(new Error('A wait of 5 seconds is required'), {
        seconds: 5,
      });
      Object.defineProperty(floodError, 'constructor', {
        value: { name: 'FloodWaitError' },
      });

      const fakeChannel = new Api.Channel({
        id: BigInt(999),
        title: 'Flood Channel',
        accessHash: BigInt(0),
        date: 0,
      });

      mockClient.getEntity
        .mockRejectedValueOnce(floodError)
        .mockResolvedValueOnce(fakeChannel);

      // Mock sleep to avoid actual delay in tests
      vi.useFakeTimers();
      const promise = resolveChannel(mockClient as unknown as TelegramClient, 'floodchan');
      await vi.runAllTimersAsync();
      const result = await promise;
      vi.useRealTimers();

      expect(result.telegramId).toBe(999);
      expect(mockClient.getEntity).toHaveBeenCalledTimes(2);
    });
  });

  describe('upsertChannel', () => {
    let mockPrisma: {
      sourceChannel: {
        findUnique: ReturnType<typeof vi.fn>;
        upsert: ReturnType<typeof vi.fn>;
      };
    };

    beforeEach(() => {
      mockPrisma = {
        sourceChannel: {
          findUnique: vi.fn(),
          upsert: vi.fn().mockResolvedValue({}),
        },
      };
    });

    it('returns "created" when channel does not exist', async () => {
      mockPrisma.sourceChannel.findUnique.mockResolvedValue(null);

      const result = await upsertChannel(mockPrisma as unknown as PrismaClient, {
        telegramId: 12345,
        title: 'New Channel',
        username: 'newchan',
      });

      expect(result).toBe('created');
      expect(mockPrisma.sourceChannel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { username: 'newchan' },
          create: expect.objectContaining({
            telegramId: BigInt(12345),
            username: 'newchan',
            title: 'New Channel',
            isActive: true,
          }),
        }),
      );
    });

    it('returns "updated" when channel already exists', async () => {
      mockPrisma.sourceChannel.findUnique.mockResolvedValue({ id: 'existing-id' });

      const result = await upsertChannel(mockPrisma as unknown as PrismaClient, {
        telegramId: 12345,
        title: 'Updated Channel',
        username: 'existingchan',
      });

      expect(result).toBe('updated');
    });
  });

  describe('joinChannel', () => {
    let mockClient: { invoke: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockClient = {
        invoke: vi.fn(),
      };
    });

    it('returns true on successful join', async () => {
      mockClient.invoke.mockResolvedValue({});

      const result = await joinChannel(mockClient as unknown as TelegramClient, 12345, 'testchan');
      expect(result).toBe(true);
    });

    it('returns true when already a participant', async () => {
      mockClient.invoke.mockRejectedValue(new Error('USER_ALREADY_PARTICIPANT'));

      const result = await joinChannel(mockClient as unknown as TelegramClient, 12345, 'testchan');
      expect(result).toBe(true);
    });

    it('returns false on other errors', async () => {
      mockClient.invoke.mockRejectedValue(new Error('CHANNEL_PRIVATE'));

      const result = await joinChannel(mockClient as unknown as TelegramClient, 12345, 'testchan');
      expect(result).toBe(false);
    });
  });
});
