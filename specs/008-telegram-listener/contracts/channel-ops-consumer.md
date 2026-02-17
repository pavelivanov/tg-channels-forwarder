# Contract: ChannelOpsConsumer

**Location**: `apps/worker/src/listener/channel-ops-consumer.ts`

## Overview

BullMQ Worker that processes channel join/leave commands from the API via the `channel-ops` queue. Bridges the API layer to the worker's ChannelManager.

## Constructor

```typescript
constructor(
  channelManager: ChannelManager,
  connection: Redis,
  logger: pino.Logger,
)
```

## Queue Configuration

| Property | Value |
|----------|-------|
| Queue name | `channel-ops` (QUEUE_NAME_CHANNEL_OPS) |
| Concurrency | 1 (serial processing to respect rate limits) |
| Default attempts | 1 (no retry — failures reported immediately) |
| removeOnComplete | `{ count: 100 }` |
| removeOnFail | `{ count: 500 }` |

## Job Payload

```typescript
interface ChannelOpsJob {
  operation: 'join' | 'leave';
  channelId: string;      // UUID of SourceChannel record
  username?: string;       // Required for join
  telegramId?: number;     // Required for leave
}
```

## Processing Logic

### `process(job: Job<ChannelOpsJob>): Promise<ChannelInfo | void>`

```
switch (job.data.operation):
  case 'join':
    return channelManager.joinChannel(job.data.channelId, job.data.username!)
  case 'leave':
    return channelManager.leaveChannel(job.data.telegramId!)
```

- Job result is stored by BullMQ and can be retrieved by the API
- Failed jobs store the error message in the job's `failedReason`

## API-Side Producer

**Location**: `apps/api/src/channels/channels.service.ts` (modification)

The existing `findOrCreate()` method gains an additional step: after creating the pending SourceChannel record, enqueue a `channel-ops` job:

```typescript
// After creating channel with isActive: false
await this.channelOpsQueue.add('join', {
  operation: 'join',
  channelId: channel.id,
  username: channel.username,
});
```

The API returns immediately with the pending channel. The worker processes the join asynchronously and updates the record.

## Constants (from `@aggregator/shared`)

| Constant | Value |
|----------|-------|
| QUEUE_NAME_CHANNEL_OPS | `"channel-ops"` |
