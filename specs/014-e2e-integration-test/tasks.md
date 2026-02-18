# Tasks: End-to-End Integration Test

**Input**: Design documents from `/specs/014-e2e-integration-test/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create shared test utilities used by all e2e test files

- [x] T001 Create shared e2e test helper with mock factories (grammY Api, pino logger), Prisma fixture creators (user, source channel, subscription list with cleanup), ForwardJob factory, and queue wait-for-completion utility in apps/worker/test/e2e-helpers.ts

  **Details**:
  - `createMockApi()`: Return object with `sendMessage`, `sendPhoto`, `sendVideo`, `sendDocument`, `sendAnimation`, `sendAudio`, `sendMediaGroup` as `vi.fn()` spies, plus `config: { use: vi.fn() }`
  - `createMockLogger()`: Return pino-shaped object with `info`, `warn`, `error`, `debug` as `vi.fn()`, `child()` returning itself
  - `createForwardJob(overrides?)`: Return ForwardJob with defaults (messageId: 1, sourceChannelId: 100, text: "Hello integration test", timestamp: Date.now())
  - `createTestFixtures(prisma)`: Insert a test user, source channel (telegramId matching ForwardJob default), and active subscription list linking them; return IDs for cleanup
  - `cleanupFixtures(prisma, ids)`: Delete subscription list, source channel link, source channel, and user by IDs
  - `waitForJob(worker, timeout?)`: Return a Promise that resolves with `{ status: 'completed' | 'failed', job }` by listening to worker events; reject on timeout (default 10s)

---

## Phase 2: User Story 1 — Forward Pipeline Integration Test (Priority: P1) 🎯 MVP

**Goal**: Verify the core forwarding pipeline end-to-end: queue → dedup → rate limit → bot API send

**Independent Test**: Push a ForwardJob to BullMQ queue, assert mockApi.sendMessage called with correct destination and content

- [x] T002 [US1] Create e2e-forward-pipeline.spec.ts with full test infrastructure and 4 test cases in apps/worker/test/e2e-forward-pipeline.spec.ts

  **Infrastructure setup** (beforeAll/beforeEach):
  - Connect to real Redis (`localhost:6379`)
  - Initialize Prisma client (import from `../src/prisma.ts` or instantiate PrismaClient directly)
  - Create test-specific BullMQ queues (`test-e2e-forward`, `test-e2e-forward-dlq`) with real Redis connection
  - Instantiate service chain per plan.md wiring:
    - `DedupService(redis, logger)` — real Redis
    - `RateLimiterService(logger)` — real
    - `MessageSender(mockApi, logger)` — mocked grammY Api
    - `ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger)`
    - `QueueConsumer(queue, dlq, connection, forwarderService, logger)` — real BullMQ Worker
  - Create DB fixtures via `createTestFixtures(prisma)` from e2e-helpers

  **Cleanup** (afterEach/afterAll):
  - Flush Redis keys matching `dedup:*`
  - Obliterate test queues
  - Close BullMQ worker
  - Delete DB fixtures via `cleanupFixtures()`
  - Disconnect Redis and Prisma

  **Test cases**:
  1. `it("forwards text message to destination channel")` — FR-001: Push ForwardJob, wait for completion, assert `mockApi.sendMessage` called once with (destinationChannelId, text, { entities })
  2. `it("skips duplicate message based on Redis dedup key")` — FR-002: Push same ForwardJob again, wait for completion, assert `mockApi.sendMessage` call count unchanged, assert logger called with "message_deduplicated"
  3. `it("forwards new message after duplicate is rejected")` — FR-003: Push ForwardJob with different text, wait for completion, assert `mockApi.sendMessage` called with new text
  4. `it("sends failed job to DLQ after max retries")` — FR-001/edge: Configure mockApi.sendMessage to reject with Error, push ForwardJob, wait for failure, assert DLQ queue has 1 job with original data

- [x] T003 [US1] Run e2e-forward-pipeline tests and fix any issues until all 4 test cases pass

**Checkpoint**: US1 complete — core forward pipeline verified end-to-end

---

## Phase 3: User Story 2 — Multi-Destination Forwarding Test (Priority: P2)

**Goal**: Verify that one source message fans out to multiple destination channels independently

**Independent Test**: Create 2 subscription lists sharing a source channel, push one ForwardJob, assert bot API called twice

- [x] T004 [US2] Create e2e-multi-destination.spec.ts with test infrastructure and 2 test cases in apps/worker/test/e2e-multi-destination.spec.ts

  **Infrastructure setup**: Same as T002 but with 2 subscription lists:
  - List A: sourceChannel → destinationA (e.g., -1001111111111)
  - List B: sourceChannel → destinationB (e.g., -1002222222222)
  - Use unique queue names (`test-e2e-multi-dest`, `test-e2e-multi-dest-dlq`)

  **Test cases**:
  1. `it("forwards message to both destination channels")` — FR-004: Push one ForwardJob, wait for completion, assert `mockApi.sendMessage` called exactly twice — once with destinationA, once with destinationB
  2. `it("respects per-destination dedup independence")` — FR-005: Pre-mark message as forwarded for destinationA only (via `dedupService.markAsForwarded(destinationA, text)`), push same ForwardJob, wait for completion, assert `mockApi.sendMessage` called once for destinationB only

- [x] T005 [US2] Run e2e-multi-destination tests and fix any issues until both test cases pass

**Checkpoint**: US2 complete — multi-destination fan-out and per-destination dedup verified

---

## Phase 4: User Story 3 — Manual Testing Documentation (Priority: P3)

**Goal**: Provide a step-by-step guide for manual verification with real Telegram channels

**Independent Test**: A developer can follow the guide and observe a real forwarded message

- [x] T006 [US3] Create manual testing guide in docs/MANUAL_TESTING.md

  **Sections**:
  1. **Prerequisites**: Telegram bot token (via @BotFather), 2 test Telegram channels (source + destination), bot added as admin to destination channel, GramJS session string for the userbot, Docker and Node.js installed
  2. **Environment Setup**: Copy `.env.example`, fill in `BOT_TOKEN`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION_STRING`, `DATABASE_URL`, `REDIS_URL`; run `docker compose up -d`; run `pnpm install && pnpm turbo run build`; run Prisma migrations
  3. **Database Setup**: Create user, source channel, and subscription list via Prisma Studio (`pnpm exec prisma studio`) or via provided SQL/script snippets
  4. **Start Services**: `docker compose up` or run API + worker locally
  5. **Test: Forward a Message**: Post a text message in the source channel → observe it appear in the destination channel within 5 seconds
  6. **Test: Dedup Verification**: Post the exact same message again → confirm it does NOT appear twice in the destination
  7. **Test: New Message**: Post a different message → confirm it IS forwarded
  8. **Troubleshooting**: Common issues (bot not admin, wrong channel ID, Redis not running, session string expired)

