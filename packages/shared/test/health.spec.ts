import { describe, it, expect } from 'vitest';
import { computeHealthStatus } from '../src/index.ts';

describe('computeHealthStatus', () => {
  it('returns healthy when all checks are up/connected', () => {
    const status = computeHealthStatus({
      postgres: { status: 'up', latencyMs: 2 },
      redis: { status: 'up', latencyMs: 1 },
      userbot: { status: 'connected' },
      bot: { status: 'connected' },
      queue: { active: 0, waiting: 0, failed: 0, dlq: 0 },
    });
    expect(status).toBe('healthy');
  });

  it('returns unhealthy when postgres is down', () => {
    const status = computeHealthStatus({
      postgres: { status: 'down', latencyMs: 3000 },
      redis: { status: 'up', latencyMs: 1 },
      userbot: { status: 'connected' },
      bot: { status: 'connected' },
      queue: { active: 0, waiting: 0, failed: 0, dlq: 0 },
    });
    expect(status).toBe('unhealthy');
  });

  it('returns unhealthy when redis is down', () => {
    const status = computeHealthStatus({
      postgres: { status: 'up', latencyMs: 2 },
      redis: { status: 'down', latencyMs: 3000 },
      userbot: { status: 'connected' },
      bot: { status: 'connected' },
      queue: { active: 0, waiting: 0, failed: 0, dlq: 0 },
    });
    expect(status).toBe('unhealthy');
  });

  it('returns degraded when userbot is disconnected', () => {
    const status = computeHealthStatus({
      postgres: { status: 'up', latencyMs: 2 },
      redis: { status: 'up', latencyMs: 1 },
      userbot: { status: 'disconnected' },
      bot: { status: 'connected' },
      queue: { active: 0, waiting: 0, failed: 0, dlq: 0 },
    });
    expect(status).toBe('degraded');
  });

  it('returns degraded when DLQ > 0', () => {
    const status = computeHealthStatus({
      postgres: { status: 'up', latencyMs: 2 },
      redis: { status: 'up', latencyMs: 1 },
      userbot: { status: 'connected' },
      bot: { status: 'connected' },
      queue: { active: 0, waiting: 0, failed: 0, dlq: 3 },
    });
    expect(status).toBe('degraded');
  });

  it('returns unhealthy when postgres is down AND userbot is disconnected (most severe wins)', () => {
    const status = computeHealthStatus({
      postgres: { status: 'down', latencyMs: 3000 },
      redis: { status: 'up', latencyMs: 1 },
      userbot: { status: 'disconnected' },
      bot: { status: 'connected' },
      queue: { active: 0, waiting: 0, failed: 0, dlq: 0 },
    });
    expect(status).toBe('unhealthy');
  });

  it('returns degraded when both DLQ > 0 and userbot disconnected', () => {
    const status = computeHealthStatus({
      postgres: { status: 'up', latencyMs: 2 },
      redis: { status: 'up', latencyMs: 1 },
      userbot: { status: 'disconnected' },
      bot: { status: 'connected' },
      queue: { active: 0, waiting: 0, failed: 0, dlq: 5 },
    });
    expect(status).toBe('degraded');
  });
});
