# Research: BullMQ Queue Setup

**Feature**: 007-bullmq-queue-setup
**Date**: 2026-02-17

## R1: BullMQ Package & Import Patterns

**Decision**: Use `bullmq` package (single package for Queue + Worker + Job types).

**Rationale**: BullMQ is the successor to Bull, purpose-built for Redis-backed job queues in Node.js. It has first-class TypeScript support with named exports that work with `"module": "NodeNext"`.

**Import pattern**:
```typescript
import { Queue, Worker, Job } from 'bullmq';
```

**Alternatives considered**: Bull (legacy, no longer maintained), Agenda (MongoDB-based — conflicts with constitution VII requiring Redis for queues), custom Redis pub/sub (too much custom code, violates constitution I preference for established libraries).

## R2: Worker Redis Connection Requirements

**Decision**: Workers MUST use a Redis connection with `maxRetriesPerRequest: null`. Producers (Queue instances) can use the default.

**Rationale**: BullMQ Workers use blocking Redis commands (`BRPOPLPUSH`/`BLMOVE`) that need to retry indefinitely during temporary disconnections. Without `maxRetriesPerRequest: null`, BullMQ throws an error.

**Pattern for worker app** (pure consumer, no HTTP handlers): A single connection with `maxRetriesPerRequest: null` is safe for both Queue and Worker instances since there are no request/response cycles needing fast failure.

**Pattern for API app** (producer only): Use the existing `REDIS_CLIENT` ioredis instance from `RedisModule` (no `maxRetriesPerRequest: null` — fast failure is correct for HTTP contexts).

## R3: Dead Letter Queue Pattern

**Decision**: Manual DLQ via Worker `failed` event listener. BullMQ does NOT have built-in DLQ support.

**Rationale**: The standard community pattern is to listen for the `failed` event on the Worker, check if `job.attemptsMade >= job.opts.attempts`, and push the job data to a separate Queue (`message-forward-dlq`).

**Key detail**: The `failed` event fires on every failed attempt (not just the final one), so the `attemptsMade` check is essential to avoid premature DLQ moves.

**DLQ payload**: Store `originalJobId`, `originalQueue`, `data`, `failedReason`, `attemptsMade`, `timestamp` for full traceability.

## R4: Job Options Configuration

**Decision**: Set `defaultJobOptions` on the Queue instance.

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
}
```

**Rationale**: Exponential backoff with 5s base gives retries at ~5s, ~10s, ~20s — total ~35s before DLQ. `removeOnComplete` and `removeOnFail` use the `{ count: N }` form to keep the N most recent jobs in history.

## R5: Queue Health Statistics

**Decision**: Use `Queue.getJobCounts()` to retrieve job state counts.

```typescript
const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
// Returns: { waiting: N, active: N, failed: N, delayed: N }
```

**For DLQ depth**: Call `dlq.getJobCounts('waiting')` on the DLQ Queue instance.

**Rationale**: `getJobCounts()` is the official BullMQ API for retrieving aggregate statistics. It accepts variadic state strings and returns a `Record<string, number>`.

## R6: Bull Board Dashboard Integration

**Decision**: Use `@bull-board/api` + `@bull-board/express` for a standalone Express-mounted dashboard at `/admin/queues` on the worker's health server.

**Packages**: `@bull-board/api`, `@bull-board/express`

**Pattern**: Mount `ExpressAdapter` on the worker's HTTP health server, wrapping both the main queue and DLQ in `BullMQAdapter`.

**Alternative considered**: `@bull-board/nestjs` for the API app. Rejected because the queue producer/consumer live in the worker app (not NestJS), so the dashboard should be co-located with the worker.

## R7: Connection Architecture

**Decision**:
- **Worker app**: Create a dedicated Redis connection with `maxRetriesPerRequest: null` for BullMQ (separate from the existing ioredis used by DedupService which uses the default).
- **API app**: If the API needs to enqueue jobs (future), reuse the existing `REDIS_CLIENT` from `RedisModule`. For now, no changes to the API's Redis setup.

**Rationale**: The worker app is a pure consumer, so `maxRetriesPerRequest: null` is safe for all BullMQ operations. The DedupService uses its own Redis instance (created in test or passed externally). Keeping them separate avoids interference.

## R8: ForwardJob in Shared Package

**Decision**: Define `ForwardJob` interface in `packages/shared/src/queue/index.ts` and export from the shared package root. Include queue name constants alongside.

**Rationale**: Both the worker (consumer) and potentially the API (future producer) need the same job type. The shared package already exports constants and dedup utilities — queue types are a natural addition.

**Fields**:
```typescript
export interface ForwardJob {
  messageId: number;
  sourceChannelId: number;
  text?: string;
  caption?: string;
  mediaType?: string;
  mediaFileId?: string;
  mediaGroupId?: string;
  mediaGroup?: ForwardJob[];
  timestamp: number;
}
```
