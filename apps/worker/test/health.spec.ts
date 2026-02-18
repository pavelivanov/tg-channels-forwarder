import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HEALTH_CHECK_TIMEOUT_MS } from '@aggregator/shared';
import type { HealthResponse } from '@aggregator/shared';

// We'll test the health handler by importing startHealthServer and making HTTP requests
// But it's simpler to extract the handler logic. Instead, we test via the HTTP server.
import http from 'node:http';

function fetch(url: string): Promise<{ status: number; body: HealthResponse }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode!, body: JSON.parse(data) as HealthResponse });
      });
    }).on('error', reject);
  });
}

describe('Worker health endpoint', () => {
  let server: http.Server;
  let port: number;
  let mockPrisma: { $queryRaw: ReturnType<typeof vi.fn> };
  let mockRedis: { ping: ReturnType<typeof vi.fn> };
  let mockListener: { isConnected: ReturnType<typeof vi.fn> };
  let mockApi: { getMe: ReturnType<typeof vi.fn> };
  let mockForwardQueue: { getJobCounts: ReturnType<typeof vi.fn> };
  let mockDlq: { getJobCounts: ReturnType<typeof vi.fn> };
  let mockCleanupQueue: { getJobCounts: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let originalNodeEnv: string | undefined;

  beforeEach(async () => {
    vi.resetModules();
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    mockPrisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    mockRedis = { ping: vi.fn().mockResolvedValue('PONG') };
    mockListener = { isConnected: vi.fn().mockReturnValue(true) };
    mockApi = { getMe: vi.fn().mockResolvedValue({ id: 123, username: 'bot' }) };
    mockForwardQueue = {
      getJobCounts: vi.fn().mockResolvedValue({ active: 0, waiting: 0, failed: 0 }),
    };
    mockDlq = { getJobCounts: vi.fn().mockResolvedValue({ waiting: 0 }) };
    mockCleanupQueue = {
      getJobCounts: vi.fn().mockResolvedValue({ active: 0, waiting: 0, failed: 0 }),
    };
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };

    // Import fresh to avoid module caching
    const { startHealthServer } = await import('../src/health.ts');

    server = startHealthServer(0, mockLogger as never, {
      prisma: mockPrisma as never,
      redis: mockRedis as never,
      listener: mockListener as never,
      api: mockApi as never,
      forwardQueue: mockForwardQueue as never,
      dlq: mockDlq as never,
      cleanupQueue: mockCleanupQueue as never,
    });

    await new Promise<void>((resolve) => {
      server.on('listening', resolve);
    });

    const addr = server.address();
    port = typeof addr === 'object' && addr !== null ? addr.port : 0;
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('returns healthy when all dependencies are up', async () => {
    const { body } = await fetch(`http://localhost:${port}/`);

    expect(body.status).toBe('healthy');
    expect(body.uptime).toBeGreaterThan(0);
    expect(body.checks['postgres']).toMatchObject({ status: 'up' });
    expect(body.checks['redis']).toMatchObject({ status: 'up' });
    expect(body.checks['userbot']).toMatchObject({ status: 'connected' });
    expect(body.checks['bot']).toMatchObject({ status: 'connected' });
    expect(body.checks['queue']).toMatchObject({
      active: 0,
      waiting: 0,
      failed: 0,
      dlq: 0,
    });
  });

  it('returns degraded when userbot is disconnected', async () => {
    mockListener.isConnected.mockReturnValue(false);

    const { body } = await fetch(`http://localhost:${port}/`);

    expect(body.status).toBe('degraded');
    expect(body.checks['userbot']).toMatchObject({ status: 'disconnected' });
  });

  it('returns unhealthy when redis ping fails', async () => {
    mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

    const { body } = await fetch(`http://localhost:${port}/`);

    expect(body.status).toBe('unhealthy');
    expect(body.checks['redis']).toMatchObject({ status: 'down' });
  });

  it('returns degraded when DLQ > 0', async () => {
    mockDlq.getJobCounts.mockResolvedValue({ waiting: 5 });

    const { body } = await fetch(`http://localhost:${port}/`);

    expect(body.status).toBe('degraded');
    expect(body.checks['queue']).toMatchObject({ dlq: 5 });
  });

  it('reports down with high latency when postgres ping hangs past timeout', async () => {
    mockPrisma.$queryRaw.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(resolve, HEALTH_CHECK_TIMEOUT_MS + 1000),
        ),
    );

    const { body } = await fetch(`http://localhost:${port}/`);

    expect(body.status).toBe('unhealthy');
    const pgCheck = body.checks['postgres'] as { status: string; latencyMs: number };
    expect(pgCheck.status).toBe('down');
    expect(pgCheck.latencyMs).toBeGreaterThanOrEqual(HEALTH_CHECK_TIMEOUT_MS);
  });
});
