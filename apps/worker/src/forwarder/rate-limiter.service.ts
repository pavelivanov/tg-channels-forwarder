import Bottleneck from 'bottleneck';
import type pino from 'pino';
import {
  FORWARD_GLOBAL_RATE_LIMIT,
  FORWARD_PER_DEST_RATE_LIMIT,
} from '@aggregator/shared';

export class RateLimiterService {
  private readonly logger: pino.Logger;
  private readonly globalLimiter: Bottleneck;
  private readonly perDestGroup: Bottleneck.Group;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ service: 'RateLimiterService' });

    this.globalLimiter = new Bottleneck({
      reservoir: FORWARD_GLOBAL_RATE_LIMIT,
      reservoirRefreshAmount: FORWARD_GLOBAL_RATE_LIMIT,
      reservoirRefreshInterval: 1000,
      maxConcurrent: FORWARD_GLOBAL_RATE_LIMIT,
      minTime: 50,
    });

    this.perDestGroup = new Bottleneck.Group({
      maxConcurrent: 3,
      minTime: 200,
      reservoir: FORWARD_PER_DEST_RATE_LIMIT,
      reservoirRefreshAmount: FORWARD_PER_DEST_RATE_LIMIT,
      reservoirRefreshInterval: 60_000,
    });

    this.perDestGroup.on('created', (limiter) => {
      limiter.chain(this.globalLimiter);
    });
  }

  async execute<T>(
    destinationChannelId: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const limiter = this.perDestGroup.key(String(destinationChannelId));
    return limiter.schedule(fn);
  }

  async close(): Promise<void> {
    await this.perDestGroup.disconnect(false);
    await this.globalLimiter.disconnect(false);
  }
}
