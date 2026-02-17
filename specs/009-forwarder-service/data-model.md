# Data Model: Forwarder Service

## Overview

The Forwarder Service does **not** introduce any new persistent entities or schema changes. Per constitution principle VII (Data Architecture): "Messages MUST NOT be persisted. The system is a forwarder, not a store."

All entities used by this feature already exist in the Prisma schema.

## Existing Entities Used

### ForwardJob (in-memory, BullMQ queue payload)

The job payload consumed from the `message-forward` queue.

| Field            | Type            | Description                                           |
|------------------|-----------------|-------------------------------------------------------|
| messageId        | number          | Telegram message ID in the source channel             |
| sourceChannelId  | number          | Telegram numeric ID of the source channel             |
| text             | string?         | Message text (for text messages)                      |
| caption          | string?         | Caption text (for media messages)                     |
| mediaType        | string?         | One of: photo, video, document, animation, audio      |
| mediaFileId      | string?         | Telegram file_id for the media                        |
| mediaGroupId     | string?         | Album group identifier                                |
| mediaGroup       | ForwardJob[]?   | Array of grouped messages (for albums)                |
| timestamp        | number          | Unix timestamp of the original message                |

### SubscriptionList (PostgreSQL via Prisma)

| Field                  | Type    | Description                                      |
|------------------------|---------|--------------------------------------------------|
| id                     | UUID    | Primary key                                      |
| userId                 | UUID    | FK to User                                       |
| name                   | string  | User-defined list name                           |
| destinationChannelId   | BigInt  | Telegram numeric ID of the destination channel   |
| destinationUsername     | string? | Username of the destination channel              |
| isActive               | boolean | Whether this list is currently active             |

### SubscriptionListChannel (PostgreSQL via Prisma — junction)

| Field                | Type   | Description                           |
|----------------------|--------|---------------------------------------|
| id                   | UUID   | Primary key                           |
| subscriptionListId   | UUID   | FK to SubscriptionList                |
| sourceChannelId      | UUID   | FK to SourceChannel                   |

**Unique constraint**: `(subscriptionListId, sourceChannelId)`

### SourceChannel (PostgreSQL via Prisma)

| Field        | Type    | Description                               |
|--------------|---------|-------------------------------------------|
| id           | UUID    | Primary key                               |
| telegramId   | BigInt  | Telegram numeric channel ID               |
| username     | string? | Channel @username                         |
| title        | string  | Channel display title                     |
| isActive     | boolean | Whether the channel is being monitored    |

### DedupRecord (Redis, ephemeral)

| Key Pattern                        | Value | TTL      |
|------------------------------------|-------|----------|
| `dedup:{destinationChannelId}:{hash}` | "1"   | 72 hours |

Hash is SHA256 of normalized text (first 10 words, lowercased, alphanumeric only).

## Routing Query

To find destinations for a given source channel message:

```
SELECT DISTINCT sl.destinationChannelId
FROM SubscriptionList sl
JOIN SubscriptionListChannel slc ON slc.subscriptionListId = sl.id
JOIN SourceChannel sc ON sc.id = slc.sourceChannelId
WHERE sc.telegramId = :sourceChannelTelegramId
  AND sl.isActive = true
```

This returns the set of unique destination channel IDs that should receive the forwarded message. Deduplication across lists sharing the same destination is handled by collecting unique destination IDs before sending.

## Data Flow

```
BullMQ (message-forward queue)
  → ForwardJob consumed
  → Prisma: query active SubscriptionLists for sourceChannelId
  → For each unique destinationChannelId:
      → Redis: check dedup key
      → If not duplicate: send via grammY Api → Redis: mark as forwarded
      → If duplicate: skip, log
```

No new tables, no new Redis key patterns beyond the existing dedup scheme.
