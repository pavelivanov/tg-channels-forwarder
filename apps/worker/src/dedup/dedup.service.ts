import type { Redis } from 'ioredis';
import type pino from 'pino';
import { normalizeText, computeHash, DEDUP_TTL_HOURS } from '@aggregator/shared';

const DEDUP_TTL_SECONDS = DEDUP_TTL_HOURS * 3600;

export class DedupService {
  private readonly logger: pino.Logger;

  constructor(
    private readonly redis: Redis,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ service: 'DedupService' });
  }

  async isDuplicate(
    destinationChannelId: number,
    text: string,
  ): Promise<boolean> {
    const normalized = normalizeText(text);
    if (normalized === '') return false;

    const hash = computeHash(normalized);
    const key = `dedup:${String(destinationChannelId)}:${hash}`;

    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.warn(
        { err: error, key },
        'Redis unavailable during dedup check, failing open',
      );
      return false;
    }
  }

  async markAsForwarded(
    destinationChannelId: number,
    text: string,
  ): Promise<void> {
    const normalized = normalizeText(text);
    if (normalized === '') return;

    const hash = computeHash(normalized);
    const key = `dedup:${String(destinationChannelId)}:${hash}`;

    try {
      await this.redis.set(key, '1', 'EX', DEDUP_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(
        { err: error, key },
        'Redis unavailable during markAsForwarded, skipping',
      );
    }
  }
}
