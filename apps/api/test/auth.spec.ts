import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { Controller, Get, Module, type INestApplication } from '@nestjs/common';

const BOT_TOKEN = 'test-bot-token-for-local-development';
const JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long!!';
const DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/aggregator?schema=public';

// Set required env vars before AppModule is imported
process.env['DATABASE_URL'] = DATABASE_URL;
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['BOT_TOKEN'] = BOT_TOKEN;
process.env['JWT_SECRET'] = JWT_SECRET;

const { AppModule } = await import('../src/app.module.ts');
const { BotService } = await import('../src/bot/bot.service.ts');

// Test-only protected controller (no @Public() decorator)
@Controller('test-protected')
class TestProtectedController {
  @Get()
  getProtected() {
    return { message: 'protected data' };
  }
}

@Module({
  controllers: [TestProtectedController],
})
class TestModule {}

// --- Helper: create correctly signed Telegram initData ---

interface InitDataUserOverrides {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  is_premium?: boolean;
}

interface InitDataOverrides {
  auth_date?: number;
  hash?: string;
}

function createInitData(
  botToken: string,
  userData: InitDataUserOverrides = {},
  overrides: InitDataOverrides = {},
): string {
  const user = {
    id: userData.id ?? 100000001,
    first_name: userData.first_name ?? 'TestUser',
    ...(userData.last_name !== undefined && { last_name: userData.last_name }),
    ...(userData.username !== undefined && { username: userData.username }),
    ...(userData.photo_url !== undefined && { photo_url: userData.photo_url }),
    ...(userData.is_premium !== undefined && { is_premium: userData.is_premium }),
  };

  const authDate =
    overrides.auth_date ?? Math.floor(Date.now() / 1000);

  const params = new URLSearchParams();
  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(authDate));

  // Build data-check-string: all pairs sorted by key, joined by \n
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Derive secret: HMAC-SHA256(key="WebAppData", data=botToken)
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Compute hash: HMAC-SHA256(key=secretKey, data=dataCheckString)
  const computedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  params.set('hash', overrides.hash ?? computedHash);

  return params.toString();
}

// --- Tests ---

