# Tasks: Channel Cleanup Job

**Input**: Design documents from `/specs/011-channel-cleanup/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — spec explicitly requests 5 test scenarios (4 unit + 1 partial-failure).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared constants and update Prisma schema with new field

- [x] T001 [P] Add `QUEUE_NAME_CHANNEL_CLEANUP = 'channel-cleanup'` and `CLEANUP_GRACE_PERIOD_DAYS = 30` constants to packages/shared/src/constants/index.ts and re-export from packages/shared/src/index.ts
- [x] T002 [P] Add `lastReferencedAt DateTime?` field to `SourceChannel` model in apps/worker/prisma/schema.prisma and apps/api/prisma/schema.prisma, then run `pnpm exec prisma generate` in both apps to update the Prisma client (actual DB migration is deferred to T010 in the Polish phase)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the ChannelCleanupService core class and BullMQ consumer — the infrastructure both user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

- [x] T003 [P] Write ChannelCleanupService unit tests in apps/worker/test/channel-cleanup.spec.ts covering: (1) channels with active SubscriptionListChannel references are NOT cleaned up (FR-005), (2) channels with no references but lastReferencedAt < 30 days ago are NOT cleaned up (FR-006), (3) channels with no references and lastReferencedAt >= 30 days ago ARE deactivated and leaveChannel is called (FR-002/FR-003/FR-004), (4) cleanup runs without errors when no orphaned channels exist — returns `{ deactivated: 0, failed: 0, total: 0 }`, (5) partial failure — when leaveChannel throws for one channel, the next channel is still processed (FR-007), result shows correct deactivated/failed counts. Mock ChannelManager.leaveChannel and PrismaClient. Use `vi.useFakeTimers()` to control date calculations for the 30-day threshold.

### Implementation for Foundational

- [x] T004 [P] Create ChannelCleanupService class in apps/worker/src/cleanup/channel-cleanup.service.ts — constructor takes PrismaClient, ChannelManager, and pino Logger. Implement `execute(): Promise<CleanupResult>` method that: (1) queries orphaned channels via Prisma `sourceChannel.findMany({ where: { isActive: true, subscriptionListChannels: { none: {} }, OR: [{ lastReferencedAt: { lt: threshold } }, { lastReferencedAt: null, subscribedAt: { lt: threshold } }] } })` where threshold = now minus CLEANUP_GRACE_PERIOD_DAYS, (2) for each channel: try leaveChannel(Number(channel.telegramId)) then update isActive=false, catch errors and log at error level with `{ telegramId, channelId, error }` context and continue, (3) log at info level on each successful leave with `{ telegramId, channelId }`, (4) log completion summary at info level with `{ deactivated, failed, total }`, (5) return CleanupResult `{ deactivated, failed, total }`. Export CleanupResult interface. This ensures Constitution III compliance (no silent failures) even if US2 enriched logging is not yet implemented.
- [x] T005 [P] Create ChannelCleanupConsumer class in apps/worker/src/cleanup/channel-cleanup.consumer.ts — BullMQ Worker on QUEUE_NAME_CHANNEL_CLEANUP queue, concurrency 1, calls ChannelCleanupService.execute() for each job. Constructor takes ChannelCleanupService and pino Logger. Provide `startWorker(connection: Redis)` and `close()` methods following the same pattern as ChannelOpsConsumer in apps/worker/src/listener/channel-ops-consumer.ts.

**Checkpoint**: ChannelCleanupService and consumer are implemented and tested. Ready for integration into main.ts.

---

## Phase 3: User Story 1 — Automatic Orphaned Channel Cleanup (Priority: P1) 🎯 MVP

**Goal**: The cleanup job runs on a daily schedule, identifies orphaned channels (no refs for 30+ days), leaves them, and deactivates them.

**Independent Test**: Mock ChannelManager, create test channels with/without refs, run execute(), verify correct channels are left and deactivated.

### Implementation for User Story 1

- [x] T006 [US1] Register the cleanup scheduler and consumer in apps/worker/src/main.ts — create a `channel-cleanup` BullMQ Queue, call `queue.upsertJobScheduler('daily-channel-cleanup', { pattern: '0 0 3 * * *' }, { name: 'channel-cleanup', opts: { attempts: 1 } })` on startup, instantiate ChannelCleanupService(prisma, channelManager, logger) and ChannelCleanupConsumer, call startWorker(connection), add consumer.close() to the shutdown handler. Import QUEUE_NAME_CHANNEL_CLEANUP from @aggregator/shared.
- [x] T007 [US1] Add the `channel-cleanup` queue to the health server dashboard in apps/worker/src/health.ts — pass the cleanup queue to startHealthServer so it appears alongside existing queue stats. Also add it to the Bull Board dashboard in apps/worker/src/dashboard.ts if it exists.

**Checkpoint**: Cleanup job is scheduled, runs daily at 3:00 AM UTC, and processes orphaned channels. Existing worker functionality is unaffected.

---

## Phase 4: User Story 2 — Cleanup Observability (Priority: P2)

**Goal**: The cleanup job produces structured logs summarizing each run with counts and per-channel error details.

**Independent Test**: Run execute() with mixed success/failure channels, verify log output includes start event, per-channel events, and completion summary with counts and duration.

### Implementation for User Story 2

- [x] T008 [US2] Add structured logging to ChannelCleanupService.execute() in apps/worker/src/cleanup/channel-cleanup.service.ts — log `channel_cleanup_start` (info, `{ jobId }`) at the beginning, `channel_left` (info, `{ telegramId, channelId }`) after each successful leave, `channel_leave_failed` (error, `{ telegramId, channelId, error }`) on each failure, and `channel_cleanup_complete` (info, `{ deactivated, failed, total, durationMs }`) at the end. Use `performance.now()` or `Date.now()` for duration tracking. Accept optional jobId parameter in execute().
- [x] T009 [US2] Add logging test assertions to apps/worker/test/channel-cleanup.spec.ts — verify that execute() calls logger.info with `channel_cleanup_start` and `channel_cleanup_complete` messages, and logger.error with `channel_leave_failed` when a channel leave fails. Mock logger and assert on call args.

**Checkpoint**: Every cleanup run produces structured, queryable log entries for monitoring.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify full build, test suite, and lint pass across the monorepo

- [x] T010 Run Prisma migration for the new `lastReferencedAt` field — `cd apps/api && pnpm exec prisma migrate dev --name add-source-channel-last-referenced-at`
- [x] T011 Run `pnpm turbo run build` and fix any build errors
- [x] T012 Run `pnpm turbo run test` and verify all tests pass
- [x] T013 Run `pnpm turbo run lint` and fix any lint issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — this is the MVP
- **User Story 2 (Phase 4)**: Depends on US1 (same service file, adds logging to existing execute())
- **Polish (Phase 5)**: Depends on all user stories being complete

### Within Each Phase

- T001 and T002 can run in parallel (different files)
- T003, T004, T005 can run in parallel (different files)
- T006 depends on T004 and T005 (needs service and consumer classes)
- T007 depends on T006 (needs queue instance)
- T008 depends on T006 (adds to existing service)
- T009 depends on T008 (tests the logging)
- T010 must run before T011 (migration before build)

### Parallel Opportunities

```
Phase 1 (parallel):
  T001 (constants) || T002 (schema)

Phase 2 (parallel):
  T003 (tests) || T004 (service) || T005 (consumer)

After Foundational:
  US1 → US2 (sequential — same service file modified)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005)
3. Complete Phase 3: US1 — Scheduler registration + health dashboard (T006-T007)
4. **STOP and VALIDATE**: Cleanup job is scheduled and runs, orphaned channels are left and deactivated
5. This is a deployable MVP that delivers core cleanup functionality

### Incremental Delivery

1. Setup + Foundational → ChannelCleanupService ready with tests
2. US1 (scheduler + health) → MVP deployed, job runs daily
3. US2 (observability) → Structured logging for monitoring
4. Polish → Full monorepo verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- `ChannelManager.leaveChannel(telegramId)` already exists — reuse directly, no BullMQ queue indirection
- BullMQ `upsertJobScheduler` is idempotent — safe to call on every worker restart
- The `lastReferencedAt` field is nullable; the Prisma query uses `COALESCE(lastReferencedAt, subscribedAt)` logic via an OR clause
- No new dependencies required — uses existing BullMQ, Prisma, and pino
- Worker tests use Vitest with mocked dependencies (no real Redis/Telegram/DB)
