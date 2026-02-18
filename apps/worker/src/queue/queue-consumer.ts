import { Worker, type Queue, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type pino from 'pino';
import type { ForwardJob } from '@aggregator/shared';
import type { ForwarderService } from '../forwarder/forwarder.service.ts';

export class QueueConsumer {
  private worker: Worker;
  private readonly logger: pino.Logger;

  constructor(
    queueName: string,
    private readonly dlq: Queue,
    connection: Redis,
    private readonly forwarderService: ForwarderService,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'QueueConsumer' });

    this.worker = new Worker<ForwardJob>(
      queueName,
      async (job: Job<ForwardJob>) => {
        const jobLogger = job.data.correlationId
          ? this.logger.child({ correlationId: job.data.correlationId })
          : this.logger;
        jobLogger.info(
          { jobId: job.id, data: job.data },
          'job_received',
        );
        await this.forwarderService.forward(job.data);
        jobLogger.info({ jobId: job.id }, 'job_completed');
      },
      { connection },
    );

    this.worker.on('completed', (job: Job<ForwardJob>) => {
      this.logger.debug({ jobId: job.id }, 'Job completed');
    });

    this.worker.on('failed', async (job, error) => {
      if (!job) return;
      const jobLogger = job.data.correlationId
        ? this.logger.child({ correlationId: job.data.correlationId })
        : this.logger;
      if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
        jobLogger.warn(
          { jobId: job.id, error: error.message, attempts: job.attemptsMade },
          'job_failed',
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