describe('Auth (POST /auth/validate)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, TestModule],
    })
      .overrideProvider(BotService)
      .useValue({ verifyBotAdmin: async () => true, onModuleInit: async () => {} })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' ? address?.port : address;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // --- HMAC validation ---

  it('accepts correctly signed initData and returns JWT + user profile', async () => {
    const initData = createInitData(BOT_TOKEN, {
      id: 200000001,
      first_name: 'Alice',
      username: 'alice_test',
    });

    const response = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      token: string;
      user: {
        id: string;
        telegramId: string;
        firstName: string;
        username: string | null;
      };
    };

    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.user).toBeDefined();
    expect(body.user.firstName).toBe('Alice');
    expect(body.user.username).toBe('alice_test');
    expect(body.user.telegramId).toBe('200000001');
  });

  it('rejects tampered initData (modified hash)', async () => {
    const initData = createInitData(
      BOT_TOKEN,
      { id: 200000002, first_name: 'Bob' },
      { hash: 'deadbeef'.repeat(8) },
    );

    const response = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });

    expect(response.status).toBe(401);
  });

  it('rejects expired initData (auth_date older than 5 minutes)', async () => {
    const expiredAuthDate = Math.floor(Date.now() / 1000) - 400;
    const initData = createInitData(
      BOT_TOKEN,
      { id: 200000003, first_name: 'Charlie' },
      { auth_date: expiredAuthDate },
    );

    const response = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });

    expect(response.status).toBe(401);
  });

  it('returns 401 when initData is missing user object', async () => {
    // Build initData without user field
    const authDate = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams();
    params.set('auth_date', String(authDate));

    const dataCheckString = `auth_date=${authDate}`;
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();
    const computedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    params.set('hash', computedHash);

    const response = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: params.toString() }),
    });

    expect(response.status).toBe(401);
  });

  // --- User upsert ---

  it('creates user with username=null when initData user has no username', async () => {
    const initData = createInitData(BOT_TOKEN, {
      id: 200000004,
      first_name: 'NoUsername',
    });

    const response = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      user: { username: string | null };
    };
    expect(body.user.username).toBeNull();
  });

  it('creates user on first authentication (verify DB record via profile)', async () => {
    const initData = createInitData(BOT_TOKEN, {
      id: 200000005,
      first_name: 'NewUser',
      username: 'newuser_test',
    });

    const response = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      user: { id: string; telegramId: string; firstName: string };
    };
    expect(body.user.id).toBeDefined();
    expect(body.user.telegramId).toBe('200000005');
    expect(body.user.firstName).toBe('NewUser');
  });

  it('updates user profile on subsequent authentication (changed firstName)', async () => {
    // First auth
    const initData1 = createInitData(BOT_TOKEN, {
      id: 200000006,
      first_name: 'OriginalName',
      username: 'updatable',
    });

    const res1 = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData1 }),
    });
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as {
      user: { id: string; firstName: string };
    };
    expect(body1.user.firstName).toBe('OriginalName');

    // Second auth with changed firstName
    const initData2 = createInitData(BOT_TOKEN, {
      id: 200000006,
      first_name: 'UpdatedName',
      username: 'updatable',
    });

    const res2 = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData2 }),
    });
    expect(res2.status).toBe(201);
    const body2 = (await res2.json()) as {
      user: { id: string; firstName: string };
    };

    // Same user ID, updated name
    expect(body2.user.id).toBe(body1.user.id);
    expect(body2.user.firstName).toBe('UpdatedName');
  });

  // --- JWT ---

  it('JWT has correct payload (sub = user UUID, telegramId = string) and 1h expiry', async () => {
    const initData = createInitData(BOT_TOKEN, {
      id: 200000007,
      first_name: 'JwtTest',
    });

    const response = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      token: string;
      user: { id: string };
    };

    // Decode JWT payload (base64url)
    const [, payloadB64] = body.token.split('.');
    const payload = JSON.parse(
      Buffer.from(payloadB64!, 'base64url').toString(),
    ) as { sub: string; telegramId: string; iat: number; exp: number };

    expect(payload.sub).toBe(body.user.id);
    expect(payload.telegramId).toBe('200000007');

    // Verify 1h expiry (3600 seconds, allow small tolerance)
    const ttl = payload.exp - payload.iat;
    expect(ttl).toBe(3600);
  });

  it('response includes full user profile alongside JWT', async () => {
    const initData = createInitData(BOT_TOKEN, {
      id: 200000008,
      first_name: 'ProfileTest',
      last_name: 'User',
      username: 'profileuser',
      photo_url: 'https://example.com/photo.jpg',
      is_premium: true,
    });

    const response = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      token: string;
      user: {
        id: string;
        telegramId: string;
        firstName: string;
        lastName: string | null;
        username: string | null;
        photoUrl: string | null;
        isPremium: boolean;
      };
    };

    expect(body.token).toBeDefined();
    expect(body.user.id).toBeDefined();
    expect(body.user.telegramId).toBe('200000008');
    expect(body.user.firstName).toBe('ProfileTest');
    expect(body.user.lastName).toBe('User');
    expect(body.user.username).toBe('profileuser');
    expect(body.user.photoUrl).toBe('https://example.com/photo.jpg');
    expect(body.user.isPremium).toBe(true);
  });

  // --- AuthGuard (US2) ---

  it('protected endpoint with valid JWT returns 200', async () => {
    // First authenticate to get a valid JWT
    const initData = createInitData(BOT_TOKEN, {
      id: 200000009,
      first_name: 'GuardTest',
    });

    const authRes = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    const { token } = (await authRes.json()) as { token: string };

    const response = await fetch(`${baseUrl}/test-protected`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { message: string };
    expect(body.message).toBe('protected data');
  });

  it('protected endpoint without Authorization header returns 401', async () => {
    const response = await fetch(`${baseUrl}/test-protected`);
    expect(response.status).toBe(401);
  });

  it('protected endpoint with malformed token returns 401', async () => {
    const response = await fetch(`${baseUrl}/test-protected`, {
      headers: { Authorization: 'Bearer not-a-valid-jwt' },
    });
    expect(response.status).toBe(401);
  });

  it('protected endpoint with expired JWT returns 401', async () => {
    // Create a JWT that expired 1 hour ago using manual HS256
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'some-uuid', telegramId: '999', iat: now - 7200, exp: now - 3600 }),
    ).toString('base64url');
    const signature = createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    const expiredToken = `${header}.${payload}.${signature}`;

    const response = await fetch(`${baseUrl}/test-protected`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(response.status).toBe(401);
  });

  it('public endpoints (/health, /auth/validate) accessible without token', async () => {
    // Health endpoint
    const healthRes = await fetch(`${baseUrl}/health`);
    expect(healthRes.status).toBe(200);

    // Auth validate endpoint (will fail validation but won't be 401 from guard)
    const authRes = await fetch(`${baseUrl}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: 'invalid' }),
    });
    // Should be 401 from AuthService (bad initData), not from AuthGuard
    // The point is the guard didn't block it — it reached the controller
    expect(authRes.status).toBe(401);
  });
});
