import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
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
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
      },
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
