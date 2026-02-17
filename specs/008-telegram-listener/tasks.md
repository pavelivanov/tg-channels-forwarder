# Tasks: Telegram Listener Service

**Input**: Design documents from `/specs/008-telegram-listener/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included — explicitly requested in feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, add shared constants/types, extend worker config, set up Prisma client for worker

- [x] T001 Install `telegram` (GramJS) and `@prisma/client` as dependencies in apps/worker/package.json
- [x] T002 [P] Add `QUEUE_NAME_CHANNEL_OPS` constant and `ChannelOpsJob` interface to packages/shared/src/queue/index.ts
- [x] T003 [P] Add `ALBUM_GROUP_TIMEOUT_MS`, `ALBUM_MAX_SIZE`, `JOIN_RATE_LIMIT_PER_HOUR`, `JOIN_DELAY_MIN_MS`, `JOIN_DELAY_MAX_MS` constants to packages/shared/src/constants/index.ts
- [x] T004 Extend worker env schema with `TELEGRAM_API_ID` (number), `TELEGRAM_API_HASH` (string), `TELEGRAM_SESSION` (string), and `DATABASE_URL` (string) in apps/worker/src/config.ts
- [x] T005 Create Prisma client singleton for worker that reads `DATABASE_URL` from env in apps/worker/src/prisma.ts
- [x] T006 Build shared package to make new constants and types available via `pnpm --filter @aggregator/shared run build`

**Checkpoint**: Dependencies installed, shared types exported, worker config extended with Telegram env vars and Prisma client ready.

---

## Phase 2: User Story 1 — Receive and Queue Channel Messages (Priority: P1) 🎯 MVP

**Goal**: Connect to Telegram as userbot, listen for messages on subscribed channels, extract content, check dedup, and enqueue ForwardJobs.

**Independent Test**: Send a message to a subscribed test channel, verify a ForwardJob with correct payload appears in the queue.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T007 [P] [US1] Write message extractor tests covering text, photo, video, document, animation, audio message types and channel ID extraction in apps/worker/test/message-extractor.spec.ts
- [x] T008 [P] [US1] Write listener service tests covering: start registers event handler with channel filter, handleNewMessage enqueues ForwardJob for subscribed channel, messages from non-subscribed channels are ignored, service messages (no text/no media) are ignored, start throws on invalid session credentials (fail fast FR-015) in apps/worker/test/listener.spec.ts

### Implementation for User Story 1

- [x] T009 [US1] Implement `extractForwardJob`, `getChannelId`, `getMediaType`, `getMediaFileId`, `getCaption` functions in apps/worker/src/listener/message-extractor.ts
- [x] T010 [US1] Implement ListenerService with `start()` (connect client, load channels, register handler), `stop()`, `getClient()`, and `handleNewMessage()` — include service message filtering (skip if no text and no media) in apps/worker/src/listener/listener.service.ts
- [x] T011 [US1] Integrate DedupService into ListenerService: call `isDuplicate()` before enqueueing ForwardJob, call `markAsForwarded()` after successful enqueue in apps/worker/src/listener/listener.service.ts
- [x] T012 [US1] Wire ListenerService into worker bootstrap: instantiate after Redis/queue setup, call `start()`, handle graceful shutdown via `stop()` in apps/worker/src/main.ts

**Checkpoint**: Worker connects to Telegram, loads active channels from DB, receives messages, extracts content, deduplicates, and enqueues ForwardJobs. Non-subscribed channels and service messages are silently ignored. Invalid session causes immediate startup failure.

---

## Phase 3: User Story 2 — Group Album Messages into a Single Job (Priority: P1)

**Goal**: Collect album messages sharing the same `groupedId` within a 300ms window and emit a single combined ForwardJob.

**Independent Test**: Send an album of 3 photos to a subscribed channel, verify exactly one ForwardJob with `mediaGroup` array of 3 items is enqueued after the 300ms window.

### Tests for User Story 2

> **NOTE: Write these tests FIRST using `vi.useFakeTimers()`, ensure they FAIL before implementation**

- [x] T013 [US2] Write album grouper tests covering: collects messages within 300ms window into single job, emits job after 300ms timeout (not before), separate albums produce separate jobs, max 10 messages triggers immediate flush, `clear()` cancels pending timers in apps/worker/test/album-grouper.spec.ts

### Implementation for User Story 2

- [x] T014 [US2] Implement AlbumGrouper with `addMessage()`, `flush()`, `clear()` using Map-based buffer and 300ms timer in apps/worker/src/listener/album-grouper.ts
- [x] T015 [US2] Integrate AlbumGrouper into ListenerService: instantiate in constructor, delegate messages with `groupedId` to `addMessage()`, call `clear()` on `stop()` in apps/worker/src/listener/listener.service.ts

**Checkpoint**: Albums are correctly grouped — 3 photos with same groupedId become 1 ForwardJob with mediaGroup array of 3, emitted 300ms after last message.

---

## Phase 4: User Story 3 — Join and Leave Channels via Userbot (Priority: P1)

**Goal**: Provide join/leave operations with rate limiting (5/hour), random delay (2-5s), FloodWaitError handling, and DB updates.

**Independent Test**: Call joinChannel with a public channel username, verify the channel is joined, SourceChannel record is updated, and rate limiter blocks the 6th join within an hour.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T016 [P] [US3] Write channel manager tests covering: successful join returns ChannelInfo + updates DB, failed join deletes pending record, rate limiter blocks 6th join in 1 hour, rate limiter allows join after 1 hour expires, leave calls MTProto LeaveChannel in apps/worker/test/channel-manager.spec.ts
- [x] T017 [P] [US3] Write channel-ops consumer tests covering: processes join job by delegating to ChannelManager.joinChannel, processes leave job by delegating to ChannelManager.leaveChannel, failed job stores error in failedReason in apps/worker/test/channel-ops-consumer.spec.ts

### Implementation for User Story 3

- [x] T018 [US3] Implement ChannelManager with `joinChannel()` (rate limit check, random delay, MTProto join, DB update), `leaveChannel()`, and internal rate limiter in apps/worker/src/listener/channel-manager.ts
- [x] T019 [US3] Implement ChannelOpsConsumer BullMQ Worker that processes `channel-ops` queue jobs and delegates to ChannelManager in apps/worker/src/listener/channel-ops-consumer.ts
- [x] T020 [US3] Wire ChannelManager and ChannelOpsConsumer into worker bootstrap: create channel-ops queue, instantiate ChannelManager with listener client + prisma, start ChannelOpsConsumer in apps/worker/src/main.ts

**Checkpoint**: Channel join/leave works via BullMQ jobs, rate limiter enforces 5/hour, DB records updated on success, deleted on failure.

---

## Phase 5: User Story 4 — Auto-Reconnect on Disconnection (Priority: P2)

**Goal**: Ensure the GramJS client automatically reconnects after disconnection and resumes message processing.

**Independent Test**: Verify disconnect/reconnect logging is in place and GramJS `autoReconnect: true` + `connectionRetries: 10` are configured.

### Tests for User Story 4

- [x] T021 [US4] Write auto-reconnect tests covering: disconnect event logs `userbot_disconnected` at warn level, reconnect event logs `userbot_reconnected` at info level and reloads active channels in apps/worker/test/listener.spec.ts (extend existing file)

### Implementation for User Story 4

- [x] T022 [US4] Add disconnect and reconnect event handlers to ListenerService that log `userbot_disconnected` (warn) and `userbot_reconnected` (info), and reload active channels on reconnect in apps/worker/src/listener/listener.service.ts

**Checkpoint**: GramJS handles reconnection natively. Disconnect/reconnect events are logged, and active channel list is refreshed on reconnect.

---

## Phase 6: User Story 5 — Wire Channel API to Userbot Operations (Priority: P2)

**Goal**: POST /channels in the API triggers an actual Telegram join via the `channel-ops` BullMQ queue.

**Independent Test**: Call POST /channels with a username, verify a `channel-ops` job is enqueued with `{ operation: 'join', channelId, username }`.

### Tests for User Story 5

- [x] T023 [US5] Write channel-ops provider test covering: provider creates BullMQ Queue with correct name and connection, queue.add is called with join payload when triggered in apps/api/test/channel-ops.spec.ts

### Implementation for User Story 5

- [x] T024 [US5] Add `bullmq` as a dependency to apps/api/package.json (ioredis already present — verify version aligns with worker's ^5.9.2 to avoid type conflicts)
- [x] T025 [US5] Create BullMQ channel-ops queue provider (NestJS custom provider using `REDIS_CLIENT` and `QUEUE_NAME_CHANNEL_OPS`) in apps/api/src/channels/channel-ops.provider.ts
- [x] T026 [US5] Modify `ChannelsService.findOrCreate()` to enqueue a `channel-ops` join job after creating a pending SourceChannel record in apps/api/src/channels/channels.service.ts
- [x] T027 [US5] Update ChannelsModule to register channel-ops queue provider and inject into ChannelsService in apps/api/src/channels/channels.module.ts

**Checkpoint**: Creating a channel via the API enqueues a join job. The worker picks it up, joins via Telegram, and updates the DB record.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify full build, test suite, and lint pass across the monorepo

- [x] T028 Build shared package and then full monorepo via `pnpm turbo run build`
- [x] T029 Run full test suite via `pnpm turbo run test` and verify all tests pass
- [x] T030 Run lint across all packages via `pnpm turbo run lint` and fix any issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **User Story 1 (Phase 2)**: Depends on Setup completion — this is the MVP
- **User Story 2 (Phase 3)**: Depends on US1 (needs ListenerService to integrate album grouper)
- **User Story 3 (Phase 4)**: Depends on US1 (needs ListenerService.getClient() for ChannelManager)
- **User Story 4 (Phase 5)**: Depends on US1 (adds event handlers to ListenerService)
- **User Story 5 (Phase 6)**: Depends on Setup (shared constants) — independent of worker-side stories
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Setup → MVP deliverable
- **US2 (P1)**: Depends on US1 → integrates into ListenerService.handleNewMessage
- **US3 (P1)**: Depends on US1 → needs ListenerService.getClient() for ChannelManager
- **US4 (P2)**: Depends on US1 → adds event handlers to existing ListenerService
- **US5 (P2)**: Can start after Setup → only needs shared constants and API modifications

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Pure functions (message extractor) before services (listener)
- Services before integration (main.ts wiring)
- Core implementation before cross-module integration

### Parallel Opportunities

- T002 and T003 can run in parallel (different files in shared package)
- T007 and T008 can run in parallel (different test files)
- T016 and T017 can run in parallel (different test files)
- T024 can run in parallel with worker-side US3/US4 work (different app)
- US5 (API-side) can be worked on in parallel with US3/US4 (worker-side) after Setup

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Write message extractor tests in apps/worker/test/message-extractor.spec.ts"
Task: "Write listener service tests in apps/worker/test/listener.spec.ts"

# Then implement (sequentially — message extractor before listener service):
Task: "Implement message extractor in apps/worker/src/listener/message-extractor.ts"
Task: "Implement ListenerService in apps/worker/src/listener/listener.service.ts"
Task: "Integrate DedupService into ListenerService"
Task: "Wire ListenerService into main.ts"
```

