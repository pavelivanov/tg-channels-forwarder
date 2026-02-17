import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type pino from 'pino';
import { QUEUE_NAME_CHANNEL_OPS, type ChannelOpsJob } from '@aggregator/shared';
import type { ChannelManager, ChannelInfo } from './channel-manager.ts';

export class ChannelOpsConsumer {
  private worker?: Worker;
  private readonly logger: pino.Logger;

  constructor(
    private readonly channelManager: ChannelManager,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'ChannelOpsConsumer' });
  }

  startWorker(connection: Redis): void {
    this.worker = new Worker<ChannelOpsJob>(
      QUEUE_NAME_CHANNEL_OPS,
      async (job: Job<ChannelOpsJob>) => this.processJob(job),
      {
        connection,
        concurrency: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        { jobId: job?.id, operation: job?.data.operation, error: error.message },
        'Channel ops job failed',
      );
    });

    this.worker.on('error', (err) => {
      this.logger.error(err, 'Channel ops worker error');
    });

    this.logger.info('Channel ops consumer started');
  }

  async processJob(job: Job<ChannelOpsJob>): Promise<ChannelInfo | void> {
    const { operation } = job.data;

    switch (operation) {
      case 'join':
        return this.channelManager.joinChannel(job.data.channelId, job.data.username!);
      case 'leave':
        return this.channelManager.leaveChannel(job.data.telegramId!);
    }
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
