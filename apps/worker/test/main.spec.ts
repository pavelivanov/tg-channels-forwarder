import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Worker startup', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('logs structured startup message via pino', async () => {
    const logMessages: Array<{ msg: string; level: number }> = [];

    vi.doMock('pino', () => {
      const createLogger = () => {
        const logger = {
          info: (objOrMsg: unknown, maybeMsg?: string) => {
            const msg =
              typeof objOrMsg === 'string' ? objOrMsg : (maybeMsg ?? '');
            logMessages.push({ msg, level: 30 });
          },
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
          child: () => logger,
        };
        return logger;
      };
      return { default: createLogger };
    });

    vi.doMock('../src/health.ts', () => ({
      startHealthServer: vi.fn(),
    }));

    await import('../src/main.ts');

    expect(logMessages.length).toBeGreaterThanOrEqual(1);
    const startupMsg = logMessages.find(
      (m) =>
        m.msg.toLowerCase().includes('worker start'),
    );
    expect(startupMsg).toBeDefined();
  });
});
