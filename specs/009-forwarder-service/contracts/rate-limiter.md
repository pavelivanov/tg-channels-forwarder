# Contract: RateLimiterService

## Overview

`RateLimiterService` wraps `bottleneck` to provide two-tier rate limiting: global (20 msg/s) and per-destination (15 msg/min).

**Location**: `apps/worker/src/forwarder/rate-limiter.service.ts`

## Class Interface

```typescript
class RateLimiterService {
  constructor(logger: pino.Logger)

  /**
   * Execute an async function within rate limits for the given destination.
   * Respects both global and per-destination limits.
   * Returns when the function completes (may wait for rate limit capacity).
   */
  async execute<T>(destinationChannelId: number, fn: () => Promise<T>): Promise<T>

  /** Shut down all limiters, drain queued jobs */
  async close(): Promise<void>
}
```

## Configuration

| Tier | Limit | Bottleneck Config |
|------|-------|-------------------|
| Global | 20 msg/s | `reservoir: 20, reservoirRefreshAmount: 20, reservoirRefreshInterval: 1000, maxConcurrent: 20, minTime: 50` |
| Per-destination | 15 msg/min | `reservoir: 15, reservoirRefreshAmount: 15, reservoirRefreshInterval: 60_000, maxConcurrent: 3, minTime: 200` |

## Internal Architecture

```
Per-dest limiter (Bottleneck.Group)
  └── .chain(globalLimiter)
       └── Telegram API call
```

- `Bottleneck.Group` creates per-destination limiters on-demand, keyed by `destinationChannelId`
- Each per-dest limiter is chained to the global limiter via the `created` event
- A job must satisfy **both** limits before executing
- In-memory only (no Redis clustering needed for a single-worker deployment)

## Constants

These should be added to `@aggregator/shared`:

```typescript
export const FORWARD_GLOBAL_RATE_LIMIT = 20;       // messages per second
export const FORWARD_PER_DEST_RATE_LIMIT = 15;     // messages per minute per destination
```
