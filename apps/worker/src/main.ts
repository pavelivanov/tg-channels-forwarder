import pino from 'pino';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { Api } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { loadConfig } from './config.ts';
import { startHealthServer } from './health.ts';
import { QueueConsumer } from './queue/queue-consumer.ts';
import { QueueProducer } from './queue/queue-producer.ts';
import { ListenerService } from './listener/listener.service.ts';
import { AlbumGrouper } from './listener/album-grouper.ts';
import { ChannelManager } from './listener/channel-manager.ts';
import { ChannelOpsConsumer } from './listener/channel-ops-consumer.ts';
import { DedupService } from './dedup/dedup.service.ts';
import { MessageSender } from './forwarder/message-sender.ts';
import { RateLimiterService } from './forwarder/rate-limiter.service.ts';
import { ForwarderService } from './forwarder/forwarder.service.ts';
import { getPrisma, disconnectPrisma } from './prisma.ts';
import { ChannelCleanupService } from './cleanup/channel-cleanup.service.ts';
import { ChannelCleanupConsumer } from './cleanup/channel-cleanup.consumer.ts';
import {
  QUEUE_NAME_FORWARD,
  QUEUE_NAME_FORWARD_DLQ,
  QUEUE_NAME_CHANNEL_CLEANUP,
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

// grammY Bot API (send-only, no polling)
const api = new Api(config.BOT_TOKEN);
api.config.use(autoRetry());

// Forwarder service
const prisma = getPrisma();
const dedupService = new DedupService(connection, logger);
const messageSender = new MessageSender(api, logger);
const rateLimiterService = new RateLimiterService(logger);
const forwarderService = new ForwarderService(
  messageSender,
  prisma,
  dedupService,
  rateLimiterService,
  logger,
);

// Consumer (starts processing in constructor)
new QueueConsumer(QUEUE_NAME_FORWARD, dlq, connection, forwarderService, logger);

// Queue producer for the listener
const queueProducer = new QueueProducer(forwardQueue, logger);

// Telegram Listener
const listener = new ListenerService(
  {
    apiId: config.TELEGRAM_API_ID,
    apiHash: config.TELEGRAM_API_HASH,
    sessionString: config.TELEGRAM_SESSION,
  },
  logger,
  queueProducer,
  prisma,
);

// Album grouper for media groups
const albumGrouper = new AlbumGrouper(
  (job) => queueProducer.enqueueMessage(job),
  logger,
);
listener.setAlbumGrouper(albumGrouper);

// Channel operations (join/leave) via BullMQ
const channelManager = new ChannelManager(
  () => listener.getClient(),
  prisma,
  logger,
);
const channelOpsConsumer = new ChannelOpsConsumer(channelManager, logger);
channelOpsConsumer.startWorker(connection);

// Channel cleanup (scheduled daily at 3:00 AM UTC)
const cleanupQueue = new Queue(QUEUE_NAME_CHANNEL_CLEANUP, { connection });
await cleanupQueue.upsertJobScheduler(
  'daily-channel-cleanup',
  { pattern: '0 0 3 * * *' },
  { name: 'channel-cleanup', opts: { attempts: 1 } },
);
const cleanupService = new ChannelCleanupService(prisma, channelManager, logger);
const cleanupConsumer = new ChannelCleanupConsumer(cleanupService, logger);
cleanupConsumer.startWorker(connection);

listener.start().catch((err) => {
  logger.error(err, 'Failed to start listener');
  process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down...');
  await listener.stop();
  await cleanupConsumer.close();
  await rateLimiterService.close();
  await disconnectPrisma();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Health
startHealthServer(config.WORKER_HEALTH_PORT, logger, forwardQueue, dlq, cleanupQueue);

logger.info('Worker started successfully');
