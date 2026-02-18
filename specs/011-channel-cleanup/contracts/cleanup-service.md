# Contract: ChannelCleanupService

## Overview

Internal worker service that runs as a BullMQ scheduled job. No external HTTP API — this is a background job triggered by a cron scheduler.

## Service Interface

### ChannelCleanupService

```typescript
class ChannelCleanupService {
  /**
   * Execute the cleanup job. Called by the BullMQ worker when the
   * scheduled job fires.
   *
   * 1. Query all orphaned channels (isActive=true, no SubscriptionListChannel refs,
   *    lastReferencedAt/subscribedAt older than 30 days)
   * 2. For each orphaned channel:
   *    a. Call ChannelManager.leaveChannel(telegramId)
   *    b. Set isActive = false in database
   *    c. Log success or error per channel
   * 3. Log summary with total channels processed and error count
   *
   * @returns CleanupResult with counts
   */
  async execute(): Promise<CleanupResult>;
}
```

### CleanupResult

```typescript
interface CleanupResult {
  /** Number of channels successfully deactivated */
  deactivated: number;
  /** Number of channels where leave/deactivate failed */
  failed: number;
  /** Total orphaned channels found */
  total: number;
}
```

## Job Configuration

| Property         | Value                  |
|------------------|------------------------|
| Queue name       | `channel-cleanup`      |
| Scheduler ID     | `daily-channel-cleanup`|
| Cron pattern     | `0 0 3 * * *`         |
| Job name         | `channel-cleanup`      |
| Max attempts     | 1                      |
| Concurrency      | 1                      |

## Behavior Rules

1. **Partial failure resilience**: If leaving channel N fails, continue with channel N+1. Do not abort the entire run.
2. **Idempotent**: Running the job multiple times in a row produces the same result — channels already marked `isActive: false` are not re-processed.
3. **No side effects on referenced channels**: Channels with any `SubscriptionListChannel` reference are never touched.
4. **Grace period**: Channels must have been unreferenced for >= 30 consecutive days before cleanup.

## Log Events

| Event                | Level | Fields                                         |
|----------------------|-------|-------------------------------------------------|
| `channel_cleanup_start` | info | `{ jobId }`                                   |
| `channel_left`       | info  | `{ telegramId, channelId }`                    |
| `channel_leave_failed` | error | `{ telegramId, channelId, error }`            |
| `channel_cleanup_complete` | info | `{ deactivated, failed, total, durationMs }` |

## Test Scenarios

1. **Channels with active references are not cleaned up**: Create a SourceChannel with a SubscriptionListChannel reference. Run cleanup. Channel remains active.
2. **Channels with no references for < 30 days are not cleaned up**: Create an orphaned SourceChannel with `lastReferencedAt` = 15 days ago. Run cleanup. Channel remains active.
3. **Channels with no references for >= 30 days are deactivated and left**: Create an orphaned SourceChannel with `lastReferencedAt` = 31 days ago. Run cleanup. Verify `leaveChannel` called and `isActive = false`.
4. **Cleanup runs without errors when no orphaned channels exist**: Run cleanup on empty/all-referenced channels. Returns `{ deactivated: 0, failed: 0, total: 0 }`.
5. **Partial failure**: One channel fails to leave, another succeeds. Both are attempted. Result shows 1 deactivated, 1 failed.
