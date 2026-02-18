# Research: End-to-End Integration Test

## R1: Integration Test Pattern for BullMQ Worker Pipeline

**Decision**: Instantiate the real service chain manually (plain class constructors) rather than using NestJS Test Module.

**Rationale**: The worker app (`apps/worker`) does not use NestJS — it's a plain Node.js application with manual dependency wiring in `main.ts`. The services (ForwarderService, DedupService, MessageSender, RateLimiterService, QueueConsumer) are plain classes accepting constructor arguments. Manual instantiation mirrors production wiring and avoids unnecessary NestJS test infrastructure.

**Alternatives considered**:
- NestJS Test.createTestingModule() — rejected because the worker doesn't use NestJS modules
- Importing main.ts directly — rejected because it starts the full app (listener, health server, etc.) which is too heavy for focused pipeline tests

## R2: Bot API Mocking Strategy

**Decision**: Create a mock grammY `Api` object with `vi.fn()` spies for each send method (`sendMessage`, `sendPhoto`, `sendVideo`, etc.), then pass it to `MessageSender` constructor.

**Rationale**: The `MessageSender` class accepts a grammY `Api` instance in its constructor. By providing a mock object with spied methods, we can assert exactly which send methods were called with which arguments, without making real Telegram API calls.

**Alternatives considered**:
- HTTP interceptor (nock/msw) to intercept Telegram API HTTP calls — rejected because it's more fragile and couples tests to Telegram's HTTP API format rather than the grammY abstraction layer
- vi.doMock('grammy') at module level — rejected because direct constructor injection is cleaner and doesn't require module mocking

## R3: Database Fixture Strategy

**Decision**: Use Prisma client directly to create test fixtures (user, source channels, subscription lists) and clean up after each test.

**Rationale**: The existing test patterns in `dedup.spec.ts` and `queue.spec.ts` already use real Redis with cleanup. Extending this to Prisma is consistent. Direct Prisma operations are faster and more predictable than going through HTTP API endpoints.

**Alternatives considered**:
- Test database seeding via Prisma `seed.ts` — rejected because we need different data per test case
- HTTP API calls to create test data — rejected per FR-006 (spec requires direct DB operations)

## R4: Queue Isolation Strategy

**Decision**: Use unique queue names per test file (e.g., `test-e2e-forward`, `test-e2e-multi-dest`) and obliterate queues in `beforeEach`/`afterAll`.

**Rationale**: The existing `queue.spec.ts` already uses this pattern with `TEST_QUEUE_NAME`. Using unique names per file prevents test interference when running in parallel.

**Alternatives considered**:
- Shared queue name with cleanup — rejected because parallel test execution could cause interference
- In-memory queue mock — rejected per FR-009 (spec requires real BullMQ queue)

## R5: Test Completion Detection

**Decision**: Use BullMQ Worker event listeners (`completed`, `failed`) wrapped in a Promise with a timeout to detect when a job has been processed.

**Rationale**: The existing `queue.spec.ts` uses this exact pattern. It's reliable and doesn't require polling.

**Alternatives considered**:
- Polling `queue.getJobCounts()` — rejected as slower and less deterministic
- `vi.waitFor()` with assertion — works but BullMQ events are more precise

## R6: Manual Testing Documentation Scope

**Decision**: Create `docs/MANUAL_TESTING.md` covering prerequisites, setup steps, test execution, and verification for the forwarding flow with real Telegram channels.

**Rationale**: The spec (FR-010, SC-005) requires a guide that enables a developer unfamiliar with the project to complete verification within 30 minutes. A standalone markdown file in `docs/` is the most discoverable location.

**Alternatives considered**:
- Inline documentation in README.md — rejected because it would clutter the main README
- Wiki page — rejected because the project doesn't use a wiki
