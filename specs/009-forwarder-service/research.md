# Research: Forwarder Service

## R1: grammY Bot API for Send-Only Use

**Decision**: Use `grammy` `Api` class standalone (no Bot, no polling)

**Rationale**: grammY provides a standalone `Api` class that wraps the Telegram Bot HTTP API. For a forwarder that only sends messages (never receives), `new Api(token)` is the minimal surface — no middleware, no polling, no webhook infrastructure. All send methods (`sendMessage`, `sendPhoto`, `sendVideo`, `sendDocument`, `sendAnimation`, `sendAudio`, `sendMediaGroup`) are available directly on the `Api` instance.

**Alternatives considered**:
- `Bot` class with `bot.api` — heavier, includes middleware infrastructure we don't need
- Direct HTTP calls to Telegram API — lower-level, no typed helpers, error handling burden
- `telegraf` — competing library, less active, grammY is mandated by constitution (V. Technology Stack)

**Key patterns**:
- `new Api("BOT_TOKEN")` — standalone API client
- `api.sendMessage(chatId, text, { entities })` — entities passed directly from ForwardJob
- `api.sendPhoto(chatId, fileId, { caption, caption_entities })` — file_id reuse from source
- `api.sendMediaGroup(chatId, media)` — album forwarding via `InputMediaBuilder`
- `GrammyError` with `error_code === 429` and `parameters.retry_after` for rate limit handling
- `HttpError` for network-level failures

## R2: Rate Limiting Strategy

**Decision**: Use `bottleneck` with `Group` + `chain()` pattern

**Rationale**: The spec requires two tiers of rate limiting: global (20 msg/s) and per-destination (15 msg/min). Bottleneck's `Group` creates per-key limiters automatically, and `.chain()` funnels them through a single global limiter. This is the exact pattern needed — no custom code required. The library is stable (v2.19.5, ~3M weekly downloads), zero dependencies, and TypeScript types are bundled.

**Alternatives considered**:
- BullMQ built-in rate limiter — only supports per-queue rate limiting, not per-destination within a single queue
- `rate-limiter-flexible` — more complex API, no Group/chain equivalent
- Custom token bucket — unnecessary when bottleneck solves the exact problem
- `@grammyjs/auto-retry` — reactive only (retries after 429), not proactive throttling

**Configuration**:
- Global: `maxConcurrent: 20, minTime: 50, reservoir: 20, reservoirRefreshInterval: 1000`
- Per-channel Group: `reservoir: 15, reservoirRefreshAmount: 15, reservoirRefreshInterval: 60_000`
- Chain per-channel limiters through global limiter via `created` event

## R3: 429 Error Handling

**Decision**: Use `@grammyjs/auto-retry` plugin as a safety net, with bottleneck as the primary rate limiter

**Rationale**: The auto-retry plugin installs as an API transformer and transparently handles 429 responses by waiting `retry_after` seconds and retrying. This provides a safety net for any requests that slip through bottleneck's proactive limiting. Combined with BullMQ's existing retry mechanism (3 attempts, exponential backoff), we have three layers of protection: (1) bottleneck prevents most 429s, (2) auto-retry handles the occasional 429 transparently, (3) BullMQ retries the job if all else fails.

**Alternatives considered**:
- Manual 429 catch + re-throw for BullMQ retry — works but adds latency (BullMQ backoff is 5s+)
- auto-retry only — reactive, would trigger many 429s without proactive limiting
- bottleneck only — misses 429s from other sources (e.g., Telegram's per-chat limits)

## R4: Routing Lookup Pattern

**Decision**: Query Prisma for subscription lists at job processing time

**Rationale**: The existing schema has `SubscriptionList` → `SubscriptionListChannel` → `SourceChannel`. To find destinations for a source channel, we query `SubscriptionListChannel` where `sourceChannel.telegramId == job.sourceChannelId` and `subscriptionList.isActive == true`, then collect unique `destinationChannelId` values. Querying at processing time (not enqueue time) ensures inactive lists are excluded even if they were active when the message was received.

**Key query**:
```
Find all SubscriptionList where:
  - isActive = true
  - has SubscriptionListChannel with sourceChannel.telegramId = job.sourceChannelId
Return: distinct destinationChannelId values
```

## R5: Integration with Existing QueueConsumer

**Decision**: Inject ForwarderService into QueueConsumer, replace the stub handler

**Rationale**: The existing `QueueConsumer` (apps/worker/src/queue/queue-consumer.ts) has a stub handler marked `// Actual forwarding logic comes in Spec 09`. We'll modify it to accept and call a `ForwarderService` that encapsulates all forwarding logic. This keeps QueueConsumer focused on BullMQ mechanics (worker lifecycle, DLQ, logging) while ForwarderService handles the business logic (routing, dedup, sending, rate limiting).

## R6: BOT_TOKEN Configuration

**Decision**: Add `BOT_TOKEN` to the worker's env schema (config.ts)

**Rationale**: The worker already validates env vars via Zod schema. Adding `BOT_TOKEN` as a required string follows the established pattern. The grammY `Api` instance is created once at startup using this token.
