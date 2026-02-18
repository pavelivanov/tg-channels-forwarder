# Research: Channel Cleanup Job

## R1: Scheduling Mechanism

**Decision**: BullMQ Job Scheduler via `queue.upsertJobScheduler()` with cron pattern

**Rationale**: The worker already uses BullMQ for job processing (`channel-ops` queue, `message-forward` queue). BullMQ's `upsertJobScheduler` API provides cron-based scheduling backed by Redis — no additional dependencies needed. It is idempotent (safe to call on every worker startup), persists schedule state across restarts, and integrates with the existing health dashboard.

**Alternatives considered**:
- `node-cron`: Adds a new dependency. Runs in-process only (not Redis-backed), so it doesn't survive worker restarts without extra logic. Also loses scheduling state if the process crashes.
- `setInterval`: Simplest approach but no persistence, no cron expression support, drift over time.
- Separate BullMQ repeatable job (deprecated `repeat` option): The older `Queue.add(..., { repeat: { cron } })` API still works but BullMQ docs recommend `upsertJobScheduler` as the modern replacement with better semantics.

**Cron expression**: `0 0 3 * * *` — runs daily at 3:00 AM UTC (6-field cron: second minute hour day month weekday).

## R2: Orphan Detection Strategy

**Decision**: Query-time detection using a LEFT JOIN from `SourceChannel` to `SubscriptionListChannel`, checking for channels with zero references.

**Rationale**: The existing schema already has `SubscriptionListChannel` as the join table between `SubscriptionList` and `SourceChannel`. When a subscription list is deleted, `SubscriptionListChannel` rows are cascade-deleted. So an orphaned channel is simply one where no `SubscriptionListChannel` references it.

For the 30-day grace period, use `SourceChannel.updatedAt` as the indicator of when the channel was last "touched" (either by a subscription list change or by an initial subscription). When the last `SubscriptionListChannel` reference is removed, the next cleanup run will see zero references. The grace period is measured by checking whether `updatedAt` is older than 30 days. This works because:
- On join: `updatedAt` is set (new channel created or reactivated)
- On subscription list changes: Prisma's `@updatedAt` auto-updates when the related SubscriptionListChannel rows change indirectly (but NOT automatically on cascade delete of join records)

**Problem with `updatedAt` alone**: When a subscription list is deleted, the cascade deletes `SubscriptionListChannel` rows, but the `SourceChannel.updatedAt` may not be updated. This means `updatedAt` could be much older than 30 days even though the last reference was just removed.

**Revised approach**: Add a `lastReferencedAt` timestamp field to `SourceChannel`. Update it explicitly whenever:
1. A `SubscriptionListChannel` referencing this channel is created (via API)
2. The cleanup job finds a channel still has active references (refresh the timestamp)

This way, the cleanup job can safely query: `isActive = true AND no SubscriptionListChannel refs AND lastReferencedAt < now() - 30 days`.

**Alternatives considered**:
- Using only `updatedAt`: Unreliable because cascade deletes don't touch the parent `SourceChannel.updatedAt`. A channel could become orphaned today but `updatedAt` could be from 60 days ago, causing immediate cleanup instead of a 30-day grace.
- Tracking a `lastUnreferencedAt` field: More complex — would need to detect the exact moment a channel becomes orphaned and record it. Harder to maintain correctly.
- Event-driven approach (set a timer when last reference is removed): Over-engineered for a daily cron job. The cron already runs every 24h, so checking the timestamp is sufficient.

## R3: Leave Channel Mechanism

**Decision**: Reuse existing `ChannelManager.leaveChannel(telegramId)` directly (not via the channel-ops BullMQ queue).

**Rationale**: The cleanup service runs inside the worker process which already has access to the `ChannelManager` instance and the Telegram client. Enqueuing a BullMQ job for each leave would add unnecessary complexity — the cleanup job already processes channels sequentially and handles errors per-channel. Direct invocation is simpler and keeps the cleanup logic self-contained.

**Alternatives considered**:
- Enqueue `channel-ops` leave jobs: Adds indirection. The channel-ops queue is designed for API-triggered operations (user requests). The cleanup job is a worker-internal process — direct invocation is appropriate.
- New dedicated queue: Over-engineered. No benefit over direct invocation for a batch process.

## R4: Prisma Schema Change

**Decision**: Add `lastReferencedAt DateTime?` to `SourceChannel` model.

**Rationale**: Nullable to handle existing channels (those with NULL `lastReferencedAt` will be treated as if `lastReferencedAt = subscribedAt`). The cleanup query will coalesce: `COALESCE(lastReferencedAt, subscribedAt) < threshold`.

**Migration**: Single `ALTER TABLE` adding the nullable column. No data migration needed — the coalesce handles existing rows.

## R5: Cleanup Queue Name

**Decision**: Create a new BullMQ queue named `channel-cleanup` for the scheduled job.

**Rationale**: Using a dedicated queue separates cleanup concerns from the existing `channel-ops` and `message-forward` queues. The job scheduler is tied to a specific queue, so we need a queue for the cleanup worker to process.

**Queue constant**: Add `QUEUE_NAME_CHANNEL_CLEANUP = 'channel-cleanup'` to `@aggregator/shared`.
