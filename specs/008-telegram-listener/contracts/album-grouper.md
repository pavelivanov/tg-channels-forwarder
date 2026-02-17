# Contract: AlbumGrouper

**Location**: `apps/worker/src/listener/album-grouper.ts`

## Overview

Collects album messages (sharing the same `groupedId`) within a 300ms window and emits a single combined ForwardJob. Pure runtime state — no persistence.

## Constructor

```typescript
constructor(
  onFlush: (job: ForwardJob) => Promise<void>,
  logger: pino.Logger,
)
```

- `onFlush`: callback invoked when an album group is ready (typically `queueProducer.enqueueMessage`)

## Public Methods

### `addMessage(job: ForwardJob): void`

Adds a message to the album buffer keyed by `job.mediaGroupId`.

- If group doesn't exist: create buffer entry, start 300ms timer
- If group exists: add to buffer, reset 300ms timer
- If group reaches 10 messages (ALBUM_MAX_SIZE): flush immediately (FR-005)
- **Precondition**: `job.mediaGroupId` must be defined

### `flush(groupId: string): void`

Flushes a specific album group.

- Takes the first message as the base ForwardJob
- Sets `mediaGroup` to the array of all collected ForwardJob entries
- Calls `onFlush(combinedJob)`
- Removes group from the buffer map
- Clears the timer
- Logs album flush at debug level with groupId and message count

### `clear(): void`

Clears all pending groups and cancels all timers. Called during shutdown.

## Internal State

```typescript
private groups: Map<string, {
  messages: ForwardJob[];
  timer: NodeJS.Timeout;
  createdAt: number;
}>
```

## Constants (from `@aggregator/shared`)

| Constant | Value | Description |
|----------|-------|-------------|
| ALBUM_GROUP_TIMEOUT_MS | 300 | Timer reset window |
| ALBUM_MAX_SIZE | 10 | Max messages per group before forced flush |

## Behavior

- Timer fires 300ms after the **last** message in the group (FR-006)
- Each new message in the group resets the timer
- Groups are removed from the map after flush
- Memory-safe: no unbounded growth (max 10 per group, timer ensures cleanup)
