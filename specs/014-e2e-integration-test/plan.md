# Implementation Plan: End-to-End Integration Test

**Branch**: `014-e2e-integration-test` | **Date**: 2026-02-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-e2e-integration-test/spec.md`

## Summary

Create an integration test suite that verifies the complete message forwarding pipeline end-to-end: ForwardJob on BullMQ queue → QueueConsumer → ForwarderService → DedupService check → RateLimiterService → MessageSender (mocked grammY bot API). Tests use real Redis and real PostgreSQL with mocked bot API. Additionally, produce a manual testing guide for verifying the flow with real Telegram channels.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS
**Primary Dependencies**: Vitest, ioredis, bullmq, grammy (mocked), @prisma/client, pino
**Storage**: PostgreSQL 16 (real, via Docker Compose) + Redis 7 (real, via Docker Compose)
**Testing**: Vitest — integration tests with real infrastructure, mocked bot API
**Target Platform**: CI/local development (Docker Compose provides PostgreSQL + Redis)
**Project Type**: Monorepo — tests live in `apps/worker/test/`
**Performance Goals**: Each test case completes in under 10 seconds
**Constraints**: No real Telegram API calls in automated tests; bot API must be mocked/spied
**Scale/Scope**: ~6 integration test cases + 1 manual testing document

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode & Code Quality | PASS | Test files follow strict mode, no `any` types needed |
| II. Vitest Testing Standards | PASS | Using Vitest exclusively; tests are deterministic (mocked bot API, real Redis cleaned between tests); descriptive test names |
| III. Observability & Logging | PASS | Tests verify logging behavior via mock logger spies |
| IV. Performance Requirements | PASS | Tests validate pipeline latency indirectly; no new production code |
| V. Technology Stack & Monorepo | PASS | Tests live in `apps/worker/test/` within the Turborepo monorepo |
| VI. Docker-First Deployment | N/A | No new Dockerfiles or services; uses existing Docker Compose |
| VII. Data Architecture | PASS | No message persistence; Redis for dedup only (with TTL); Prisma for test fixtures |

**Quality Gates**:
- `turbo run lint` — test files must pass ESLint
- `turbo run test` — all tests (existing + new) must pass with zero failures
- `turbo run build` — no build impact (test files not included in build output)

**Post-design re-check**: All gates pass. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/014-e2e-integration-test/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output — test scenarios
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

Note: No `data-model.md` or `contracts/` needed — this feature adds no new entities or API endpoints.

### Source Code (repository root)

```text
apps/worker/test/
├── e2e-helpers.ts                 # Shared mock factories, Prisma fixtures, queue utilities
├── e2e-forward-pipeline.spec.ts   # US1: Core forward pipeline integration test
├── e2e-multi-destination.spec.ts  # US2: Multi-destination forwarding test
└── (existing test files unchanged)

docs/
└── MANUAL_TESTING.md              # US3: Manual testing guide
```

**Structure Decision**: Integration tests are placed alongside existing worker tests in `apps/worker/test/` with an `e2e-` prefix to distinguish them from unit tests. The manual testing guide lives in `docs/` at the repo root for discoverability.

## Test Architecture

### Infrastructure Setup

Each e2e test file manages its own lifecycle:

1. **Real Redis** — connect to `localhost:6379`, flush test keys in `beforeEach`
2. **Real PostgreSQL via Prisma** — use the existing Prisma client to insert test fixtures (users, source channels, subscription lists), clean up in `afterEach`
3. **Real BullMQ** — create test-specific queues with unique names to avoid collisions, obliterate in cleanup
4. **Mocked grammY Api** — spy on `sendMessage`, `sendPhoto`, etc. to assert forwarding without real Telegram calls
5. **Mocked pino logger** — verify log messages (correlation IDs, dedup skips, forward success)

### Service Wiring

Tests instantiate the real service chain manually (no NestJS DI needed since the worker uses plain classes):

```
QueueConsumer(queue, dlq, connection, forwarderService, logger)
  └── ForwarderService(messageSender, prisma, dedupService, rateLimiter, logger)
       ├── DedupService(redis, logger)           # real Redis
       ├── RateLimiterService(logger)             # real (no external deps)
       └── MessageSender(mockApi, logger)         # mocked grammY Api
```

### Test Data Strategy

- **User**: Direct Prisma `user.create()` with minimal fields
- **SourceChannel**: Direct Prisma `sourceChannel.create()` with `telegramId` matching ForwardJob's `sourceChannelId`
- **SubscriptionList**: Direct Prisma `subscriptionList.create()` linking source channels and destination channel IDs
- **Cleanup**: `afterEach` deletes created records via Prisma and flushes Redis test keys

### Queue Processing Strategy

Tests push a ForwardJob to the BullMQ queue and wait for the job to complete using BullMQ's event system:

```
1. Create a promise that resolves on worker 'completed' event
2. Push job via queue.add()
3. Await the completion promise (with timeout)
4. Assert on mock bot API calls
```

## Complexity Tracking

No constitution violations. No complexity justifications needed.
