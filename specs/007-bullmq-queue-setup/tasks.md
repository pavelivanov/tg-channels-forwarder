# Tasks: BullMQ Queue Setup

**Input**: Design documents from `/specs/007-bullmq-queue-setup/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/queue-services.md, quickstart.md

**Tests**: Included — the feature specification explicitly defines test requirements for enqueue/consume, retry/backoff, DLQ, and health check.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create shared types/constants

- [x] T001 Install `bullmq` in `apps/worker` (`pnpm --filter @aggregator/worker add bullmq`). Approve `bullmq` in `pnpm-workspace.yaml` `onlyBuiltDependencies` if it has native build scripts.
- [x] T002 [P] Create `packages/shared/src/queue/index.ts` with the `ForwardJob` interface and queue constants (`QUEUE_NAME_FORWARD`, `QUEUE_NAME_FORWARD_DLQ`, `QUEUE_MAX_ATTEMPTS`, `QUEUE_BACKOFF_DELAY`, `QUEUE_KEEP_COMPLETED`, `QUEUE_KEEP_FAILED`). See data-model.md for field types and constant values.
- [x] T003 Re-export queue module from `packages/shared/src/index.ts` by adding `export * from './queue/index.ts'`.

**Checkpoint**: Shared types and constants available for both worker and future API use.

---

## Phase 2: User Story 1 — Enqueue and Process Forward Jobs (Priority: P1) MVP

**Goal**: The worker can enqueue forwarding jobs via a producer and consume them via a consumer that logs the payload.

**Independent Test**: Enqueue a job with a valid ForwardJob payload, verify the consumer picks it up and the job reaches completed state.

### Tests for User Story 1

- [x] T004 [P] [US1] Create `apps/worker/test/queue.spec.ts` with integration tests against real Redis: (1) enqueued job is consumed and reaches completed state, (2) job payload in the consumer matches the original ForwardJob interface fields, (3) multiple jobs enqueued in rapid succession are all consumed, (4) worker emits error and logs warning when Redis connection is lost during operation (FR-010). Tests must connect to `redis://localhost:6379` with `maxRetriesPerRequest: null`, create Queue and Worker instances, clean up BullMQ keys before/after using `queue.obliterate({ force: true })`.

### Implementation for User Story 1

- [x] T005 [P] [US1] Create `apps/worker/src/queue/queue-producer.ts` — `QueueProducer` class. Constructor takes `Queue` instance and `pino.Logger`. Implement `enqueueMessage(job: ForwardJob): Promise<void>` — adds job to queue with name `'forward'`, logs at `info` level with `messageId` and `sourceChannelId`. See contracts/queue-services.md for full behavior spec.
- [x] T006 [P] [US1] Create `apps/worker/src/queue/queue-consumer.ts` — `QueueConsumer` class. Constructor takes `queueName`, `dlq` Queue, `connection` Redis, and `pino.Logger`. Creates a BullMQ `Worker<ForwardJob>` that logs job payload at `info` level. Listens to `completed` (log at `debug`), `failed` (if `attemptsMade >= attempts`, add to DLQ with full context per contracts/queue-services.md), and `error` (log at `error`) events. Exposes `close(): Promise<void>` for graceful shutdown.
- [x] T007 [US1] Update `apps/worker/src/main.ts` — create a Redis connection with `maxRetriesPerRequest: null`, instantiate `Queue` for `message-forward` with `defaultJobOptions` (3 attempts, exponential backoff 5s, removeOnComplete 1000, removeOnFail 5000), instantiate DLQ `Queue` for `message-forward-dlq`, create `QueueConsumer`, pass both queues to `startHealthServer`. Import constants from `@aggregator/shared`. See quickstart.md §6 for bootstrap pattern.

**Checkpoint**: Worker enqueues and consumes forwarding jobs. Core queue cycle works end-to-end.

---

## Phase 3: User Story 2 — Retry Failed Jobs with Dead Letter Queue (Priority: P1)

**Goal**: Jobs that fail processing retry with exponential backoff. After exhausting all attempts, they move to the dead letter queue.

**Independent Test**: Enqueue a job that always throws, verify it retries 3 times with increasing delays, then confirm it appears in the DLQ with full payload and failure reason.

### Tests for User Story 2

