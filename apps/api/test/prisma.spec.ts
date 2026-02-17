import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

const DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/aggregator?schema=public';

describe('Prisma schema', () => {
  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('T009: Table existence and empty queries', () => {
    it('queries User table successfully', async () => {
      const users = await prisma.user.findMany();
      expect(Array.isArray(users)).toBe(true);
    });

    it('queries SourceChannel table successfully', async () => {
      const channels = await prisma.sourceChannel.findMany();
      expect(Array.isArray(channels)).toBe(true);
    });

    it('queries SubscriptionList table successfully', async () => {
      const lists = await prisma.subscriptionList.findMany();
      expect(Array.isArray(lists)).toBe(true);
    });

    it('queries SubscriptionListChannel table successfully', async () => {
      const joins = await prisma.subscriptionListChannel.findMany();
      expect(Array.isArray(joins)).toBe(true);
    });
  });

  describe('T011a: Cascade delete behavior', () => {
    it('deleting a User cascades to SubscriptionList and SubscriptionListChannel', async () => {
      const user = await prisma.user.create({
        data: {
          telegramId: 900000001n,
          firstName: 'CascadeTest',
        },
      });

      const channel = await prisma.sourceChannel.create({
        data: {
          telegramId: 900000002n,
          title: 'Cascade Test Channel',
        },
      });

      const list = await prisma.subscriptionList.create({
        data: {
          userId: user.id,
          name: 'Cascade Test List',
          destinationChannelId: 900000003n,
        },
      });

      await prisma.subscriptionListChannel.create({
        data: {
          subscriptionListId: list.id,
          sourceChannelId: channel.id,
        },
      });

      // Delete the user — should cascade to list and join
      await prisma.user.delete({ where: { id: user.id } });

      const deletedList = await prisma.subscriptionList.findUnique({
        where: { id: list.id },
      });
      expect(deletedList).toBeNull();

      const deletedJoins = await prisma.subscriptionListChannel.findMany({
        where: { subscriptionListId: list.id },
      });
      expect(deletedJoins).toHaveLength(0);

      // Clean up source channel (not cascade-deleted by user delete)
      await prisma.sourceChannel.delete({ where: { id: channel.id } });
    });

    it('deleting a SourceChannel cascades to SubscriptionListChannel', async () => {
      const user = await prisma.user.create({
        data: {
          telegramId: 900000004n,
          firstName: 'ChannelCascade',
        },
      });

      const channel = await prisma.sourceChannel.create({
        data: {
          telegramId: 900000005n,
          title: 'Channel Cascade Test',
        },
      });

      const list = await prisma.subscriptionList.create({
        data: {
          userId: user.id,
          name: 'Channel Cascade List',
          destinationChannelId: 900000006n,
        },
      });

      const join = await prisma.subscriptionListChannel.create({
        data: {
          subscriptionListId: list.id,
          sourceChannelId: channel.id,
        },
      });

      // Delete the source channel — should cascade to join records
      await prisma.sourceChannel.delete({ where: { id: channel.id } });

      const deletedJoin = await prisma.subscriptionListChannel.findUnique({
        where: { id: join.id },
      });
      expect(deletedJoin).toBeNull();

      // Subscription list should still exist
      const existingList = await prisma.subscriptionList.findUnique({
        where: { id: list.id },
      });
      expect(existingList).not.toBeNull();

      // Clean up
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('T012: Seed data queries', () => {
    it('finds the seeded test user with expected telegramId', async () => {
      const user = await prisma.user.findUnique({
        where: { telegramId: 123456789n },
      });
      expect(user).not.toBeNull();
      expect(user!.firstName).toBe('Test');
      expect(user!.username).toBe('testuser');
      expect(user!.createdAt).toBeInstanceOf(Date);
      expect(user!.updatedAt).toBeInstanceOf(Date);
    });

    it('finds two seeded source channels', async () => {
      const channels = await prisma.sourceChannel.findMany({
        where: {
          telegramId: { in: [1001000001n, 1001000002n] },
        },
        orderBy: { telegramId: 'asc' },
      });
      expect(channels).toHaveLength(2);
      expect(channels[0]!.title).toBe('Tech News Channel');
      expect(channels[1]!.title).toBe('Dev Updates');
      expect(channels[0]!.isActive).toBe(true);
      expect(channels[1]!.isActive).toBe(true);
    });
  });

  describe('T014: PrismaService lifecycle', () => {
    it('resolves from NestJS testing module, connects on init, disconnects on close', async () => {
      process.env['DATABASE_URL'] = DATABASE_URL;

      const { PrismaModule } = await import('../src/prisma/prisma.module.ts');
      const { PrismaService } = await import('../src/prisma/prisma.service.ts');

      const moduleRef = await Test.createTestingModule({
        imports: [PrismaModule],
      }).compile();

      const service = moduleRef.get(PrismaService);
      expect(service).toBeDefined();

      // onModuleInit calls $connect()
      await service.onModuleInit();

      // Verify the service can query the database
      const users = await service.user.findMany({ take: 1 });
      expect(Array.isArray(users)).toBe(true);

      // onModuleDestroy calls $disconnect()
      await service.onModuleDestroy();
      await moduleRef.close();
    });

    it('health endpoint reports database up with real DB', async () => {
      process.env['DATABASE_URL'] = DATABASE_URL;
      process.env['REDIS_URL'] = 'redis://localhost:6379';
      process.env['NODE_ENV'] = 'test';
      process.env['PORT'] = '0';
      process.env['BOT_TOKEN'] = 'test-bot-token-for-local-development';
      process.env['JWT_SECRET'] = 'test-jwt-secret-at-least-32-characters-long!!';

      const { AppModule } = await import('../src/app.module.ts');
      const { BotService } = await import('../src/bot/bot.service.ts');

      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(BotService)
        .useValue({ verifyBotAdmin: async () => true, onModuleInit: async () => {} })
        .compile();

      const app = moduleRef.createNestApplication();
      await app.init();
      await app.listen(0);

      const address = app.getHttpServer().address();
      const port = typeof address === 'object' ? address?.port : address;
      const response = await fetch(`http://localhost:${port}/health`);
      const body = (await response.json()) as {
        status: string;
        info: { database: { status: string } };
      };

      expect(response.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.info.database.status).toBe('up');

      await app.close();
    });

    it('surfaces connection error when DATABASE_URL is unreachable', async () => {
      const originalUrl = process.env['DATABASE_URL'];
      process.env['DATABASE_URL'] =
        'postgresql://user:pass@localhost:1/nonexistent';

      try {
        const { PrismaModule } = await import('../src/prisma/prisma.module.ts');
        const { PrismaService } =
          await import('../src/prisma/prisma.service.ts');

        const moduleRef = await Test.createTestingModule({
          imports: [PrismaModule],
        }).compile();

        const service = moduleRef.get(PrismaService);

        // Attempting to query with unreachable DB should throw
        await expect(service.user.findMany()).rejects.toThrow();

        await moduleRef.close();
      } finally {
        process.env['DATABASE_URL'] = originalUrl;
      }
    });
  });
});
