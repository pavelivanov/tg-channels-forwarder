import pino from 'pino';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { loadConfig } from './config.ts';
import { startHealthServer } from './health.ts';
import { QueueConsumer } from './queue/queue-consumer.ts';
import {
  QUEUE_NAME_FORWARD,
  QUEUE_NAME_FORWARD_DLQ,
  QUEUE_MAX_ATTEMPTS,
  QUEUE_BACKOFF_DELAY,
  QUEUE_KEEP_COMPLETED,
  QUEUE_KEEP_FAILED,
} from '@aggregator/shared';

const config = loadConfig();

const logger = pino({
  transport:
    config.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
});

logger.info({ env: config.NODE_ENV }, 'Worker starting');

// BullMQ connection (maxRetriesPerRequest: null required for Worker)
const connection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Queues
const forwardQueue = new Queue(QUEUE_NAME_FORWARD, {
  connection,
  defaultJobOptions: {
    attempts: QUEUE_MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: QUEUE_BACKOFF_DELAY },
    removeOnComplete: { count: QUEUE_KEEP_COMPLETED },
    removeOnFail: { count: QUEUE_KEEP_FAILED },
  },
});

const dlq = new Queue(QUEUE_NAME_FORWARD_DLQ, { connection });

// Consumer (starts processing in constructor)
new QueueConsumer(QUEUE_NAME_FORWARD, dlq, connection, logger);

// Health
startHealthServer(config.WORKER_HEALTH_PORT, logger, forwardQueue, dlq);

logger.info('Worker started successfully');