- [x] T008 [US2] Add tests in `apps/worker/test/queue.spec.ts`: (1) a job that always throws is retried 3 times (check `attemptsMade` on the final failure), (2) after 3 failures the job appears in the `message-forward-dlq` queue with `originalJobId`, `data`, `failedReason`, and `attemptsMade` fields, (3) exponential backoff is applied (verify delays between attempts increase — use BullMQ's `delay` in job options or observe `job.opts.backoff`). For retry tests, use minimal backoff delays (e.g., override to 100ms) to keep tests fast. Create a custom Worker with a processor that always throws, rather than using the QueueConsumer class, to control failure behavior precisely.

### Implementation for User Story 2

- [x] T009 [US2] Verify the DLQ logic in `apps/worker/src/queue/queue-consumer.ts` correctly handles the `failed` event: checks `job.attemptsMade >= (job.opts.attempts ?? 1)`, adds to DLQ with `{ originalJobId, originalQueue, data, failedReason, attemptsMade, timestamp }`. This should already be implemented in T006 — confirm tests pass. If not, add the DLQ event handler.

**Checkpoint**: Failed jobs retry with backoff and move to DLQ after exhaustion.

---

## Phase 4: User Story 3 — Health Check Reports Queue Statistics (Priority: P2)

**Goal**: The worker's health endpoint includes queue statistics: active, waiting, failed, delayed, and DLQ depth.

**Independent Test**: Hit the worker health endpoint, verify the response includes a `queue` object with numeric counts for each state.

### Tests for User Story 3

- [x] T010 [US3] Add tests in `apps/worker/test/queue.spec.ts`: (1) health endpoint returns `queue` object with `active`, `waiting`, `failed`, `delayed`, `dlq` fields all set to 0 when queue is empty, (2) after enqueuing a job, the `waiting` or `active` count increases accordingly. Tests should start the health server on a random port, make HTTP requests using `fetch`, and verify the JSON response shape.

### Implementation for User Story 3

- [x] T011 [US3] Update `apps/worker/src/health.ts` — change `startHealthServer` signature to accept optional `queue?: Queue` and `dlq?: Queue` parameters. When provided, call `queue.getJobCounts('active', 'waiting', 'failed', 'delayed')` and `dlq.getJobCounts('waiting')`, include as `response.queue = { ...counts, dlq: dlqCounts.waiting }`. Make the request handler `async`. See contracts/queue-services.md for response shape.
- [x] T012 [US3] Update existing `apps/worker/test/main.spec.ts` if it tests the health server — ensure it still passes with the new optional parameters (no queues passed = original `{ status: 'ok' }` response).

**Checkpoint**: Health endpoint reports accurate queue statistics.

---

## Phase 5: User Story 4 — Queue Management Dashboard (Priority: P3)

**Goal**: Developers can access a visual dashboard at `/admin/queues` to inspect queue state during development.

**Independent Test**: Navigate to the dashboard URL in a browser and verify it displays queue information.

### Implementation for User Story 4

- [x] T013 [US4] Install dashboard dependencies: `pnpm --filter @aggregator/worker add express` and `pnpm --filter @aggregator/worker add -D @bull-board/api @bull-board/express @types/express`.
- [x] T014 [US4] Create `apps/worker/src/dashboard.ts` — export `createDashboard(queues: Queue[]): ExpressAdapter` function. Creates `ExpressAdapter` with basePath `/admin/queues`, wraps queues in `BullMQAdapter`, calls `createBullBoard`. See quickstart.md §7 and research.md R6.
- [x] T015 [US4] Update `apps/worker/src/health.ts` — when `NODE_ENV !== 'production'`, replace the plain `http.createServer` with an Express app that mounts both the health endpoint at `/` and the dashboard adapter at `/admin/queues`. Fall back to plain HTTP server in production. Alternatively, mount dashboard on a separate port to avoid mixing concerns (implementation choice).

**Checkpoint**: Dashboard accessible at `/admin/queues` in development mode.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full monorepo verification and cleanup

- [x] T016 Run `pnpm turbo run build test lint` from repo root. Fix any TypeScript, lint, or test failures across all packages.
- [x] T017 Verify all tests pass: shared unit tests (`packages/shared`), worker integration tests (`apps/worker`), API tests (`apps/api`). Total expected: all existing tests + new queue tests.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 (Phase 2)**: Depends on T001-T003 (bullmq installed + shared types). This is the MVP.
- **US2 (Phase 3)**: Depends on US1 implementation (T005-T007). DLQ logic is part of the consumer created in US1.
- **US3 (Phase 4)**: Depends on T007 (main.ts bootstrap with queue instances). Independent of US2.
- **US4 (Phase 5)**: Depends on T001 (bullmq installed) and T007 (queue instances exist). Independent of US2/US3.
- **Polish (Phase 6)**: Depends on all previous phases

### Parallel Opportunities

- T002 can run in parallel with T001 (different package, no dep)
- T004, T005, and T006 can run in parallel (different files within US1)
- US3 (Phase 4) and US4 (Phase 5) can run in parallel after US1 completes (different files)

---

## Parallel Example: Phase 2 (US1)

```bash
# After T001-T003 (setup), launch in parallel:
Task: "Create QueueProducer in apps/worker/src/queue/queue-producer.ts"    # T005
Task: "Create QueueConsumer in apps/worker/src/queue/queue-consumer.ts"    # T006
Task: "Create queue integration tests in apps/worker/test/queue.spec.ts"   # T004
```

## Parallel Example: Phase 4 + Phase 5

```bash
# After US1 complete, launch in parallel:
Task: "Extend health server with queue stats in apps/worker/src/health.ts"  # T011 (US3)
Task: "Create dashboard in apps/worker/src/dashboard.ts"                     # T014 (US4)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: User Story 1 (T004-T007)
3. **STOP and VALIDATE**: Enqueue a job, verify consumer logs it
4. Deploy/demo if ready

### Incremental Delivery

1. Setup → Shared types and bullmq available
2. Add US1 → Core enqueue/consume works → Test independently (MVP!)
3. Add US2 → Retry/DLQ verified → Test failure scenarios
4. Add US3 → Health stats available → Test endpoint
5. Add US4 → Dashboard for debugging → Visual verification
6. Polish → Full monorepo green

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- US2 is primarily a verification phase — the DLQ logic is embedded in US1's QueueConsumer (T006)
- Worker tests require real Redis running on localhost:6379 (Docker Compose)
- BullMQ Worker requires `maxRetriesPerRequest: null` on its Redis connection (see research.md R2)
- Use `queue.obliterate({ force: true })` in test cleanup to remove all BullMQ keys
- The `ForwardJob` interface and queue constants already exist in `packages/shared/src/constants/index.ts` — queue constants go in the new `queue/index.ts` module
- Dashboard (US4) is optional (FR-009 uses SHOULD, not MUST)
