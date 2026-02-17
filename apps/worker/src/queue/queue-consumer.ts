import { Worker, type Queue, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type pino from 'pino';
import type { ForwardJob } from '@aggregator/shared';

export class QueueConsumer {
  private worker: Worker;
  private readonly logger: pino.Logger;

  constructor(
    queueName: string,
    private readonly dlq: Queue,
    connection: Redis,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'QueueConsumer' });

    this.worker = new Worker<ForwardJob>(
      queueName,
      async (job: Job<ForwardJob>) => {
        this.logger.info(
          { jobId: job.id, data: job.data },
          'Processing forward job',
        );
        // Actual forwarding logic comes in Spec 09
      },
      { connection },
    );

    this.worker.on('completed', (job: Job<ForwardJob>) => {
      this.logger.debug({ jobId: job.id }, 'Job completed');
    });

    this.worker.on('failed', async (job, error) => {
      if (!job) return;
      if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
        this.logger.warn(
          { jobId: job.id, error: error.message, attempts: job.attemptsMade },
          'Job exhausted retries, moving to DLQ',
        );
        await this.dlq.add('dead-letter', {
          originalJobId: job.id,
          originalQueue: job.queueName,
          data: job.data,
          failedReason: error.message,
          attemptsMade: job.attemptsMade,
          timestamp: Date.now(),
        });
      }
    });

    this.worker.on('error', (err) => {
      this.logger.error(err, 'Worker error');
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
