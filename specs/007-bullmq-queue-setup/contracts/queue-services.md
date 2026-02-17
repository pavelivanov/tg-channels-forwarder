# Contracts: Queue Services

**Feature**: 007-bullmq-queue-setup
**Date**: 2026-02-17

## QueueProducer Service

**Location**: `apps/worker/src/queue/queue-producer.ts`

### enqueueMessage

Adds a forwarding job to the main queue.

```typescript
class QueueProducer {
  constructor(queue: Queue, logger: pino.Logger);

  async enqueueMessage(job: ForwardJob): Promise<void>;
}
```

**Behavior**:
- Validates that `job.messageId` and `job.sourceChannelId` are present
- Adds the job to the `message-forward` queue with a job name of `forward`
- Uses the queue's `defaultJobOptions` (3 attempts, exponential backoff, retention limits)
- Logs at `info` level with `messageId` and `sourceChannelId` in context
- On Redis error: logs at `error` level, throws (fail-closed — caller must handle)

**Job name**: `forward` (used as the BullMQ job name for all forwarding jobs)

---

## QueueConsumer Service

**Location**: `apps/worker/src/queue/queue-consumer.ts`

### Constructor & Processing

```typescript
class QueueConsumer {
  constructor(
    queueName: string,
    dlq: Queue,
    connection: Redis,
    logger: pino.Logger,
  );

  // Graceful shutdown
  async close(): Promise<void>;
}
```

**Behavior**:
- Creates a BullMQ `Worker` for `message-forward` queue
- Job processor: logs the job payload at `info` level, then returns (job marked complete)
- Listens to `failed` event: if `attemptsMade >= attempts`, adds to DLQ queue with full context
- Listens to `error` event: logs at `error` level
- Listens to `completed` event: logs at `debug` level

**DLQ move payload**:
```typescript
{
  originalJobId: job.id,
  originalQueue: 'message-forward',
  data: job.data,           // ForwardJob
  failedReason: error.message,
  attemptsMade: job.attemptsMade,
  timestamp: Date.now(),
}
```

---

## Health Check Extension

### Worker Health Server

**Location**: `apps/worker/src/health.ts` (existing, to be extended)

Current response:
```json
{ "status": "ok" }
```

Extended response:
```json
{
  "status": "ok",
  "queue": {
    "active": 0,
    "waiting": 0,
    "failed": 0,
    "delayed": 0,
    "dlq": 0
  }
}
```

**Implementation**: The health server receives a reference to the main Queue and DLQ Queue instances. Calls `queue.getJobCounts('active', 'waiting', 'failed', 'delayed')` and `dlq.getJobCounts('waiting')` on each health check request.

### API Health Endpoint

**Location**: `apps/api/src/health/health.controller.ts` (existing)

The API health endpoint does NOT need queue stats for this feature. The queue lives in the worker — the API only needs Redis connectivity (already covered). Queue stats are exposed via the worker's health server.

**Rationale**: The API app is a producer (future) but doesn't own the queue consumer. Queue observability belongs to the worker process.

---

## Bull Board Dashboard

**Location**: `apps/worker/src/dashboard.ts`

**Route**: `/admin/queues` on the worker health server

**Setup**:
```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
```

**Behavior**:
- Creates an Express adapter mounted at `/admin/queues`
- Registers both `message-forward` and `message-forward-dlq` queues
- Serves the bull-board UI (HTML/JS/CSS) at the configured path
- No authentication (development-only tool)
- Only initialized when `NODE_ENV !== 'production'`
