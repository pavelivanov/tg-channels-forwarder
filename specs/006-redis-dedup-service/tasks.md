# Tasks: Redis Connection & Deduplication Service

**Input**: Design documents from `/specs/006-redis-dedup-service/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/dedup-service.md, quickstart.md

**Tests**: Included — the feature specification explicitly defines test requirements for normalizeText, computeHash, isDuplicate, markAsForwarded, and health check.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create project scaffolding

- [x] T001 Install `ioredis` in `apps/api` (`pnpm --filter @aggregator/api add ioredis`) and `apps/worker` (`pnpm --filter @aggregator/worker add ioredis`). Install `@types/ioredis` as devDependency in both. Approve `ioredis` in `pnpm-workspace.yaml` `onlyBuiltDependencies` if needed.
- [x] T002 [P] Create `packages/shared/src/dedup/index.ts` with `normalizeText(text: string): string` — lowercase, strip non-word chars (preserve `\p{L}\p{N}\s`), collapse whitespace, trim, take first 10 words. See data-model.md for pipeline and examples.
- [x] T003 [P] Create `computeHash(text: string): string` in `packages/shared/src/dedup/index.ts` — SHA-256 hex digest using `node:crypto`. Deterministic: same input always produces same output.
- [x] T004 Re-export dedup functions from `packages/shared/src/index.ts` by adding `export * from './dedup/index.ts'`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Redis connection infrastructure that MUST be complete before user story work

**CRITICAL**: US4 (health check) cannot begin until this phase is complete. US1-US3 only need Phase 1.

- [x] T005 Create `apps/api/src/redis/redis.module.ts` — `@Global()` NestJS module with `useFactory` provider. Injection token: `REDIS_CLIENT`. Injects `ConfigService` to read `REDIS_URL`. Exports `REDIS_CLIENT`. See research.md R2 and quickstart.md §4.
- [x] T006 Register `RedisModule` in `apps/api/src/app.module.ts` imports array (before `HealthModule`).

**Checkpoint**: Redis client available via DI in API app, ioredis installed in worker.

---

## Phase 3: User Story 1 — Detect and Prevent Duplicate Forwarding (Priority: P1) MVP

**Goal**: The worker can check if a message is a duplicate for a destination and mark it as forwarded, using Redis-backed dedup keys.

**Independent Test**: Send same normalized text to same destination twice — first returns false, second returns true.

### Tests for User Story 1

- [x] T007 [P] [US1] Create `packages/shared/test/dedup.spec.ts` with unit tests for `normalizeText`: mixed case, punctuation, multiple spaces, short texts (< 10 words), empty strings, unicode (Cyrillic), punctuation-only input, text exceeding 10 words. See data-model.md examples table for expected outputs.
- [x] T008 [P] [US1] Add unit tests for `computeHash` in `packages/shared/test/dedup.spec.ts`: deterministic output (same input → same hash), returns 64-char hex string, different inputs produce different hashes.

### Implementation for User Story 1

- [x] T009 [US1] Create `apps/worker/src/dedup/dedup.service.ts` with `DedupService` class. Constructor takes `Redis` instance and `pino.Logger`. Implement `isDuplicate(destinationChannelId: number, text: string): Promise<boolean>` — normalizes text, computes hash, checks Redis key `dedup:{destinationChannelId}:{hash}` via `redis.exists()`. Returns `true` if key exists, `false` otherwise. On Redis error: log at `warn` level, return `false` (fail-open per FR-010). See contracts/dedup-service.md for full behavior spec.
- [x] T010 [US1] Implement `markAsForwarded(destinationChannelId: number, text: string): Promise<void>` in `apps/worker/src/dedup/dedup.service.ts` — normalizes text, computes hash, sets Redis key with value `"1"` and TTL `DEDUP_TTL_HOURS * 3600` seconds (uses constant from `@aggregator/shared`). On Redis error: log at `warn` level, do not throw.
- [x] T011 [US1] Create `apps/worker/test/dedup.spec.ts` with integration tests against real Redis: (1) `isDuplicate` returns false on first check, (2) after `markAsForwarded`, `isDuplicate` returns true for same destination, (3) same text for different destination returns false, (4) normalization-equivalent texts (different casing/punctuation) are detected as duplicates, (5) fail-open: when Redis is disconnected, `isDuplicate` returns false and `markAsForwarded` does not throw (test by calling `redis.disconnect()` before assertions, then reconnecting). Tests must connect to `redis://localhost:6379`, flush test keys before/after.

**Checkpoint**: Worker DedupService fully functional — core dedup cycle works end-to-end.

---

## Phase 4: User Story 2 — Skip Dedup for Empty Messages (Priority: P2)

**Goal**: Messages with empty/null/whitespace-only text always bypass dedup and return false from isDuplicate.

**Independent Test**: Call isDuplicate with empty string, whitespace-only, and punctuation-only text — all return false without touching Redis.

### Tests for User Story 2

- [x] T012 [US2] Add tests in `apps/worker/test/dedup.spec.ts`: (1) `isDuplicate` returns false for empty string `""`, (2) returns false for whitespace-only `"   "`, (3) returns false for punctuation-only `"...!!!"`, (4) `markAsForwarded` with empty text is a no-op (no Redis key created).

### Implementation for User Story 2

- [x] T013 [US2] Verify `isDuplicate` and `markAsForwarded` in `apps/worker/src/dedup/dedup.service.ts` early-return when `normalizeText(text)` produces an empty string. This should already be handled by T009/T010 implementation — confirm tests pass. If not, add the guard: `if (normalized === '') return false;` / `return;`.

