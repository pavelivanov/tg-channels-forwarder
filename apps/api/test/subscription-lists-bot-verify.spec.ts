import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ValidationPipe,
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common';
import { AllExceptionsFilter } from '../src/filters/http-exception.filter.ts';
import { PrismaService } from '../src/prisma/prisma.service.ts';
import { BotService } from '../src/bot/bot.service.ts';

const BOT_TOKEN = 'test-bot-token-for-local-development';
const JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long!!';
const DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/aggregator?schema=public';

process.env['DATABASE_URL'] = DATABASE_URL;
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['BOT_TOKEN'] = BOT_TOKEN;
process.env['JWT_SECRET'] = JWT_SECRET;

const { AppModule } = await import('../src/app.module.ts');

// --- Mock BotService ---

const mockResolveChannel = vi.fn<(username: string) => Promise<{ id: number; title: string }>>();
const mockVerifyBotAdmin = vi.fn<(channelId: number) => Promise<boolean>>();

// --- Helpers ---

function createInitData(
  botToken: string,
  userData: {
    id?: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  } = {},
): string {
  const user = {
    id: userData.id ?? 100000001,
    first_name: userData.first_name ?? 'TestUser',
    ...(userData.last_name !== undefined && { last_name: userData.last_name }),
    ...(userData.username !== undefined && { username: userData.username }),
  };

  const authDate = Math.floor(Date.now() / 1000);

  const params = new URLSearchParams();
  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(authDate));

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const computedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  params.set('hash', computedHash);

  return params.toString();
}

