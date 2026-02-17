import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.ts';
import { CHANNEL_OPS_QUEUE } from './channel-ops.provider.ts';

export interface ChannelResponse {
  id: string;
  telegramId: string;
  username: string | null;
  title: string;
  subscribedAt: Date;
  isActive: boolean;
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CHANNEL_OPS_QUEUE) @Optional() private readonly channelOpsQueue?: Queue,
  ) {}

  async findAllActive(): Promise<ChannelResponse[]> {
    const channels = await this.prisma.sourceChannel.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' },
    });

    return channels.map((ch) => ({
      id: ch.id,
      telegramId: String(ch.telegramId),
      username: ch.username,
      title: ch.title,
      subscribedAt: ch.subscribedAt,
      isActive: ch.isActive,
    }));
  }

  async findOrCreate(
    username: string,
  ): Promise<{ channel: ChannelResponse; created: boolean }> {
    const existing = await this.prisma.sourceChannel.findFirst({
      where: { username },
    });

    if (existing) {
      return {
        channel: {
          id: existing.id,
          telegramId: String(existing.telegramId),
          username: existing.username,
          title: existing.title,
          subscribedAt: existing.subscribedAt,
          isActive: existing.isActive,
        },
        created: false,
      };
    }

    try {
      const placeholderId = -BigInt(Date.now());
      const created = await this.prisma.sourceChannel.create({
        data: {
          telegramId: placeholderId,
          username,
          title: username,
          isActive: false,
        },
      });

      this.logger.log(`New pending channel created: ${username}`);

      if (this.channelOpsQueue) {
        await this.channelOpsQueue.add('join', {
          operation: 'join',
          channelId: created.id,
          username: created.username,
        });
      }

      return {
        channel: {
          id: created.id,
          telegramId: String(created.telegramId),
          username: created.username,
          title: created.title,
          subscribedAt: created.subscribedAt,
          isActive: created.isActive,
        },
        created: true,
      };
    } catch (error: unknown) {
      // Race condition: another request created it between our find and create
      // Prisma unique constraint violation code: P2002
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        const found = await this.prisma.sourceChannel.findFirst({
          where: { username },
        });

        if (found) {
          return {
            channel: {
              id: found.id,
              telegramId: String(found.telegramId),
              username: found.username,
              title: found.title,
              subscribedAt: found.subscribedAt,
              isActive: found.isActive,
            },
            created: false,
          };
        }
      }

      throw error;
    }
  }
}
