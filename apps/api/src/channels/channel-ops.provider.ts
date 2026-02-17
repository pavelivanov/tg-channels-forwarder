import { Queue, type ConnectionOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module.ts';
import { QUEUE_NAME_CHANNEL_OPS } from '@aggregator/shared';

export const CHANNEL_OPS_QUEUE = 'CHANNEL_OPS_QUEUE';

export const channelOpsQueueProvider = {
  provide: CHANNEL_OPS_QUEUE,
  useFactory: (redis: Redis): Queue => {
    return new Queue(QUEUE_NAME_CHANNEL_OPS, {
      connection: redis as unknown as ConnectionOptions,
    });
  },
  inject: [REDIS_CLIENT],
};
