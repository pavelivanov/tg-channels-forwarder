import type { Queue } from 'bullmq';
import type pino from 'pino';
import type { ForwardJob } from '@aggregator/shared';

export class QueueProducer {
  private readonly logger: pino.Logger;

  constructor(
    private readonly queue: Queue,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'QueueProducer' });
  }

  async enqueueMessage(job: ForwardJob): Promise<void> {
    await this.queue.add('forward', job);
    this.logger.info(
      { messageId: job.messageId, sourceChannelId: job.sourceChannelId },
      'Job enqueued',
    );
  }
}
