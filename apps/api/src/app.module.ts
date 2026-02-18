import crypto from 'node:crypto';
import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { LOG_REDACT_PATHS } from '@aggregator/shared';
import { AuthModule } from './auth/auth.module.ts';
import { BotModule } from './bot/bot.module.ts';
import { ChannelsModule } from './channels/channels.module.ts';
import { HealthModule } from './health/health.module.ts';
import { PrismaModule } from './prisma/prisma.module.ts';
import { RedisModule } from './redis/redis.module.ts';
import { SubscriptionListsModule } from './subscription-lists/subscription-lists.module.ts';
import { validate } from './env.schema.ts';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      isGlobal: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          process.env['LOG_LEVEL'] ??
          (process.env['NODE_ENV'] !== 'production' ? 'debug' : 'info'),
        genReqId: (req: { headers?: Record<string, string | string[] | undefined> }) =>
          (req.headers?.['x-request-id'] as string) ?? crypto.randomUUID(),
        redact: LOG_REDACT_PATHS,
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
      },
      exclude: [{ method: RequestMethod.ALL, path: 'health' }],
    }),
    PrismaModule,
    AuthModule,
    BotModule,
    ChannelsModule,
    RedisModule,
    SubscriptionListsModule,
    HealthModule,
  ],
})
export class AppModule {}
