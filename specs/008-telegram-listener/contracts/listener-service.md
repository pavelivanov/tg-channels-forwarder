# Contract: ListenerService

**Location**: `apps/worker/src/listener/listener.service.ts`

## Overview

Core service that manages the GramJS TelegramClient lifecycle: connection, event handling, and subscription management. Orchestrates all listener subsystems.

## Constructor

```typescript
constructor(
  config: { apiId: number; apiHash: string; sessionString: string },
  logger: pino.Logger,
  queueProducer: QueueProducer,
)
```

## Public Methods

### `start(): Promise<void>`

Connects the TelegramClient to Telegram. Loads active channels from the database and registers the NewMessage event handler for those channels.

- Creates `TelegramClient` with `StringSession`, `connectionRetries: 10`, `autoReconnect: true`, `floodSleepThreshold: 120`
- Calls `client.connect()` then `client.getMe()` to activate update delivery
- Queries `SourceChannel WHERE isActive = true` via Prisma
- Registers `NewMessage` event handler filtered to active channel telegramIds
- Logs `listener_started` at info level
- **Throws** on invalid session or connection failure (fail fast — FR-015)

### `stop(): Promise<void>`

Disconnects the TelegramClient and cleans up resources.

- Calls `client.disconnect()`
- Clears album buffers and timers
- Logs `listener_stopped` at info level

### `getClient(): TelegramClient`

Returns the underlying GramJS client for use by ChannelManager.

## Event Handler (Internal)

### `handleNewMessage(event: NewMessageEvent): Promise<void>`

Processes each incoming message from subscribed channels.

1. Extract `message` from event
2. Determine channel telegramId from `message.peerId`
3. If channel not in active set → ignore (FR-007)
4. If service message (no text and no media) → ignore (edge case: service messages)
5. Extract content fields: messageId, text, caption, media info (FR-003)
6. If `message.groupedId` is present → delegate to AlbumGrouper (FR-005)
7. Otherwise → construct ForwardJob and enqueue via QueueProducer (FR-004)
8. Log `message_received` at debug level (FR-013)

## Dependencies

- `telegram` (GramJS): TelegramClient, Api, StringSession, NewMessage
- `@prisma/client`: PrismaClient for channel queries
- `QueueProducer` from `apps/worker/src/queue/queue-producer.ts`
- `AlbumGrouper` from `apps/worker/src/listener/album-grouper.ts`
- `pino` for structured logging
