# Tasks: Forwarder Service

**Input**: Design documents from `/specs/009-forwarder-service/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — spec explicitly requests 8 test cases.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, add constants, configure BOT_TOKEN env var

- [x] T001 Add `grammy`, `@grammyjs/auto-retry`, and `bottleneck` as dependencies to apps/worker/package.json
- [x] T002 Add `FORWARD_GLOBAL_RATE_LIMIT` (20) and `FORWARD_PER_DEST_RATE_LIMIT` (15) constants to packages/shared/src/constants/index.ts
- [x] T003 Add `BOT_TOKEN` as a required string to the worker Zod env schema in apps/worker/src/config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the three service classes that all user stories depend on: MessageSender, RateLimiterService, and ForwarderService skeleton

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

- [x] T004 [P] Write MessageSender unit tests covering: sendText calls api.sendMessage with entities, sendPhoto calls api.sendPhoto with caption+entities, sendVideo calls api.sendVideo, sendDocument calls api.sendDocument, sendAnimation calls api.sendAnimation, sendAudio calls api.sendAudio, send() dispatches to correct method based on mediaType in apps/worker/test/message-sender.spec.ts
- [x] T005 [P] Write RateLimiterService unit tests covering: execute() calls the wrapped function, close() completes without error in apps/worker/test/rate-limiter.spec.ts

### Implementation for Foundational

- [x] T006 [P] Implement MessageSender class with sendText, sendPhoto, sendVideo, sendDocument, sendAnimation, sendAudio, sendAlbum, and send() dispatcher in apps/worker/src/forwarder/message-sender.ts
- [x] T007 [P] Implement RateLimiterService class with global limiter (20 msg/s) + per-destination Group limiter (15 msg/min) chained via bottleneck in apps/worker/src/forwarder/rate-limiter.service.ts
- [x] T008 Create ForwarderService skeleton with constructor accepting Api, PrismaClient, DedupService, RateLimiterService, logger — forward() method as stub in apps/worker/src/forwarder/forwarder.service.ts

**Checkpoint**: MessageSender and RateLimiterService are tested and implemented. ForwarderService skeleton exists.

---

## Phase 3: User Story 1 — Forward Text Messages (Priority: P1) 🎯 MVP

**Goal**: Text messages are consumed from the queue, routed to destination channels, and delivered with formatting preserved.

**Independent Test**: Mock a ForwardJob with text, verify api.sendMessage is called for each destination from the routing query.

### Tests for User Story 1

- [x] T009 [US1] Write ForwarderService test: text message is correctly sent to destination with formatting preserved — mock Prisma to return one subscription list, mock DedupService as not duplicate, verify MessageSender.send() is called with correct chatId and job in apps/worker/test/forwarder.spec.ts

### Implementation for User Story 1

- [x] T010 [US1] Implement ForwarderService.forward() — query active subscription lists for sourceChannelId via Prisma, collect unique destinationChannelIds, for each destination call dedup check then MessageSender.send() via RateLimiterService.execute(), mark as forwarded on success, log message_forwarded in apps/worker/src/forwarder/forwarder.service.ts
- [x] T011 [US1] Modify QueueConsumer to accept a ForwarderService instance and call forwarder.forward(job) inside the worker handler (replacing the stub comment) in apps/worker/src/queue/queue-consumer.ts
- [x] T012 [US1] Wire ForwarderService into main.ts — create grammY Api instance with BOT_TOKEN + auto-retry plugin, instantiate MessageSender, RateLimiterService, ForwarderService, pass ForwarderService to QueueConsumer constructor in apps/worker/src/main.ts
- [x] T013 [US1] Update main.spec.ts mocks to include ForwarderService and grammY Api mocks in apps/worker/test/main.spec.ts

**Checkpoint**: Text messages are forwarded end-to-end from queue to destination channels.

---

## Phase 4: User Story 2 — Forward Media Messages (Priority: P1)

**Goal**: Photo, video, document, animation, and audio messages are forwarded with captions and entities preserved.

**Independent Test**: Mock ForwardJobs with each media type, verify the correct grammY API method is called with fileId and caption.

### Tests for User Story 2

- [x] T014 [US2] Write MessageSender test: photo/video/document messages include caption and entities — verify sendPhoto passes fileId + caption + caption_entities, sendVideo/sendDocument/sendAnimation/sendAudio similarly in apps/worker/test/message-sender.spec.ts

### Implementation for User Story 2

No new implementation needed — MessageSender already handles all media types from T006. This test validates the contract.

**Checkpoint**: All media types are forwarded correctly.

---

## Phase 5: User Story 3 — Forward Albums (Priority: P1)

**Goal**: Albums (media groups) are sent as a single sendMediaGroup call.

**Independent Test**: Mock a ForwardJob with mediaGroup array, verify api.sendMediaGroup is called with correctly mapped InputMedia array.

### Tests for User Story 3

- [x] T015 [US3] Write MessageSender test: album is sent via sendMediaGroup — verify sendAlbum maps each ForwardJob in mediaGroup to InputMedia objects using InputMediaBuilder, only first item carries caption in apps/worker/test/message-sender.spec.ts

### Implementation for User Story 3

No new implementation needed — sendAlbum is implemented in T006. This test validates the album contract.

**Checkpoint**: Albums arrive as grouped media at destinations.

---

## Phase 6: User Story 4 — Deduplicate Messages (Priority: P2)

**Goal**: Duplicate messages are skipped per-destination, messages reaching the same destination via multiple lists are sent only once.

**Independent Test**: Mock DedupService.isDuplicate to return true, verify send is NOT called. Mock two lists with same destination, verify send is called once.

### Tests for User Story 4

- [x] T016 [US4] Write ForwarderService test: duplicate message is skipped (dedup hit) — mock isDuplicate returning true, verify MessageSender.send() is NOT called, verify message_deduplicated is logged in apps/worker/test/forwarder.spec.ts
- [x] T017 [US4] Write ForwarderService test: message reaching two different destinations is sent to both — mock Prisma returning two subscription lists with different destinationChannelIds, verify send() called twice in apps/worker/test/forwarder.spec.ts
- [x] T018 [US4] Write ForwarderService test: same message via two lists to same destination is sent only once — mock Prisma returning two lists with same destinationChannelId, verify send() called once and markAsForwarded called once in apps/worker/test/forwarder.spec.ts

### Implementation for User Story 4

Dedup is already integrated in ForwarderService.forward() from T010. Unique destination collection handles same-dest dedup. These tests validate the behavior.

**Checkpoint**: Duplicates are skipped. Same-destination across lists is deduplicated.

---

## Phase 7: User Story 5 — Rate Limiting (Priority: P2)

**Goal**: Global rate limit (20 msg/s) and per-destination rate limit (15 msg/min) are enforced.

**Independent Test**: Already covered by RateLimiterService unit tests (T005). Rate limiting is transparent to ForwarderService — it calls execute() and bottleneck handles queuing.

Rate limiting is fully implemented in T007 and wired in T010. No additional tasks needed.

**Checkpoint**: Rate limits are enforced via bottleneck.

---

## Phase 8: User Story 6 — Retry on Failure (Priority: P2)

**Goal**: 429 errors trigger BullMQ retry. Non-retryable errors exhaust 3 attempts and move to DLQ.

**Independent Test**: Mock GrammyError with error_code 429, verify the error is thrown (for BullMQ to catch). Verify after 3 failures job ends in DLQ.

### Tests for User Story 6

- [x] T019 [US6] Write ForwarderService test: 429 response triggers retry — mock MessageSender.send() throwing GrammyError with error_code 429, verify the error propagates (is not caught/swallowed) in apps/worker/test/forwarder.spec.ts
- [x] T020 [US6] Write ForwarderService test: job fails gracefully on non-retryable errors after 3 attempts — mock send() throwing a generic GrammyError, verify forward_failed is logged and error is thrown in apps/worker/test/forwarder.spec.ts

### Implementation for User Story 6

Error propagation is already implemented in ForwarderService.forward() from T010 (throw on GrammyError/HttpError). DLQ handling exists in QueueConsumer. These tests validate the error behavior.

**Checkpoint**: 429s propagate for BullMQ retry. Fatal errors are logged and re-thrown.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Verify full build, test suite, and lint pass across the monorepo

- [x] T021 Run `pnpm turbo run build` and fix any build errors
- [x] T022 Run `pnpm turbo run test` and verify all tests pass
- [x] T023 Run `pnpm turbo run lint` and fix any lint issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — this is the MVP
- **User Story 2 (Phase 4)**: Depends on Foundational — tests validate existing MessageSender
- **User Story 3 (Phase 5)**: Depends on Foundational — tests validate existing sendAlbum
- **User Story 4 (Phase 6)**: Depends on US1 (needs ForwarderService.forward() implemented)
- **User Story 5 (Phase 7)**: No additional tasks — covered by Foundational
- **User Story 6 (Phase 8)**: Depends on US1 (needs ForwarderService.forward() implemented)
- **Polish (Phase 9)**: Depends on all user stories being complete

### Within Each Phase

- Tests written FIRST, verified to fail before implementation
- T004, T005, T006, T007, T008 can run in parallel (different files)
- T009 must complete before T010 (TDD)
- T010 must complete before T011 (QueueConsumer depends on ForwarderService)
- T011 must complete before T012 (main.ts wiring depends on QueueConsumer signature)
- T014, T015 can run in parallel (different test cases in same file, but after T006)
- T016, T017, T018 can run in parallel (different test cases, after T010)
- T019, T020 can run in parallel (different test cases, after T010)

### Parallel Opportunities

```
Phase 2 (parallel):
  T004 (message-sender tests) || T005 (rate-limiter tests)
  T006 (message-sender impl) || T007 (rate-limiter impl) || T008 (forwarder skeleton)

After T010 (forwarder implemented):
  T014 (US2 tests) || T015 (US3 tests) || T016-T018 (US4 tests) || T019-T020 (US6 tests)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T008)
3. Complete Phase 3: US1 — Text forwarding (T009-T013)
4. **STOP and VALIDATE**: Text messages forward from queue to destinations
5. This is a deployable MVP that delivers core value

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (text forwarding) → MVP deployed
3. US2 + US3 (media + albums) → Full media support validated
4. US4 (dedup) → Duplicate prevention validated
5. US5 (rate limiting) → Already done in Foundational
6. US6 (retry) → Error handling validated
7. Polish → Full monorepo verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- grammY `Api` class is used standalone (no bot.start(), no polling)
- `@grammyjs/auto-retry` is installed as API transformer for transparent 429 handling
- bottleneck `Group` + `chain()` provides two-tier rate limiting
- ForwarderService is the only new class with real logic; MessageSender and RateLimiterService are thin wrappers
- QueueConsumer modification is minimal — inject ForwarderService, call forward()
- No Prisma schema changes — uses existing SubscriptionList/SubscriptionListChannel/SourceChannel
