# Tasks: Structured Logging & Health Check Finalization

**Input**: Design documents from `/specs/012-logging-health-check/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — spec requests 4 test scenarios (healthy, degraded, unhealthy, redaction).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared constants, interfaces, and LOG_LEVEL config used by all user stories

- [x] T001 [P] Add `LOG_REDACT_PATHS` constant array and `HEALTH_CHECK_TIMEOUT_MS = 3000` constant to packages/shared/src/constants/index.ts — the redact paths array should contain: `'req.headers.authorization'`, `'req.headers["x-api-key"]'`, `'*.password'`, `'*.token'`, `'*.secret'`, `'botToken'`, `'sessionString'`, `'config.BOT_TOKEN'`, `'config.TELEGRAM_SESSION'`, `'config.JWT_SECRET'`. Re-export from packages/shared/src/index.ts.
- [x] T002 [P] Add `HealthResponse`, `ServiceCheck`, `ConnectionCheck`, `QueueCheck`, and `HealthStatus` type/interfaces to packages/shared/src/interfaces/health.ts — HealthStatus is `'healthy' | 'degraded' | 'unhealthy'`, ServiceCheck has `status: 'up' | 'down'` and `latencyMs: number`, ConnectionCheck has `status: 'connected' | 'disconnected'`, QueueCheck has `active, waiting, failed, dlq` (all numbers), HealthResponse has `status: HealthStatus`, `uptime: number`, `checks: Record<string, ServiceCheck | ConnectionCheck | QueueCheck>`. Export all from packages/shared/src/index.ts.
- [x] T003 [P] Add optional `correlationId?: string` field to the `ForwardJob` interface in packages/shared/src/interfaces/forward-job.ts (or wherever ForwardJob is defined) and re-export from packages/shared/src/index.ts.
- [x] T004 [P] Add optional `LOG_LEVEL` to the API env schema in apps/api/src/env.schema.ts — add `LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional()` to the zod schema.
- [x] T005 [P] Add optional `LOG_LEVEL` to the worker config in apps/worker/src/config.ts — add `LOG_LEVEL` to the config object (read from `process.env.LOG_LEVEL`, no default — handled at pino init).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the `computeHealthStatus` utility function and write tests for it — the core status logic used by both API and worker health endpoints

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

- [x] T006 [P] Write health status logic unit tests in packages/shared/test/health.spec.ts covering: (1) all checks healthy → returns `healthy`, (2) postgres down → returns `unhealthy`, (3) redis down → returns `unhealthy`, (4) userbot disconnected → returns `degraded`, (5) DLQ > 0 → returns `degraded`, (6) postgres down AND userbot disconnected → returns `unhealthy` (most severe wins), (7) both DLQ > 0 and userbot disconnected → returns `degraded`. Import `computeHealthStatus` from `@aggregator/shared`.

### Implementation for Foundational

- [x] T007 [P] Create `computeHealthStatus` function in packages/shared/src/health/health-utils.ts — takes a checks object (with optional postgres, redis, userbot, bot, queue fields) and returns `HealthStatus`. Logic: if postgres or redis status is `'down'` → `'unhealthy'`; else if queue.dlq > 0 or userbot status is `'disconnected'` → `'degraded'`; else → `'healthy'`. Export from packages/shared/src/index.ts.

**Checkpoint**: Health status logic is implemented and tested. Ready for both API and worker health endpoint refactoring.

---

## Phase 3: User Story 1 — Comprehensive Health Monitoring (Priority: P1) 🎯 MVP

**Goal**: Health endpoint returns unified format with individual dependency checks and three-tier status logic.

**Independent Test**: Call health endpoint under different dependency states, verify response structure and status logic.

### Tests for User Story 1

- [x] T008 [P] [US1] Write API health controller unit tests in apps/api/test/health-status.spec.ts covering: (1) all-healthy scenario returns `{ status: 'healthy', uptime: ..., checks: { postgres: up, redis: up, bot: connected } }`, (2) database unreachable returns `unhealthy` with postgres `down`, (3) bot health check fails returns `degraded`, (4) when a dependency hangs past the timeout, check reports `down` with `latencyMs` >= `HEALTH_CHECK_TIMEOUT_MS` (FR-014). Mock PrismaService, RedisHealthIndicator, and BotService. Use Vitest.
- [x] T009 [P] [US1] Write worker health handler unit tests in apps/worker/test/health.spec.ts covering: (1) all-healthy returns `{ status: 'healthy', ... }` with all checks populated, (2) userbot disconnected returns `degraded`, (3) redis ping fails returns `unhealthy`, (4) DLQ > 0 returns `degraded`, (5) when postgres ping hangs past the timeout, check reports `down` with `latencyMs` >= `HEALTH_CHECK_TIMEOUT_MS` (FR-014). Mock Prisma, Redis, ListenerService, Api, and Queue instances.

### Implementation for User Story 1

- [x] T010 [US1] Add `isHealthy(): Promise<boolean>` method to apps/api/src/bot/bot.service.ts — calls `this.api.getMe()` inside a try/catch with a `Promise.race` against a 3-second timeout (use `HEALTH_CHECK_TIMEOUT_MS` from shared). Returns `true` on success, `false` on failure or timeout.
- [x] T011 [US1] Refactor the API health controller in apps/api/src/health/health.controller.ts — replace the current `@HealthCheck()` implementation with a custom `check()` method that: (1) pings Postgres via `prisma.$queryRaw` with timeout and measures latency, (2) pings Redis via the existing `RedisHealthIndicator` and measures latency, (3) calls `botService.isHealthy()` for bot status, (4) computes overall status using `computeHealthStatus` from `@aggregator/shared`, (5) returns the unified `HealthResponse` format with `status`, `uptime` (process.uptime() * 1000), and `checks`. Inject BotService into the controller (update health.module.ts to provide it). Wrap the entire handler in a top-level try/catch — if anything throws, return `{ status: 'unhealthy', uptime, checks: <partial data collected so far> }` instead of a 500 error.
- [x] T012 [US1] Add `isConnected(): boolean` method to apps/worker/src/listener/listener.service.ts — returns `this.client?.connected ?? false`.
- [x] T013 [US1] Refactor apps/worker/src/health.ts to return the unified `HealthResponse` format — change `startHealthServer` to accept a context object `{ prisma, redis, listener, api, forwardQueue, dlq, cleanupQueue, logger }` instead of individual queue params. The handler should: (1) ping Postgres via `prisma.$queryRaw(Prisma.sql\`SELECT 1\`)` with timeout and measure latency, (2) ping Redis via `redis.ping()` with timeout and measure latency, (3) get userbot status from `listener.isConnected()`, (4) get bot status by calling `api.getMe()` with timeout in try/catch, (5) get queue stats from `forwardQueue.getJobCounts()` and `dlq.getJobCounts('waiting')`, (6) compute overall status with `computeHealthStatus`, (7) return `{ status, uptime: process.uptime() * 1000, checks: { postgres, redis, userbot, bot, queue } }`. Wrap the entire handler in a top-level try/catch — if anything throws, return `{ status: 'unhealthy', uptime, checks: <partial data collected so far> }` instead of crashing. Keep the Bull Board dashboard route in non-production mode.
- [x] T014 [US1] Update apps/worker/src/main.ts to pass the new health context object to `startHealthServer` — pass `{ prisma, redis: connection, listener, api, forwardQueue: forwardQueue, dlq, cleanupQueue, logger }` instead of individual queue parameters.

**Checkpoint**: Both API and worker health endpoints return the unified format with dependency checks and three-tier status logic.

---

## Phase 4: User Story 2 — Structured Logging with Sensitive Data Redaction (Priority: P2)

**Goal**: Structured JSON logs with redaction and correlation ID tracing through the message pipeline.

**Independent Test**: Trigger operations, verify log format, redaction of sensitive fields, and correlation ID propagation.

### Tests for User Story 2

- [x] T015 [P] [US2] Write pino redaction unit tests in apps/worker/test/redaction.spec.ts — create a pino logger with `LOG_REDACT_PATHS` from shared, log an object containing `req.headers.authorization`, `botToken`, and `sessionString` fields, capture the output (use pino's `destination` to a writable stream), and verify all sensitive values are replaced with `[Redacted]`.
- [x] T016 [P] [US2] Write correlation ID propagation test in apps/worker/test/correlation.spec.ts — mock ListenerService to generate a correlationId, verify the ForwardJob passed to QueueProducer contains the correlationId, then verify that QueueConsumer's processJob creates a child logger with the correlationId. This tests the full flow from listener → queue → forwarder.

### Implementation for User Story 2

- [x] T017 [US2] Update API logger configuration in apps/api/src/app.module.ts — update `LoggerModule.forRoot({ pinoHttp: {...} })` to add: (1) `level` based on `process.env.LOG_LEVEL || (process.env.NODE_ENV !== 'production' ? 'debug' : 'info')`, (2) `redact` set to `LOG_REDACT_PATHS` from `@aggregator/shared`. Import the constant.
- [x] T018 [US2] Update worker pino configuration in apps/worker/src/main.ts — update the `pino({...})` call to add: (1) `level` based on `config.LOG_LEVEL || (config.NODE_ENV !== 'production' ? 'debug' : 'info')`, (2) `redact` set to `LOG_REDACT_PATHS` from `@aggregator/shared`.
- [x] T019 [US2] Add correlation ID generation in apps/worker/src/listener/listener.service.ts — in `handleNewMessage()`, generate `const correlationId = crypto.randomUUID()` (import `crypto` from `node:crypto`), add it to the ForwardJob object passed to `queueProducer.enqueueMessage(job)`, and include `correlationId` in the `message_received` debug log: `this.logger.debug({ channelId, messageId: message.id, correlationId }, 'message_received')`.
- [x] T020 [US2] Propagate correlation ID in apps/worker/src/queue/queue-consumer.ts — in the job processing method, extract `correlationId` from `job.data`, create a child logger via `this.logger.child({ correlationId })`, and use it for the job's log entries (`job_received`, `job_completed`, `job_failed`).
- [x] T021 [US2] Use correlation ID in apps/worker/src/forwarder/forwarder.service.ts — accept `correlationId` from the job data, create a child logger via `this.logger.child({ correlationId })`, and use it for all log entries within the `forward()` method.

**Checkpoint**: All logs are structured JSON, sensitive data is redacted, and correlation IDs trace messages end-to-end.

---

## Phase 5: User Story 3 — API Request Logging (Priority: P3)

**Goal**: Every HTTP request to the API is automatically logged with method, URL, status, and duration.

**Independent Test**: Make HTTP requests and verify each produces a structured log entry with the required fields.

### Implementation for User Story 3

- [x] T022 [US3] Enhance API request logging in apps/api/src/app.module.ts — update `LoggerModule.forRoot({ pinoHttp: {...} })` to add: (1) `genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID()` for unique request IDs, (2) exclude health endpoint from request logging via `exclude: [{ method: RequestMethod.ALL, path: 'health' }]` to avoid noisy health check logs. Import `crypto` from `node:crypto` and `RequestMethod` from `@nestjs/common`.
- [x] T023 [US3] Verify API request logging output by adding a test assertion to an existing API integration test (e.g., apps/api/test/health.spec.ts) — after making a request, verify that pino-http logged the request with `req.method`, `req.url`, `res.statusCode`, and `responseTime` fields. This may require capturing pino output in the test or asserting the LoggerModule is configured correctly.

**Checkpoint**: All API requests produce structured log entries. Health endpoint is excluded from request logging noise.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify full build, test suite, and lint pass across the monorepo

- [x] T024 Run `pnpm turbo run build` and fix any build errors
- [x] T025 Run `pnpm turbo run test` and verify all tests pass
- [x] T026 Run `pnpm turbo run lint` and fix any lint issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T002 (HealthResponse types) and T001 (constants) from Setup
- **User Story 1 (Phase 3)**: Depends on Foundational — this is the MVP
- **User Story 2 (Phase 4)**: Depends on Setup (T001 redact paths, T003 correlationId in ForwardJob)
- **User Story 3 (Phase 5)**: Depends on US2 (same LoggerModule config file modified)
- **Polish (Phase 6)**: Depends on all user stories being complete

### Within Each Phase

- T001, T002, T003, T004, T005 can all run in parallel (different files)
- T006, T007 can run in parallel (different files)
- T008, T009 can run in parallel (different apps)
- T010 must complete before T011 (health controller needs BotService.isHealthy)
- T012 must complete before T013 (health.ts needs ListenerService.isConnected)
- T013 depends on T011 being complete conceptually but operates in a different app
- T014 depends on T013 (main.ts passes context to health server)
- T015, T016 can run in parallel (different test files)
- T017 and T018 can run in parallel (different apps)
- T019 → T020 → T021 must be sequential (correlation ID flows through the pipeline)
- T022 depends on T017 (same LoggerModule config)
- T024 → T025 → T026 sequential (fix build before running tests, fix tests before lint)

### Parallel Opportunities

```
Phase 1 (all parallel):
  T001 (constants) || T002 (interfaces) || T003 (ForwardJob) || T004 (API env) || T005 (worker config)

Phase 2 (parallel):
  T006 (tests) || T007 (health-utils)

Phase 3 US1 (partial parallel):
  T008 (API health tests) || T009 (worker health tests)
  T010 (bot isHealthy) || T012 (listener isConnected) — parallel, different apps
  T011 (API health controller) — after T010
  T013 (worker health.ts) — after T012
  T014 (worker main.ts) — after T013

Phase 4 US2 (partial parallel):
  T015 (redaction test) || T016 (correlation test)
  T017 (API logger config) || T018 (worker logger config) — parallel, different apps
  T019 → T020 → T021 — sequential (pipeline order)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T007)
3. Complete Phase 3: US1 — Health endpoint refactoring (T008-T014)
4. **STOP and VALIDATE**: Health endpoints return unified format with status logic
5. This is a deployable MVP that provides comprehensive health monitoring

### Incremental Delivery

1. Setup + Foundational → shared constants, interfaces, health status logic ready
2. US1 (health endpoints) → MVP deployed, operators can monitor all dependencies
3. US2 (logging + redaction + correlation) → structured logs, sensitive data redacted
4. US3 (API request logging) → complete request audit trail
5. Polish → full monorepo verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- US1 and US2 are largely independent (different files), but US3 depends on US2 (same LoggerModule config)
- The API health endpoint does NOT include a `userbot` check (that's worker-only)
- The worker health endpoint includes ALL checks (postgres, redis, userbot, bot, queue)
- `computeHealthStatus` is shared to ensure consistent status logic across both apps
- No new dependencies — uses existing pino, nestjs-pino, @nestjs/terminus
- `LOG_REDACT_PATHS` is shared to ensure identical redaction in both apps
