# Data Model: BullMQ Queue Setup

**Feature**: 007-bullmq-queue-setup
**Date**: 2026-02-17

## Entities

### ForwardJob (Shared Interface)

The unit of work representing a message to be forwarded.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| messageId | number | Yes | Telegram message ID from the source channel |
| sourceChannelId | number | Yes | Telegram channel ID where the message originated |
| text | string | No | Message text content (for text messages) |
| caption | string | No | Media caption (for media messages with captions) |
| mediaType | string | No | Type of media: "photo", "video", "document", "audio", "animation", "sticker", "voice", "video_note" |
| mediaFileId | string | No | Telegram file_id for the media attachment |
| mediaGroupId | string | No | Telegram media_group_id for grouped media |
| mediaGroup | ForwardJob[] | No | Array of related jobs when forwarding a media group as a unit |
| timestamp | number | Yes | Unix epoch (seconds) when the message was received |

**Validation rules**:
- `messageId` must be a positive integer
- `sourceChannelId` must be a non-zero integer (Telegram channel IDs can be negative)
- `timestamp` must be a positive integer
- At least one of `text`, `caption`, or `mediaFileId` should be present (but not enforced — empty messages are valid edge cases handled by dedup)

### Queue: message-forward

The primary work queue.

| Property | Value |
|----------|-------|
| Name | `message-forward` |
| Default attempts | 3 |
| Backoff type | Exponential |
| Backoff base delay | 5,000 ms |
| removeOnComplete | Keep latest 1,000 |
| removeOnFail | Keep latest 5,000 |

**Job states**: waiting → active → completed / failed → (DLQ if all retries exhausted)

### Queue: message-forward-dlq

Dead letter queue for jobs that exhausted all retries.

| Property | Value |
|----------|-------|
| Name | `message-forward-dlq` |
| No retry configuration | Jobs are terminal here |
| removeOnComplete | Not applicable (jobs stay for inspection) |

**DLQ Job payload**:

| Field | Type | Description |
|-------|------|-------------|
| originalJobId | string | BullMQ job ID from the main queue |
| originalQueue | string | Source queue name (`message-forward`) |
| data | ForwardJob | Original job payload |
| failedReason | string | Error message from the final failure |
| attemptsMade | number | Total attempts made before DLQ |
| timestamp | number | Unix epoch when moved to DLQ |

## Constants (packages/shared)

| Constant | Value | Description |
|----------|-------|-------------|
| QUEUE_NAME_FORWARD | `"message-forward"` | Main forwarding queue name |
| QUEUE_NAME_FORWARD_DLQ | `"message-forward-dlq"` | Dead letter queue name |
| QUEUE_MAX_ATTEMPTS | 3 | Maximum retry attempts per job |
| QUEUE_BACKOFF_DELAY | 5000 | Base backoff delay in milliseconds |
| QUEUE_KEEP_COMPLETED | 1000 | Max completed jobs to retain |
| QUEUE_KEEP_FAILED | 5000 | Max failed jobs to retain |

## Redis Key Patterns

BullMQ manages its own Redis keys under the `bull:` prefix:

| Pattern | Purpose |
|---------|---------|
| `bull:message-forward:*` | Main queue job data, state, and metadata |
| `bull:message-forward-dlq:*` | DLQ job data |

These are managed entirely by BullMQ — no manual key management needed.
