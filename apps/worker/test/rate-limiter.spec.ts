import { describe, it, expect, vi, afterEach } from 'vitest';
import type pino from 'pino';
import { RateLimiterService } from '../src/forwarder/rate-limiter.service.ts';

function createMockLogger(): pino.Logger {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => logger),
  } as unknown as pino.Logger;
  return logger;
}

describe('RateLimiterService', () => {
  let logger: pino.Logger;
  let service: RateLimiterService;

  afterEach(async () => {
    if (service) {
      await service.close();
    }
  });

  describe('execute()', () => {
    it('calls the wrapped function and returns its result', async () => {
      logger = createMockLogger();
      service = new RateLimiterService(logger);

      const result = await service.execute(100, async () => 'hello');

      expect(result).toBe('hello');
    });

    it('passes through errors from the wrapped function', async () => {
      logger = createMockLogger();
      service = new RateLimiterService(logger);

      await expect(
        service.execute(200, async () => {
          throw new Error('upstream failure');
        }),
      ).rejects.toThrow('upstream failure');
    });
  });

  describe('close()', () => {
    it('completes without error', async () => {
      logger = createMockLogger();
      service = new RateLimiterService(logger);

      await expect(service.close()).resolves.toBeUndefined();
    });
  });
});
