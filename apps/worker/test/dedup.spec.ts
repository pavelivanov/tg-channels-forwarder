import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Redis from 'ioredis';
import pino from 'pino';
import { normalizeText, computeHash, DEDUP_TTL_HOURS } from '@aggregator/shared';
import { DedupService } from '../src/dedup/dedup.service.ts';

const REDIS_URL = 'redis://localhost:6379';
const TEST_PREFIX = 'dedup:';
const DEDUP_TTL_SECONDS = DEDUP_TTL_HOURS * 3600;

describe('DedupService', () => {
  let redis: Redis;
  let service: DedupService;
  const logger = pino({ level: 'silent' });

  beforeAll(() => {
    redis = new Redis(REDIS_URL);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    // Flush all test dedup keys
    const keys = await redis.keys(`${TEST_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    service = new DedupService(redis, logger);
  });

  // --- US1: Core dedup cycle ---

  describe('US1: Detect and prevent duplicate forwarding', () => {
    it('isDuplicate returns false on first check', async () => {
      const result = await service.isDuplicate(12345, 'Hello World!');
      expect(result).toBe(false);
    });

    it('isDuplicate returns true after markAsForwarded for same destination', async () => {
      await service.markAsForwarded(12345, 'Hello World!');
      const result = await service.isDuplicate(12345, 'Hello World!');
      expect(result).toBe(true);
    });

    it('isDuplicate returns false for same text but different destination', async () => {
      await service.markAsForwarded(12345, 'Hello World!');
      const result = await service.isDuplicate(67890, 'Hello World!');
      expect(result).toBe(false);
    });

    it('detects normalization-equivalent texts as duplicates', async () => {
      await service.markAsForwarded(12345, 'HELLO world!');
      const result = await service.isDuplicate(12345, 'hello World');
      expect(result).toBe(true);
    });

    it('fail-open: isDuplicate returns false when Redis is disconnected', async () => {
      const disconnectedRedis = new Redis(REDIS_URL);
      const failService = new DedupService(disconnectedRedis, logger);
      await disconnectedRedis.disconnect();

      const result = await failService.isDuplicate(12345, 'Hello World!');
      expect(result).toBe(false);
    });

    it('fail-open: markAsForwarded does not throw when Redis is disconnected', async () => {
      const disconnectedRedis = new Redis(REDIS_URL);
      const failService = new DedupService(disconnectedRedis, logger);
      await disconnectedRedis.disconnect();

      await expect(
        failService.markAsForwarded(12345, 'Hello World!'),
      ).resolves.toBeUndefined();
    });
  });

  // --- US2: Skip dedup for empty messages ---

  describe('US2: Skip dedup for empty messages', () => {
    it('isDuplicate returns false for empty string', async () => {
      const result = await service.isDuplicate(12345, '');
      expect(result).toBe(false);
    });

    it('isDuplicate returns false for whitespace-only text', async () => {
      const result = await service.isDuplicate(12345, '   ');
      expect(result).toBe(false);
    });

    it('isDuplicate returns false for punctuation-only text', async () => {
      const result = await service.isDuplicate(12345, '...!!!');
      expect(result).toBe(false);
    });

    it('markAsForwarded with empty text is a no-op', async () => {
      await service.markAsForwarded(12345, '');
      const keys = await redis.keys(`${TEST_PREFIX}12345:*`);
      expect(keys).toHaveLength(0);
    });
  });

  // --- US3: TTL verification ---

  describe('US3: Automatic expiry of dedup records', () => {
    it('markAsForwarded sets key with 72-hour TTL', async () => {
      const text = 'TTL test message';
      await service.markAsForwarded(12345, text);

      const normalized = normalizeText(text);
      const hash = computeHash(normalized);
      const key = `dedup:12345:${hash}`;

      const ttl = await redis.ttl(key);
      // Allow ±5s tolerance for test execution time
      expect(ttl).toBeGreaterThanOrEqual(DEDUP_TTL_SECONDS - 5);
      expect(ttl).toBeLessThanOrEqual(DEDUP_TTL_SECONDS);
    });
  });
});
