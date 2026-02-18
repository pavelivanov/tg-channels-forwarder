import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type pino from 'pino';
import { QUEUE_NAME_CHANNEL_CLEANUP } from '@aggregator/shared';
import type { ChannelCleanupService, CleanupResult } from './channel-cleanup.service.ts';

export class ChannelCleanupConsumer {
  private worker?: Worker;
  private readonly logger: pino.Logger;

  constructor(
    private readonly cleanupService: ChannelCleanupService,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'ChannelCleanupConsumer' });
  }

  startWorker(connection: Redis): void {
    this.worker = new Worker<Record<string, unknown>>(
      QUEUE_NAME_CHANNEL_CLEANUP,
      async (job: Job<Record<string, unknown>>) => this.processJob(job),
      {
        connection,
        concurrency: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        { jobId: job?.id, error: error.message },
        'Channel cleanup job failed',
      );
    });

    this.worker.on('error', (err) => {
      this.logger.error(err, 'Channel cleanup worker error');
    });

    this.logger.info('Channel cleanup consumer started');
  }

  async processJob(job: Job<Record<string, unknown>>): Promise<CleanupResult> {
    return this.cleanupService.execute(job.id);
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
