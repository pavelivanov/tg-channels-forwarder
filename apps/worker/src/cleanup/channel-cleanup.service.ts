import type { PrismaClient } from '../generated/prisma/client.ts';
import type { ChannelManager } from '../listener/channel-manager.ts';
import type pino from 'pino';
import { CLEANUP_GRACE_PERIOD_DAYS } from '@aggregator/shared';

export interface CleanupResult {
  deactivated: number;
  failed: number;
  total: number;
}

export class ChannelCleanupService {
  private readonly logger: pino.Logger;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly channelManager: ChannelManager,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'ChannelCleanupService' });
  }

  async execute(jobId?: string): Promise<CleanupResult> {
    const startTime = Date.now();
    this.logger.info({ jobId }, 'channel_cleanup_start');

    const threshold = new Date(
      startTime - CLEANUP_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );

    const orphans = await this.prisma.sourceChannel.findMany({
      where: {
        isActive: true,
        subscriptionListChannels: { none: {} },
        OR: [
          { lastReferencedAt: { lt: threshold } },
          { lastReferencedAt: null, subscribedAt: { lt: threshold } },
        ],
      },
    });

    let deactivated = 0;
    let failed = 0;

    for (const channel of orphans) {
      try {
        await this.channelManager.leaveChannel(Number(channel.telegramId));
        await this.prisma.sourceChannel.update({
          where: { id: channel.id },
          data: { isActive: false },
        });
        this.logger.info(
          { telegramId: Number(channel.telegramId), channelId: channel.id },
          'channel_left',
        );
        deactivated++;
      } catch (error) {
        this.logger.error(
          {
            telegramId: Number(channel.telegramId),
            channelId: channel.id,
            error,
          },
          'channel_leave_failed',
        );
        failed++;
      }
    }

    const durationMs = Date.now() - startTime;
    this.logger.info(
      { deactivated, failed, total: orphans.length, durationMs },
      'channel_cleanup_complete',
    );

    return { deactivated, failed, total: orphans.length };
  }
}