async function getAuthToken(
  baseUrl: string,
  telegramId = 600000001,
  firstName = 'BotVerifyTester',
): Promise<string> {
  const initData = createInitData(BOT_TOKEN, {
    id: telegramId,
    first_name: firstName,
  });

  const response = await fetch(`${baseUrl}/auth/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  const body = (await response.json()) as { token: string };
  return body.token;
}

async function authedFetch(
  url: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

// --- Types ---

interface ListResponse {
  id: string;
  name: string;
  destinationChannelId: string;
  destinationUsername: string | null;
  isActive: boolean;
  createdAt: string;
  sourceChannels: {
    id: string;
    telegramId: string;
    username: string | null;
    title: string;
  }[];
}

interface ErrorResponseWithCode {
  statusCode: number;
  error: string;
  message: string;
  errorCode?: string;
}

// --- Suite ---

describe('Subscription Lists Bot Verification', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let authToken: string;

  let sourceChannelId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BotService)
      .useValue({ resolveChannel: mockResolveChannel, verifyBotAdmin: mockVerifyBotAdmin, onModuleInit: vi.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up test data from previous runs
    await prisma.subscriptionListChannel.deleteMany({
      where: {
        subscriptionList: {
          user: { telegramId: 600000001n },
        },
      },
    });
    await prisma.subscriptionList.deleteMany({
      where: { user: { telegramId: 600000001n } },
    });

    // Get a source channel for testing
    const ch = await prisma.sourceChannel.findFirst({
      where: { username: 'technews' },
    });
    sourceChannelId = ch!.id;

    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' ? address?.port : address;
    baseUrl = `http://localhost:${port}`;

    authToken = await getAuthToken(baseUrl);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default: resolveChannel returns a valid channel, bot is admin
    mockResolveChannel.mockResolvedValue({ id: -1001002000099, title: 'Resolved Channel' });
    mockVerifyBotAdmin.mockResolvedValue(true);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.subscriptionListChannel.deleteMany({
        where: {
          subscriptionList: {
            user: { telegramId: 600000001n },
          },
        },
      });
      await prisma.subscriptionList.deleteMany({
        where: { user: { telegramId: 600000001n } },
      });
    }
    if (app) await app.close();
  });

  async function cleanUserLists() {
    await prisma.subscriptionListChannel.deleteMany({
      where: {
        subscriptionList: { user: { telegramId: 600000001n } },
      },
    });
    await prisma.subscriptionList.deleteMany({
      where: { user: { telegramId: 600000001n } },
    });
  }

  // --- US1: Prevent list creation without bot admin access ---

  describe('US1: POST /subscription-lists — bot admin verification', () => {
    it('creates list successfully when bot is admin', async () => {
      await cleanUserLists();
      mockVerifyBotAdmin.mockResolvedValue(true);

      const res = await authedFetch(
        `${baseUrl}/subscription-lists`,
        authToken,
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Admin Verified List',
            destinationUsername: 'adminverified',
            sourceChannelIds: [sourceChannelId],
          }),
        },
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as ListResponse;
      expect(body.name).toBe('Admin Verified List');
      expect(mockResolveChannel).toHaveBeenCalledWith('adminverified');
      expect(mockVerifyBotAdmin).toHaveBeenCalledWith(-1001002000099);
    });

    it('rejects list creation with DESTINATION_BOT_NOT_ADMIN when bot is not admin', async () => {
      await cleanUserLists();
      mockVerifyBotAdmin.mockResolvedValue(false);

      const res = await authedFetch(
        `${baseUrl}/subscription-lists`,
        authToken,
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Should Fail',
            destinationUsername: 'shouldfail',
            sourceChannelIds: [sourceChannelId],
          }),
        },
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponseWithCode;
      expect(body.errorCode).toBe('DESTINATION_BOT_NOT_ADMIN');
      expect(body.message).toContain(
        'Please add the bot as an administrator',
      );
    });
  });

  // --- US2: Prevent list update to unverified destination ---

  describe('US2: PATCH /subscription-lists/:id — bot admin verification', () => {
    let listId: string;

    beforeAll(async () => {
      await cleanUserLists();
      mockVerifyBotAdmin.mockResolvedValue(true);

      // Create a list to update
      const res = await authedFetch(
        `${baseUrl}/subscription-lists`,
        authToken,
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Update Test List',
            destinationUsername: 'updatetestlist',
            sourceChannelIds: [sourceChannelId],
          }),
        },
      );

      const body = (await res.json()) as ListResponse;
      listId = body.id;
    });

    it('rejects destination change when bot is not admin in new channel', async () => {
      mockVerifyBotAdmin.mockResolvedValue(false);

      const res = await authedFetch(
        `${baseUrl}/subscription-lists/${listId}`,
        authToken,
        {
          method: 'PATCH',
          body: JSON.stringify({ destinationUsername: 'newchannel' }),
        },
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponseWithCode;
      expect(body.errorCode).toBe('DESTINATION_BOT_NOT_ADMIN');
      expect(mockResolveChannel).toHaveBeenCalledWith('newchannel');
      expect(mockVerifyBotAdmin).toHaveBeenCalledWith(-1001002000099);
    });

    it('updates name without triggering bot admin verification', async () => {
      mockResolveChannel.mockClear();
      mockVerifyBotAdmin.mockClear();

      const res = await authedFetch(
        `${baseUrl}/subscription-lists/${listId}`,
        authToken,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Renamed Without Verify' }),
        },
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as ListResponse;
      expect(body.name).toBe('Renamed Without Verify');
      expect(mockResolveChannel).not.toHaveBeenCalled();
      expect(mockVerifyBotAdmin).not.toHaveBeenCalled();
    });
  });

  // --- US3: Handle unreachable destination gracefully ---

  describe('US3: Service unavailable — bot admin verification', () => {
    it('returns 503 when Telegram API is unavailable', async () => {
      await cleanUserLists();
      mockResolveChannel.mockRejectedValue(
        new ServiceUnavailableException(
          'Unable to resolve channel. Please try again later.',
        ),
      );

      const res = await authedFetch(
        `${baseUrl}/subscription-lists`,
        authToken,
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Service Down',
            destinationUsername: 'servicedown',
            sourceChannelIds: [sourceChannelId],
          }),
        },
      );

      expect(res.status).toBe(503);
      const body = (await res.json()) as ErrorResponseWithCode;
      expect(body.message).toContain(
        'Unable to resolve channel',
      );
    });
  });

  // --- US4: Channel resolution error paths ---

  describe('US4: Channel resolution edge cases', () => {
    it('returns 400 when channel not found (resolveChannel throws)', async () => {
      await cleanUserLists();
      mockResolveChannel.mockRejectedValue(
        new BadRequestException(
          'Channel not found or bot has no access. Make sure the channel exists and the bot is a member.',
        ),
      );

      const res = await authedFetch(
        `${baseUrl}/subscription-lists`,
        authToken,
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Not Found Channel',
            destinationUsername: 'nonexistent',
            sourceChannelIds: [sourceChannelId],
          }),
        },
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponseWithCode;
      expect(body.message).toContain('Channel not found');
    });

    it('returns 400 when resolveChannel succeeds but bot is not admin', async () => {
      await cleanUserLists();
      mockResolveChannel.mockResolvedValue({ id: -1001002000099, title: 'Found Channel' });
      mockVerifyBotAdmin.mockResolvedValue(false);

      const res = await authedFetch(
        `${baseUrl}/subscription-lists`,
        authToken,
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'No Admin Access',
            destinationUsername: 'noadmin',
            sourceChannelIds: [sourceChannelId],
          }),
        },
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponseWithCode;
      expect(body.errorCode).toBe('DESTINATION_BOT_NOT_ADMIN');
    });

    it('accepts username with @ prefix', async () => {
      await cleanUserLists();
      mockResolveChannel.mockResolvedValue({ id: -1001002000099, title: 'At Channel' });
      mockVerifyBotAdmin.mockResolvedValue(true);

      const res = await authedFetch(
        `${baseUrl}/subscription-lists`,
        authToken,
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'At Prefix Test',
            destinationUsername: '@atchannel',
            sourceChannelIds: [sourceChannelId],
          }),
        },
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as ListResponse;
      expect(body.destinationUsername).toBe('atchannel');
      expect(mockResolveChannel).toHaveBeenCalledWith('atchannel');
    });
  });
});