**Checkpoint**: US3 complete — manual testing guide ready for use

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validate everything works together

- [x] T007 Run full monorepo validation (`pnpm turbo run build test lint`) to verify all existing + new tests pass with zero failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 (Phase 2)**: Depends on T001 (shared helpers)
- **US2 (Phase 3)**: Depends on T001 (shared helpers); independent of US1
- **US3 (Phase 4)**: No code dependencies — can be written in parallel with US1/US2
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on T001 only — no dependencies on other stories
- **User Story 2 (P2)**: Depends on T001 only — independent of US1 (similar infrastructure, different test file)
- **User Story 3 (P3)**: No code dependencies — documentation only

### Parallel Opportunities

- T002 and T004 can run in parallel after T001 (different files, independent test suites)
- T006 can run in parallel with any other task (documentation, no code dependencies)

---

## Parallel Example: After T001

```bash
# These can all run in parallel:
Task T002: "Create e2e-forward-pipeline.spec.ts" (apps/worker/test/e2e-forward-pipeline.spec.ts)
Task T004: "Create e2e-multi-destination.spec.ts" (apps/worker/test/e2e-multi-destination.spec.ts)
Task T006: "Create docs/MANUAL_TESTING.md" (docs/MANUAL_TESTING.md)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: User Story 1 (T002, T003)
3. **STOP and VALIDATE**: Run e2e-forward-pipeline tests — 4 passing test cases
4. Core pipeline confidence achieved

### Incremental Delivery

1. T001 → Shared helpers ready
2. T002 + T003 → US1 verified (MVP!)
3. T004 + T005 → US2 verified (multi-destination)
4. T006 → US3 documented (manual testing)
5. T007 → Full validation pass

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests require Docker Compose services running (PostgreSQL + Redis)
- No new production code — this feature only adds test files and documentation
- The worker app uses plain classes (no NestJS), so service chain is wired manually in tests
- Edge cases from spec (no matching lists, Redis unavailable, media messages, albums) are already covered by existing unit tests in forwarder.spec.ts, dedup.spec.ts, and message-sender.spec.ts — not duplicated in e2e tests