## Parallel Example: US3 + US5

```bash
# These can run in parallel (different apps):
# Worker side:
Task: "Write channel manager tests"
Task: "Write channel-ops consumer tests"
Task: "Implement ChannelManager"
Task: "Implement ChannelOpsConsumer"
Task: "Wire into main.ts"

# API side (simultaneously):
Task: "Write channel-ops provider test"
Task: "Add bullmq to API"
Task: "Create channel-ops provider"
Task: "Modify ChannelsService"
Task: "Update ChannelsModule"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: User Story 1 (Receive and Queue Messages)
3. **STOP and VALIDATE**: Worker connects, receives messages, deduplicates, enqueues jobs
4. Deploy/demo if ready

### Incremental Delivery

1. Setup → Foundation ready
2. US1 → Messages flow from Telegram to queue with dedup (MVP!)
3. US2 → Albums grouped correctly
4. US3 → Join/leave via BullMQ commands
5. US4 → Auto-reconnect with logging
6. US5 → API wired to trigger joins
7. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- GramJS is CJS — imports work via Node's ESM interop (no special config needed)
- Worker Prisma client reuses the schema from `apps/api/prisma/schema.prisma` via `@prisma/client`
- API already has `ioredis` — T024 only adds `bullmq`, then verifies ioredis version alignment with worker's `^5.9.2`
