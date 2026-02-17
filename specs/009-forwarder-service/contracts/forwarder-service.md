# Contract: ForwarderService

## Overview

`ForwarderService` is the core business logic class responsible for routing a `ForwardJob` to all matching destination channels via the Telegram Bot API.

**Location**: `apps/worker/src/forwarder/forwarder.service.ts`

## Class Interface

```typescript
class ForwarderService {
  constructor(
    api: Api,                    // grammY standalone API client
    prisma: PrismaClient,       // database for routing lookups
    dedupService: DedupService,  // Redis-backed dedup
    rateLimiter: RateLimiterService, // bottleneck wrapper
    logger: pino.Logger,
  )

  /**
   * Process a single ForwardJob: find destinations, dedup, send.
   * Throws on retryable errors (429, network). Logs and skips non-critical errors.
   */
  async forward(job: ForwardJob): Promise<void>
}
```

## Method: `forward(job: ForwardJob)`

### Algorithm

1. **Find destinations**: Query all active SubscriptionLists that include the source channel (`job.sourceChannelId`). Collect unique `destinationChannelId` values.
2. **For each unique destination**:
   a. **Dedup check**: Call `dedupService.isDuplicate(destinationChannelId, text)` where `text` is `job.text ?? job.caption ?? ''`.
   b. If duplicate → log `message_deduplicated`, skip.
   c. If not duplicate → **send** via rate limiter:
      - Text message → `api.sendMessage`
      - Photo → `api.sendPhoto`
      - Video → `api.sendVideo`
      - Document → `api.sendDocument`
      - Animation → `api.sendAnimation`
      - Audio → `api.sendAudio`
      - Album → `api.sendMediaGroup`
   d. On success → `dedupService.markAsForwarded(destinationChannelId, text)`. Log `message_forwarded`.
   e. On `GrammyError` with `error_code === 429` → throw to trigger BullMQ retry.
   f. On other error → log `forward_failed`, throw to trigger BullMQ retry.

### Error Behavior

| Error Type | Action |
|------------|--------|
| `GrammyError` (429) | Throw — BullMQ retries with exponential backoff |
| `GrammyError` (other) | Log `forward_failed`, throw — BullMQ retries |
| `HttpError` (network) | Log `forward_failed`, throw — BullMQ retries |
| Dedup Redis failure | Fail open (treat as not duplicate), log warning |
| Prisma query failure | Throw — BullMQ retries |

### Logging

| Event | Level | Fields |
|-------|-------|--------|
| `message_forwarded` | info | sourceChannelId, destinationChannelId, messageId, mediaType |
| `message_deduplicated` | info | sourceChannelId, destinationChannelId, messageId |
| `forward_failed` | error | sourceChannelId, destinationChannelId, messageId, error |
| `no_destinations` | debug | sourceChannelId, messageId |
