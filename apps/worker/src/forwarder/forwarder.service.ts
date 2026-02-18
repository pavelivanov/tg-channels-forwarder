import type pino from 'pino';
import type { ForwardJob } from '@aggregator/shared';
import type { DedupService } from '../dedup/dedup.service.ts';
import type { MessageSender } from './message-sender.ts';
import type { RateLimiterService } from './rate-limiter.service.ts';
import type { PrismaClient } from '../generated/prisma/client.ts';

export class ForwarderService {
  private readonly logger: pino.Logger;

  constructor(
    private readonly messageSender: MessageSender,
    private readonly prisma: PrismaClient,
    private readonly dedupService: DedupService,
    private readonly rateLimiter: RateLimiterService,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'ForwarderService' });
  }

  async forward(job: ForwardJob): Promise<void> {
    const { messageId, sourceChannelId, correlationId } = job;
    const fwdLogger = correlationId
      ? this.logger.child({ correlationId })
      : this.logger;
    const text = job.text ?? job.caption ?? '';

    const lists = await this.prisma.subscriptionList.findMany({
      where: {
        isActive: true,
        subscriptionListChannels: {
          some: {
            sourceChannel: {
              telegramId: BigInt(sourceChannelId),
            },
          },
        },
      },
      select: { destinationChannelId: true },
    });

    const uniqueDestinations = [
      ...new Set(lists.map((l) => Number(l.destinationChannelId))),
    ];

    if (uniqueDestinations.length === 0) {
      fwdLogger.debug({ sourceChannelId, messageId }, 'no_destinations');
      return;
    }

    for (const destinationChannelId of uniqueDestinations) {
      const isDup = await this.dedupService.isDuplicate(destinationChannelId, text);
      if (isDup) {
        fwdLogger.info(
          { sourceChannelId, destinationChannelId, messageId },
          'message_deduplicated',
        );
        continue;
      }

      await this.rateLimiter.execute(destinationChannelId, async () => {
        await this.messageSender.send(destinationChannelId, job);
      });

      await this.dedupService.markAsForwarded(destinationChannelId, text);
      fwdLogger.info(
        { sourceChannelId, destinationChannelId, messageId, mediaType: job.mediaType },
        'message_forwarded',
      );
    }
  }
}
