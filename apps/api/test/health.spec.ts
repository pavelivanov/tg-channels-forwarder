import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';

// Set required env vars before AppModule is imported
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['BOT_TOKEN'] = 'test-bot-token-for-local-development';
process.env['JWT_SECRET'] = 'test-jwt-secret-at-least-32-characters-long!!';

const { AppModule } = await import('../src/app.module.ts');
const { PrismaService } = await import('../src/prisma/prisma.service.ts');
const { BotService } = await import('../src/bot/bot.service.ts');

describe('Health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $runCommandRaw: async () => {
          throw new Error('Use the mongodb provider');
        },
        $queryRawUnsafe: async () => [{ '?column?': 1 }],
      })
      .overrideProvider(BotService)
      .useValue({ verifyBotAdmin: async () => true, onModuleInit: async () => {} })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /health returns 200 with status ok', async () => {
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' ? address?.port : address;
    const response = await fetch(`http://localhost:${port}/health`);

    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /health includes redis status in details', async () => {
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' ? address?.port : address;
    const response = await fetch(`http://localhost:${port}/health`);

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      status: string;
      details: Record<string, { status: string }>;
    };
    expect(body.details).toHaveProperty('redis');
    expect(body.details['redis']!.status).toBe('up');
  });
});
