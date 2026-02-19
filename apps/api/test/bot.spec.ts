import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrammyError } from 'grammy';

const mockGetChatMember = vi.fn();
const mockGetChat = vi.fn();
const mockGetMe = vi
  .fn()
  .mockResolvedValue({ id: 123, is_bot: true, first_name: 'TestBot' });

vi.mock('grammy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('grammy')>();
  return {
    ...actual,
    Api: vi.fn().mockImplementation(() => ({
      getChatMember: mockGetChatMember,
      getChat: mockGetChat,
      getMe: mockGetMe,
    })),
  };
});

import { BotService } from '../src/bot/bot.service.ts';

const mockUser = { id: 123, is_bot: true, first_name: 'Bot' };

describe('BotService', () => {
  let service: BotService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetMe.mockResolvedValue({
      id: 123,
      is_bot: true,
      first_name: 'TestBot',
    });

    const mockConfig = {
      get: vi.fn().mockReturnValue('test-token'),
    };

    service = new BotService(mockConfig as unknown as ConfigService);
    await service.onModuleInit();
  });

  it('verifyBotAdmin returns true when bot is administrator', async () => {
    mockGetChatMember.mockResolvedValue({
      status: 'administrator',
      user: mockUser,
    });

    const result = await service.verifyBotAdmin(-1001234567890);

    expect(result).toBe(true);
    expect(mockGetChatMember).toHaveBeenCalledWith(
      -1001234567890,
      123,
      expect.any(AbortSignal),
    );
  });

  it('verifyBotAdmin returns true when bot is creator', async () => {
    mockGetChatMember.mockResolvedValue({
      status: 'creator',
      user: mockUser,
    });

    const result = await service.verifyBotAdmin(-1001234567890);

    expect(result).toBe(true);
  });

  it('verifyBotAdmin returns false when bot is regular member', async () => {
    mockGetChatMember.mockResolvedValue({
      status: 'member',
      user: mockUser,
    });

    const result = await service.verifyBotAdmin(-1001234567890);

    expect(result).toBe(false);
  });

  it('verifyBotAdmin returns false when channel does not exist', async () => {
    mockGetChatMember.mockRejectedValue(
      new GrammyError(
        'Bad Request: chat not found',
        {
          ok: false,
          error_code: 400,
          description: 'Bad Request: chat not found',
        },
        'getChatMember',
        { chat_id: -1001234, user_id: 123 },
      ),
    );

    const result = await service.verifyBotAdmin(-1001234);

    expect(result).toBe(false);
  });

  it('verifyBotAdmin returns false when bot is kicked/banned', async () => {
    mockGetChatMember.mockRejectedValue(
      new GrammyError(
        'Forbidden: bot was kicked from the supergroup chat',
        {
          ok: false,
          error_code: 403,
          description: 'Forbidden: bot was kicked from the supergroup chat',
        },
        'getChatMember',
        { chat_id: -1001234567890, user_id: 123 },
      ),
    );

    const result = await service.verifyBotAdmin(-1001234567890);

    expect(result).toBe(false);
  });

  it('verifyBotAdmin throws ServiceUnavailableException on network error', async () => {
    mockGetChatMember.mockRejectedValue(new Error('Network error'));

    await expect(service.verifyBotAdmin(-1001234567890)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  // --- resolveChannel ---

  it('resolveChannel returns id and title on success', async () => {
    mockGetChat.mockResolvedValue({
      id: -1001234567890,
      type: 'channel',
      title: 'Test Channel',
    });

    const result = await service.resolveChannel('testchannel');

    expect(result).toEqual({ id: -1001234567890, title: 'Test Channel' });
    expect(mockGetChat).toHaveBeenCalledWith('@testchannel');
  });

  it('resolveChannel throws BadRequestException on GrammyError', async () => {
    mockGetChat.mockRejectedValue(
      new GrammyError(
        'Bad Request: chat not found',
        {
          ok: false,
          error_code: 400,
          description: 'Bad Request: chat not found',
        },
        'getChat',
        { chat_id: '@nonexistent' },
      ),
    );

    await expect(service.resolveChannel('nonexistent')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('resolveChannel throws ServiceUnavailableException on non-Grammy error', async () => {
    mockGetChat.mockRejectedValue(new Error('Network error'));

    await expect(service.resolveChannel('testchannel')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