**Checkpoint**: Empty/null/whitespace messages always bypass dedup.

---

## Phase 5: User Story 3 — Automatic Expiry of Dedup Records (Priority: P2)

**Goal**: Dedup records have a 72-hour TTL and expire automatically.

**Independent Test**: After `markAsForwarded`, verify the Redis key has a TTL of 259,200 seconds (±5s tolerance for test execution time).

### Tests for User Story 3

- [x] T014 [US3] Add test in `apps/worker/test/dedup.spec.ts`: after `markAsForwarded`, use `redis.ttl(key)` to verify the key TTL is approximately 259,200 seconds (72 hours). Use `DEDUP_TTL_HOURS` constant from `@aggregator/shared` to compute expected value. Allow ±5s tolerance.

### Implementation for User Story 3

- [x] T015 [US3] Verify `markAsForwarded` in `apps/worker/src/dedup/dedup.service.ts` uses `redis.set(key, '1', 'EX', DEDUP_TTL_SECONDS)` where `DEDUP_TTL_SECONDS = DEDUP_TTL_HOURS * 3600`. This should already be handled by T010 — confirm test passes.

**Checkpoint**: All dedup records expire after 72 hours.

---

## Phase 6: User Story 4 — API Health Check Includes Redis (Priority: P3)

**Goal**: The `GET /health` endpoint reports Redis connectivity status alongside database and memory checks.

**Independent Test**: Hit the health endpoint and verify the response includes `"redis": { "status": "up" }`.

### Tests for User Story 4

- [x] T016 [US4] Add test in `apps/api/test/health.spec.ts`: verify `GET /health` response includes `redis` key in `details` with `status: "up"` when Redis is running. Existing health tests for `memory_heap` and `database` must continue to pass.

### Implementation for User Story 4

- [x] T017 [P] [US4] Create `apps/api/src/redis/redis.health.ts` — `RedisHealthIndicator` class extending `HealthIndicator` from `@nestjs/terminus`. Inject `REDIS_CLIENT` (ioredis). Implement `isHealthy(key: string)`: calls `redis.ping()`, returns `this.getStatus(key, true)` on success, throws `HealthCheckError` with `this.getStatus(key, false, { message })` on failure. See research.md R3 and quickstart.md §5.
- [x] T018 [US4] Update `apps/api/src/health/health.module.ts` — add `RedisHealthIndicator` to `providers` array.
- [x] T019 [US4] Update `apps/api/src/health/health.controller.ts` — inject `RedisHealthIndicator`, add `() => this.redisHealth.isHealthy('redis')` to the `health.check()` array. See contracts/dedup-service.md for expected response shape.

**Checkpoint**: Health endpoint reports Redis status. Full health check response matches contract.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Full monorepo verification and cleanup

- [x] T020 Run `pnpm turbo run build test lint` from repo root. Fix any TypeScript, lint, or test failures across all packages.
- [x] T021 Verify all tests pass: shared unit tests (`packages/shared`), worker integration tests (`apps/worker`), API health tests (`apps/api`). Total expected: all existing tests + new dedup and health tests.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (ioredis installed) — BLOCKS US4 (health check needs RedisModule)
- **US1 (Phase 3)**: Depends on T001-T004 (ioredis + shared functions). Does NOT depend on Phase 2 (worker doesn't use NestJS DI).
- **US2 (Phase 4)**: Depends on US1 implementation (T009-T010). Tests empty-text edge cases of existing methods.
- **US3 (Phase 5)**: Depends on US1 implementation (T010). Tests TTL of existing markAsForwarded.
- **US4 (Phase 6)**: Depends on Phase 2 (T005-T006 RedisModule). Independent of US1-US3 (different app).
- **Polish (Phase 7)**: Depends on all previous phases

### Parallel Opportunities

- T002 and T003 can run in parallel (different functions, same file — coordinate)
- T007 and T008 can run in parallel (different test sections, same file — coordinate)
- US1 (Phase 3) and US4 (Phase 6) can run in parallel after Phase 1+2 complete (different apps: worker vs api)
- T017 can run in parallel with US1 tasks (different app)

---

## Parallel Example: Phase 1

```bash
# After T001 (install ioredis), launch in parallel:
Task: "Create normalizeText in packages/shared/src/dedup/index.ts"  # T002
Task: "Create computeHash in packages/shared/src/dedup/index.ts"    # T003
```

## Parallel Example: Phase 3 + Phase 6

```bash
# After Phase 2, launch in parallel:
Task: "Create DedupService in apps/worker/src/dedup/dedup.service.ts"  # T009 (US1)
Task: "Create RedisHealthIndicator in apps/api/src/redis/redis.health.ts"  # T017 (US4)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T006)
3. Complete Phase 3: User Story 1 (T007-T011)
4. **STOP and VALIDATE**: Run worker dedup tests, verify core cycle works
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Redis available in both apps
2. Add US1 → Core dedup works → Test independently (MVP!)
3. Add US2 → Empty messages bypass → Test edge cases
4. Add US3 → TTL verified → Test expiry
5. Add US4 → Health check extended → Test endpoint
6. Polish → Full monorepo green

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- US2 and US3 are primarily verification tasks — their implementation is embedded in US1's T009/T010
- Worker tests require real Redis running on localhost:6379 (Docker Compose)
- API health tests require both Redis and PostgreSQL
- The `DEDUP_TTL_HOURS` constant already exists in `packages/shared/src/constants/index.ts`
