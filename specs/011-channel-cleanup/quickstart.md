# Quickstart: Channel Cleanup Job

## Integration Scenario

### Scenario 1: Daily Cleanup Deactivates Orphaned Channels

**Setup**:
1. Worker starts and registers the `daily-channel-cleanup` job scheduler on the `channel-cleanup` queue
2. Database has 3 active source channels:
   - Channel A: referenced by a subscription list (has SubscriptionListChannel row)
   - Channel B: no references, `lastReferencedAt` = 31 days ago
   - Channel C: no references, `lastReferencedAt` = 10 days ago

**Trigger**: BullMQ fires the scheduled job at 3:00 AM UTC

**Expected flow**:
1. `ChannelCleanupService.execute()` is called
2. Prisma query finds 1 orphaned eligible channel: Channel B
3. `ChannelManager.leaveChannel(channelB.telegramId)` is called
4. Channel B is updated: `isActive = false`
5. Log: `channel_cleanup_complete { deactivated: 1, failed: 0, total: 1 }`

**Result**:
- Channel A: still active (has reference)
- Channel B: inactive (orphaned 31 days, left and deactivated)
- Channel C: still active (orphaned only 10 days, within grace period)

### Scenario 2: Cleanup With Leave Failure

**Setup**:
- Channel D: no references, `lastReferencedAt` = 45 days ago, but bot was already removed from channel
- Channel E: no references, `lastReferencedAt` = 60 days ago

**Trigger**: Scheduled job fires

**Expected flow**:
1. Query finds 2 orphaned channels: D and E
2. `leaveChannel(channelD.telegramId)` throws (Telegram API error: not a member)
3. Error is logged, Channel D remains `isActive: true` (will be retried next day)
4. `leaveChannel(channelE.telegramId)` succeeds
5. Channel E is updated: `isActive = false`
6. Log: `channel_cleanup_complete { deactivated: 1, failed: 1, total: 2 }`

### Scenario 3: No Orphaned Channels

**Setup**: All active channels have at least one subscription list reference

**Trigger**: Scheduled job fires

**Expected flow**:
1. Query returns 0 orphaned channels
2. Log: `channel_cleanup_complete { deactivated: 0, failed: 0, total: 0 }`
3. No Telegram API calls made

## Local Development Testing

```bash
# Ensure services are running
docker compose up -d  # PostgreSQL + Redis

# Run worker (cleanup scheduler registers on startup)
cd apps/worker && pnpm dev

# To test cleanup manually, insert test data:
# 1. Create a source channel with isActive=true, no subscriptionListChannel refs,
#    and lastReferencedAt older than 30 days
# 2. Trigger the job manually via Bull Board dashboard at /admin/queues
#    or by calling queue.upsertJobScheduler with a short interval for testing
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/worker/src/cleanup/channel-cleanup.service.ts` | Core cleanup logic |
| `apps/worker/src/cleanup/channel-cleanup.consumer.ts` | BullMQ worker for cleanup queue |
| `apps/worker/src/main.ts` | Registers scheduler on startup |
| `packages/shared/src/constants/index.ts` | `QUEUE_NAME_CHANNEL_CLEANUP`, `CLEANUP_GRACE_PERIOD_DAYS` |
| `apps/worker/prisma/schema.prisma` | `lastReferencedAt` field on SourceChannel |
| `apps/api/prisma/schema.prisma` | Same field (API schema mirror) |
