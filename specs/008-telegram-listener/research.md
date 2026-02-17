# Research: Telegram Listener Service

**Feature**: 008-telegram-listener
**Date**: 2026-02-17

## R1: GramJS Package & Import Patterns

**Decision**: Use the `telegram` npm package (GramJS) — the standard MTProto client library for Node.js/TypeScript.

**Rationale**: GramJS is a full MTProto client that connects directly to Telegram's servers as a user account. Unlike grammY (Bot API), GramJS can join/leave channels as a user and receive all channel post updates in real-time. It ships with TypeScript declarations and works with ESM via Node's CJS interop.

**Import patterns**:
```typescript
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, type NewMessageEvent } from 'telegram/events';
import { FloodWaitError } from 'telegram/errors';
```

**Package**: `telegram@^2.26.22`, MIT license, CJS with `.d.ts` types.

**Alternatives considered**: grammY (Bot API only — cannot act as a user account, cannot join channels).

## R2: Session & Connection Setup

**Decision**: Use `StringSession` with session string from environment variable (`TELEGRAM_SESSION`). The session is pre-generated via a one-time interactive login script.

**Rationale**: `StringSession` serializes the entire auth state into a single string, ideal for server deployments. No filesystem session files needed.

**Connection options**:
```typescript
const client = new TelegramClient(
  new StringSession(sessionString),
  apiId,
  apiHash,
  {
    connectionRetries: 10,
    retryDelay: 1000,
    autoReconnect: true,
    floodSleepThreshold: 60,
  },
);
```

**Important**: After `connect()`, call `await client.getMe()` to trigger Telegram to start sending update events.

## R3: NewMessage Event Handling

**Decision**: Use `client.addEventHandler()` with `new NewMessage({ chats: channelIds, incoming: true })` to listen for messages from specific channels.

**Rationale**: The `NewMessage` event builder natively supports filtering by chat IDs via the `chats` parameter and by direction via `incoming`. Passing numeric channel IDs avoids username resolution API calls.

**Key detail**: Channel IDs in GramJS are `BigInt`-compatible numbers. The `NewMessageEvent` exposes `event.message` (an `Api.Message` object) with all content fields.

## R4: Message Content Extraction

**Decision**: Use accessor properties on `Api.Message` to extract content. Media type is determined by checking `message.photo`, `message.video`, `message.document`, etc. Album grouping uses `message.groupedId`.

**Rationale**: GramJS provides typed accessors for each media type. The `groupedId` field (a `BigInteger`) is shared across all messages in the same album.

**Media type mapping**:
| Accessor | ForwardJob mediaType |
|----------|---------------------|
| `message.photo` | `"photo"` |
| `message.video` | `"video"` |
| `message.document` | `"document"` |
| `message.gif` | `"animation"` |
| `message.audio` | `"audio"` |
| `message.sticker` | `"sticker"` |
| `message.voice` | `"voice"` |
| `message.videoNote` | `"video_note"` |

**File IDs**: GramJS does NOT use Bot API-style string `file_id`. Media objects are TL objects (`Api.Photo`, `Api.Document`) with `id` (BigInteger), `accessHash`, and `fileReference`. For `ForwardJob.mediaFileId`, serialize as `"type:id:accessHash"` or store the raw ID as a string.

## R5: Channel Join/Leave via MTProto

**Decision**: Use `client.invoke(new Api.channels.JoinChannel({ channel: username }))` and `client.invoke(new Api.channels.LeaveChannel({ channel }))`. Resolve username to entity via `client.getEntity(username)`.

**Rationale**: These are the standard TL methods for channel membership. GramJS accepts `EntityLike` (string username or numeric ID), resolving internally.

**Join returns**: `Api.Updates` object. Extract the channel entity from `updates.chats[0]` to get `id` and `title`.

**Leave accepts**: Numeric channel ID or entity.

## R6: FloodWaitError Handling

**Decision**: Import `FloodWaitError` from `telegram/errors`. Use `instanceof` checks. GramJS auto-handles waits below `floodSleepThreshold` (default 60s). For longer waits, catch and sleep manually.

**Rationale**: GramJS has built-in flood wait handling for short waits. The error hierarchy is `CustomError → RPCError → FloodError → FloodWaitError` with a `seconds: number` property.

**Pattern**: Set `floodSleepThreshold: 120` on the client to auto-handle waits up to 2 minutes. For waits above threshold, catch `FloodWaitError` and implement manual sleep+retry.

## R7: Auto-Reconnect

**Decision**: GramJS has built-in auto-reconnection via `autoReconnect: true` (default) and configurable `connectionRetries`. No manual reconnection logic needed for the base case.

**Rationale**: The library internally handles TCP disconnections, re-establishes the MTProto session, and resumes update delivery. Set `connectionRetries: 10` for production resilience.

**Additional resilience**: Add a periodic heartbeat (`client.getMe()` every N minutes) and process-level supervision (health check endpoint, Docker restart policy).

## R8: API-to-Worker Communication for Join/Leave

**Decision**: Use a BullMQ queue for API-to-worker RPC. The API enqueues a "channel-join" command job; the worker processes it and updates the database directly.

**Rationale**: The API (NestJS) and worker are separate processes. Direct function calls are not possible. BullMQ is already available and provides reliable delivery with retry semantics.

**Alternative considered**: HTTP endpoint on the worker. Rejected because the worker already has BullMQ infrastructure, and a separate HTTP API would add complexity without benefit.

**Pattern**: Create a `channel-ops` queue. API enqueues `{ operation: 'join', username, channelId }`. Worker processes, calls `joinChannel()`, updates the DB record via Prisma. API polls the DB for completion or uses BullMQ job completion events.

**Simpler alternative**: Since the worker already has DB access and the API just needs to trigger the join, the API can create the channel record (as it does now) and the worker picks it up on the next startup/refresh. For immediate response, a dedicated queue is better.

## R9: Worker Database Access

**Decision**: Add Prisma client to the worker app for reading active channels at startup and updating channel records after join/leave operations.

**Rationale**: The worker needs to query `SourceChannel` records (isActive, telegramId) at startup and update them after successful joins. Prisma is already the project's ORM and the schema is defined in `apps/api/prisma/schema.prisma`.

**Implementation**: The worker imports the generated Prisma client from the API's generated output, or generates its own client pointing to the same schema. The simplest approach is to use `@prisma/client` directly since it reads the same `DATABASE_URL`.

## R10: Album Grouping Strategy

**Decision**: Use an in-memory `Map<string, { messages: ForwardJob[], timer: NodeJS.Timeout }>` keyed by `groupedId`. On each album message, add to the buffer and reset the 300ms timer. When the timer fires, flush the group as a single ForwardJob with `mediaGroup` array.

**Rationale**: Albums arrive as individual messages with the same `groupedId`, typically within 100-200ms. A 300ms window provides enough margin for all messages to arrive. The timer-based approach is simple and deterministic.

**Memory safety**: Groups are removed from the Map after flushing. If a group exceeds 10 items (Telegram's album limit), flush immediately.
