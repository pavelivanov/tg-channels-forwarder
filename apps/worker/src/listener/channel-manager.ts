import { Api } from 'telegram';
import type { TelegramClient } from 'telegram';
import type { PrismaClient } from '../generated/prisma/client.ts';
import type pino from 'pino';
import {
  JOIN_RATE_LIMIT_PER_HOUR,
  JOIN_DELAY_MIN_MS,
  JOIN_DELAY_MAX_MS,
} from '@aggregator/shared';

export interface ChannelInfo {
  telegramId: number;
  title: string;
}

export class RateLimitError extends Error {
  constructor(remainingSeconds: number) {
    super(`Rate limited. Try again in ${remainingSeconds}s`);
    this.name = 'RateLimitError';
  }
}

export class ChannelManager {
  private joinTimestamps: number[] = [];
  private readonly logger: pino.Logger;

  constructor(
    private readonly getClient: () => TelegramClient,
    private readonly prisma: PrismaClient,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'ChannelManager' });
  }

  async joinChannel(channelId: string, username: string): Promise<ChannelInfo> {
    this.checkRateLimit();

    // Random delay 2-5 seconds before joining
    const delay = JOIN_DELAY_MIN_MS + Math.random() * (JOIN_DELAY_MAX_MS - JOIN_DELAY_MIN_MS);
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const result = await this.getClient().invoke(
        new Api.channels.JoinChannel({ channel: username }),
      );

      const updates = result as Api.Updates;
      const chat = updates.chats[0];
      const telegramId = Number(chat.id);
      const title = 'title' in chat ? String(chat.title) : '';

      await this.prisma.sourceChannel.update({
        where: { id: channelId },
        data: { telegramId: BigInt(telegramId), title, isActive: true },
      });

      this.joinTimestamps.push(Date.now());

      this.logger.info({ channelId, username, telegramId, title }, 'channel_joined');

      return { telegramId, title };
    } catch (error) {
      await this.prisma.sourceChannel.delete({ where: { id: channelId } });
      this.logger.error({ channelId, username, error }, 'channel_join_failed');
      throw error;
    }
  }

  async leaveChannel(telegramId: number): Promise<void> {
    await this.getClient().invoke(
      new Api.channels.LeaveChannel({ channel: telegramId }),
    );
    this.logger.info({ telegramId }, 'channel_left');
  }

  private checkRateLimit(): void {
    const oneHourAgo = Date.now() - 3600_000;
    this.joinTimestamps = this.joinTimestamps.filter((t) => t > oneHourAgo);
    if (this.joinTimestamps.length >= JOIN_RATE_LIMIT_PER_HOUR) {
      const oldestRelevant = this.joinTimestamps[0];
      const remainingMs = oldestRelevant + 3600_000 - Date.now();
      throw new RateLimitError(Math.ceil(remainingMs / 1000));
    }
  }
}
