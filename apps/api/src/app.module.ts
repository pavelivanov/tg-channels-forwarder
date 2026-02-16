import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.ts';
import { ChannelsModule } from './channels/channels.module.ts';
import { HealthModule } from './health/health.module.ts';
import { PrismaModule } from './prisma/prisma.module.ts';
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
    ChannelsModule,
    HealthModule,
  ],
})
export class AppModule {}
