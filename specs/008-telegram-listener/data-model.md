# Data Model: Telegram Listener Service

**Feature**: 008-telegram-listener
**Date**: 2026-02-17

## Entities

### ListenerSession (Runtime — not persisted)

The authenticated MTProto client connection to Telegram.

| Field | Type | Description |
|-------|------|-------------|
| client | TelegramClient | GramJS client instance |
| apiId | number | Telegram application ID |
| apiHash | string | Telegram application hash |
| sessionString | string | Serialized auth state from StringSession |
| connected | boolean | Current connection state |

**Lifecycle**: Created at worker startup, persists for the lifetime of the process. Reconnects automatically on disconnection.

### SourceChannel (Existing — Prisma model from Spec 04)

Already defined in `apps/api/prisma/schema.prisma`. No schema changes needed.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| telegramId | BigInt | Yes | Unique Telegram channel ID |
| username | String | No | Channel username (e.g., "durov") |
| title | String | Yes | Display name |
| isActive | Boolean | Yes | Whether the listener monitors this channel |
| subscribedAt | DateTime | Yes | When the channel was added |
| updatedAt | DateTime | Yes | Last update timestamp |

**Used by listener**: Query `WHERE isActive = true` at startup to populate the subscription list. Updated after successful join (set telegramId, title, isActive=true) or failed join (delete record).

### ForwardJob (Existing — from Spec 07)

Already defined in `packages/shared/src/queue/index.ts`. No changes needed.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| messageId | number | Yes | Telegram message ID |
| sourceChannelId | number | Yes | Telegram channel ID |
| text | string | No | Message text content |
| caption | string | No | Media caption |
| mediaType | string | No | photo, video, document, animation, audio, sticker, voice, video_note |
| mediaFileId | string | No | Serialized file identifier |
| mediaGroupId | string | No | Album group identifier |
| mediaGroup | ForwardJob[] | No | Array of grouped media items for albums |
| timestamp | number | Yes | Unix epoch seconds |

### AlbumBuffer (Runtime — in-memory)

Temporary buffer for collecting album messages before flushing.

| Field | Type | Description |
|-------|------|-------------|
| groupedId | string | The media group identifier (key) |
| messages | ForwardJob[] | Accumulated messages in the group |
| timer | NodeJS.Timeout | 300ms flush timer, reset on each new message |
| createdAt | number | Timestamp when the group was first seen |

**Lifecycle**: Created when the first message with a new `groupedId` arrives. Flushed and removed after 300ms of inactivity or when 10 messages are collected (Telegram's album limit).

### ChannelOpsJob (New — BullMQ job payload)

Command sent from the API to the worker to trigger channel join/leave.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operation | string | Yes | `"join"` or `"leave"` |
| channelId | string | Yes | UUID of the SourceChannel record |
| username | string | For join | Channel username to join |
| telegramId | number | For leave | Telegram channel ID to leave |

### ChannelInfo (Return type)

Returned by the join operation on success.

| Field | Type | Description |
|-------|------|-------------|
| telegramId | number | Resolved Telegram channel ID |
| title | string | Channel display name |

### RateLimiter (Runtime — in-memory)

Tracks join operations to enforce the 5-per-hour limit.

| Field | Type | Description |
|-------|------|-------------|
| timestamps | number[] | Unix timestamps of recent join operations |
| maxPerHour | number | Maximum allowed joins per hour (5) |
| delayMin | number | Minimum random delay in ms (2000) |
| delayMax | number | Maximum random delay in ms (5000) |

## Queue Configuration

### channel-ops Queue (New)

| Property | Value |
|----------|-------|
| Name | `channel-ops` |
| Purpose | API → Worker RPC for join/leave operations |
| Default attempts | 1 (no retry — join failures should be reported immediately) |
| removeOnComplete | Keep latest 100 |
| removeOnFail | Keep latest 500 |

## Environment Variables (New for Worker)

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| TELEGRAM_API_ID | number | Yes | Telegram application API ID |
| TELEGRAM_API_HASH | string | Yes | Telegram application API hash |
| TELEGRAM_SESSION | string | Yes | Pre-generated StringSession auth string |
| DATABASE_URL | string | Yes | PostgreSQL connection URL (for Prisma) |

## Constants (New for shared package)

| Constant | Value | Description |
|----------|-------|-------------|
| QUEUE_NAME_CHANNEL_OPS | `"channel-ops"` | Channel operations queue name |
| ALBUM_GROUP_TIMEOUT_MS | 300 | Album grouping window in milliseconds |
| ALBUM_MAX_SIZE | 10 | Maximum messages in a single album |
| JOIN_RATE_LIMIT_PER_HOUR | 5 | Maximum channel joins per hour |
| JOIN_DELAY_MIN_MS | 2000 | Minimum delay before join in milliseconds |
| JOIN_DELAY_MAX_MS | 5000 | Maximum delay before join in milliseconds |
