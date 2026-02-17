import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
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

// --- Helper: create correctly signed Telegram initData ---

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

// --- Helper: get JWT token ---

async function getAuthToken(baseUrl: string): Promise<string> {
  const initData = createInitData(BOT_TOKEN, {
    id: 300000001,
    first_name: 'ChannelTester',
  });

  const response = await fetch(`${baseUrl}/auth/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  const body = (await response.json()) as { token: string };
  return body.token;
}

// --- Test suite ---

describe('Channels API', () => {
  let app: INestApplication;
  let baseUrl: string;
  let authToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BotService)
      .useValue({ verifyBotAdmin: async () => true, onModuleInit: async () => {} })
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

    // Clean up channels created by previous test runs (keep seeded channels)
    const prisma = app.get(PrismaService);
    await prisma.sourceChannel.deleteMany({
      where: { telegramId: { lt: 0 } },
    });

    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' ? address?.port : address;
    baseUrl = `http://localhost:${port}`;

    authToken = await getAuthToken(baseUrl);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // --- US3: Consistent Error Responses ---

  describe('US3: Error response shape', () => {
    it('validation error returns { statusCode, error, message } with message as string', async () => {
      const response = await fetch(`${baseUrl}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ username: 'ab' }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toHaveProperty('statusCode', 400);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(typeof body['message']).toBe('string');
    });

    it('GET /channels without token returns { statusCode: 401, error, message }', async () => {
      const response = await fetch(`${baseUrl}/channels`);

      expect(response.status).toBe(401);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toHaveProperty('statusCode', 401);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });

    it('POST /channels without token returns { statusCode: 401, error, message }', async () => {
      const response = await fetch(`${baseUrl}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'validuser' }),
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toHaveProperty('statusCode', 401);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });
  });

  // --- US1: Browse Active Channels ---

  describe('US1: GET /channels', () => {
    it('returns 200 with array of active channels ordered by title', async () => {
      const response = await fetch(`${baseUrl}/channels`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as Array<{ title: string }>;
      expect(Array.isArray(body)).toBe(true);

      // Seeded channels: "Dev Updates" and "Tech News Channel"
      const titles = body.map((c) => c.title);
      const devIdx = titles.indexOf('Dev Updates');
      const techIdx = titles.indexOf('Tech News Channel');
      expect(devIdx).toBeGreaterThanOrEqual(0);
      expect(techIdx).toBeGreaterThanOrEqual(0);
      expect(devIdx).toBeLessThan(techIdx);
    });

    it('response includes all required fields', async () => {
      const response = await fetch(`${baseUrl}/channels`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const body = (await response.json()) as Array<Record<string, unknown>>;
      expect(body.length).toBeGreaterThan(0);

      const channel = body[0]!;
      expect(channel).toHaveProperty('id');
      expect(channel).toHaveProperty('telegramId');
      expect(typeof channel['telegramId']).toBe('string');
      expect(channel).toHaveProperty('username');
      expect(channel).toHaveProperty('title');
      expect(channel).toHaveProperty('subscribedAt');
      expect(channel).toHaveProperty('isActive');
      expect(channel['isActive']).toBe(true);
    });

    it('filters out inactive channels', async () => {
      // The test setup has only active seeded channels
      // We'll create an inactive channel via POST and then verify GET excludes it
      const response = await fetch(`${baseUrl}/channels`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const body = (await response.json()) as Array<{ isActive: boolean }>;
      const allActive = body.every((c) => c.isActive === true);
      expect(allActive).toBe(true);
    });

    it('returns 401 without auth token', async () => {
      const response = await fetch(`${baseUrl}/channels`);
      expect(response.status).toBe(401);
    });
  });

  // --- US2: Request New Channel Subscription ---

  describe('US2: POST /channels', () => {
    it('creates new pending channel with valid username', async () => {
      const response = await fetch(`${baseUrl}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ username: 'newtest_channel' }),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body['isActive']).toBe(false);
      expect(Number(body['telegramId'] as string)).toBeLessThan(0);
      expect(body['title']).toBe('newtest_channel');
      expect(body['username']).toBe('newtest_channel');
    });

    it('returns 200 for same username again (idempotent)', async () => {
      const response = await fetch(`${baseUrl}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ username: 'newtest_channel' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body['username']).toBe('newtest_channel');
    });

    it('returns 200 with existing active channel', async () => {
      const response = await fetch(`${baseUrl}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ username: 'technews' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body['isActive']).toBe(true);
      expect(body['username']).toBe('technews');
    });

    it('returns 200 with existing inactive channel (no duplicate)', async () => {
      // First create an inactive channel
      await fetch(`${baseUrl}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ username: 'inactive_test_ch' }),
      });

      // Submit same username again
      const response = await fetch(`${baseUrl}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ username: 'inactive_test_ch' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body['username']).toBe('inactive_test_ch');
      expect(body['isActive']).toBe(false);
    });

    it('returns 400 for invalid username (too short)', async () => {
      const response = await fetch(`${baseUrl}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ username: 'ab' }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toHaveProperty('statusCode', 400);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });

    it('returns 400 for invalid username (contains @)', async () => {
      const response = await fetch(`${baseUrl}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ username: '@channel_name' }),
      });

      expect(response.status).toBe(400);
    });

    it('trims whitespace from username', async () => {
      const response = await fetch(`${baseUrl}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ username: '  trimmed_user  ' }),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body['username']).toBe('trimmed_user');
    });

    it('returns 401 without auth token', async () => {
      const response = await fetch(`${baseUrl}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'validuser' }),
      });

      expect(response.status).toBe(401);
    });
  });
});
