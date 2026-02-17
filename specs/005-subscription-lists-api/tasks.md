# Tasks: Subscription List CRUD API

**Input**: Design documents from `/specs/005-subscription-lists-api/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/subscription-lists.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `apps/api/src/` for source, `apps/api/test/` for integration tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the module skeleton and DTOs shared across all endpoints

- [x] T001 Create `SubscriptionListsModule` with controller and service stubs in `apps/api/src/subscription-lists/subscription-lists.module.ts`, `apps/api/src/subscription-lists/subscription-lists.controller.ts`, and `apps/api/src/subscription-lists/subscription-lists.service.ts`. Module imports `PrismaModule`. Service injects `PrismaService` and `Logger`. Controller injects service. All files use `.ts` import extensions per `rewriteRelativeImportExtensions`.
- [x] T002 [P] Create `CreateSubscriptionListDto` in `apps/api/src/subscription-lists/dto/create-subscription-list.dto.ts`. Fields: `name` (`@IsString()`, `@IsNotEmpty()`), `destinationChannelId` (`@IsInt()`), `destinationUsername` (`@IsOptional()`, `@IsString()`), `sourceChannelIds` (`@IsArray()`, `@ArrayNotEmpty()`, `@IsUUID('4', { each: true })`). Use `@Transform()` on `destinationChannelId` to handle string-to-number coercion if needed.
- [x] T003 [P] Create `UpdateSubscriptionListDto` in `apps/api/src/subscription-lists/dto/update-subscription-list.dto.ts`. All fields from `CreateSubscriptionListDto` but each decorated with `@IsOptional()`. `sourceChannelIds` uses `@IsArray()`, `@IsUUID('4', { each: true })` but NOT `@ArrayNotEmpty()` (omitting the field is valid, but providing an empty array is not — add `@ArrayMinSize(1)` for when array is present).
- [x] T004 Register `SubscriptionListsModule` in `apps/api/src/app.module.ts` imports array.

**Checkpoint**: Module skeleton registered, DTOs ready for validation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared service methods used across all CRUD operations

**⚠️ CRITICAL**: No user story endpoints can work correctly without these shared methods.

- [x] T005 Implement `countUserActiveLists(userId: string): Promise<number>` in `apps/api/src/subscription-lists/subscription-lists.service.ts`. Uses `prisma.subscriptionList.count({ where: { userId, isActive: true } })`.
- [x] T006 Implement `countUserSourceChannels(userId: string, excludeListId?: string): Promise<number>` in `apps/api/src/subscription-lists/subscription-lists.service.ts`. Uses `prisma.subscriptionListChannel.count()` with relational filtering through `subscriptionList` for `userId`, `isActive: true`, and optional `id: { not: excludeListId }` exclusion. See research.md Decision 2.
- [x] T007 Implement `validateSourceChannelIds(sourceChannelIds: string[]): Promise<string[]>` in `apps/api/src/subscription-lists/subscription-lists.service.ts`. Deduplicates input array (FR-013), queries `prisma.sourceChannel.findMany({ where: { id: { in: ids }, isActive: true } })`, compares returned IDs to input. Returns array of invalid/inactive IDs (empty if all valid). Throws `BadRequestException` with specific invalid IDs if any are found.
- [x] T008 Implement private `formatListResponse()` helper in `apps/api/src/subscription-lists/subscription-lists.service.ts`. Takes a Prisma `SubscriptionList` with included `subscriptionListChannels.sourceChannel` and maps to the API response shape: `{ id, name, destinationChannelId: String(bigint), destinationUsername, isActive, createdAt, sourceChannels: [{ id, telegramId: String(bigint), username, title }] }`. See research.md Decision 5.
- [x] T009 Implement `findListByIdAndUser(id: string, userId: string): Promise<SubscriptionList | null>` in `apps/api/src/subscription-lists/subscription-lists.service.ts`. Uses `prisma.subscriptionList.findFirst({ where: { id, userId, isActive: true } })`. Returns null if not found/not owned/soft-deleted. See research.md Decision 3.

**Checkpoint**: Foundation ready — all shared methods available for endpoint implementation.

---

## Phase 3: User Story 1 — Browse My Subscription Lists (Priority: P1) 🎯 MVP

**Goal**: Authenticated users can view all their active subscription lists with populated source channels.

**Independent Test**: Authenticate a user with seeded lists and source channels, call GET /subscription-lists, verify response contains active lists with `sourceChannels` array populated.

### Tests for User Story 1

- [x] T010 [US1] Write integration tests for GET /subscription-lists in `apps/api/test/subscription-lists.spec.ts`. Create test file with Vitest + NestJS testing setup (same pattern as `channels.spec.ts`): register `ValidationPipe` + `AllExceptionsFilter`, create test helpers for auth token generation. Tests: (1) returns active lists with populated sourceChannels for authenticated user, (2) returns empty array when user has no lists, (3) excludes soft-deleted lists, (4) returns 401 for unauthenticated request, (5) does not return other users' lists. Seed test data in `beforeAll`: create test user, source channels, and subscription lists with associations via Prisma.

### Implementation for User Story 1

- [x] T011 [US1] Implement `findAllActive(userId: string)` in `apps/api/src/subscription-lists/subscription-lists.service.ts`. Uses `prisma.subscriptionList.findMany({ where: { userId, isActive: true }, include: { subscriptionListChannels: { include: { sourceChannel: true } } } })`. Maps results through `formatListResponse()`.
- [x] T012 [US1] Implement `GET /subscription-lists` endpoint in `apps/api/src/subscription-lists/subscription-lists.controller.ts`. Extracts `userId` from JWT request (same pattern as auth guard — access `request.user.sub`). Calls `service.findAllActive(userId)`.

**Checkpoint**: User Story 1 fully functional — GET returns active lists with source channels.

---

## Phase 4: User Story 2 — Create a Subscription List (Priority: P1)

**Goal**: Authenticated users can create a subscription list with limit enforcement (list count and source channel count).

**Independent Test**: Create a list with valid inputs, verify 201 with populated response. Then test limit enforcement: exceed `maxLists` → 403, exceed 30 source channels → 403, invalid source channel IDs → 400, empty sourceChannelIds → 400.

### Tests for User Story 2

- [x] T013 [US2] Add integration tests for POST /subscription-lists in `apps/api/test/subscription-lists.spec.ts`. Tests: (1) creates list and returns 201 with populated sourceChannels, (2) returns 403 when list limit reached (`maxLists`), (3) returns 403 when source channel limit exceeded (30), (4) returns 400 for invalid/inactive source channel IDs, (5) returns 400 for empty sourceChannelIds, (6) returns 400 for missing required fields, (7) deduplicates source channel IDs in request, (8) returns 401 for unauthenticated request.

### Implementation for User Story 2

- [x] T014 [US2] Implement `create(userId: string, dto: CreateSubscriptionListDto)` in `apps/api/src/subscription-lists/subscription-lists.service.ts`. Steps: (1) fetch user to get `maxLists`, (2) call `countUserActiveLists()` and throw `ForbiddenException` if >= maxLists, (3) deduplicate `dto.sourceChannelIds`, (4) call `validateSourceChannelIds()`, (5) call `countUserSourceChannels()` and throw `ForbiddenException` if current + new > 30, (6) create list with `prisma.subscriptionList.create()` including nested `subscriptionListChannels: { create: ids.map(id => ({ sourceChannelId: id })) }`, (7) `this.logger.log()` with list ID and user ID on successful creation, (8) re-fetch with includes and return via `formatListResponse()`.
- [x] T015 [US2] Implement `POST /subscription-lists` endpoint in `apps/api/src/subscription-lists/subscription-lists.controller.ts`. Accepts `@Body() dto: CreateSubscriptionListDto`, extracts `userId`, calls `service.create(userId, dto)`, returns result with 201 status code.

**Checkpoint**: User Story 2 fully functional — POST creates lists with limit enforcement.

---

## Phase 5: User Story 3 — Update a Subscription List (Priority: P1)

**Goal**: Authenticated users can partially update a list's name, destination, or source channels with re-validated limits.

**Independent Test**: Create a list, update name only → verify only name changed. Update sourceChannelIds → verify full replacement. Update that would exceed limit → 403. Update non-owned list → 404. Update soft-deleted list → 404. Empty body → 400.

### Tests for User Story 3

- [x] T016 [US3] Add integration tests for PATCH /subscription-lists/:id in `apps/api/test/subscription-lists.spec.ts`. Tests: (1) updates name only, source channels unchanged, (2) replaces source channels when sourceChannelIds provided, (3) returns 403 when source channel limit exceeded on update (re-calculation excludes current list's channels), (4) returns 404 for non-owned list, (5) returns 404 for soft-deleted list, (6) returns 400 for empty body (no updatable fields), (7) returns 400 for invalid source channel IDs, (8) returns 401 for unauthenticated request.

### Implementation for User Story 3

- [x] T017 [US3] Implement `update(id: string, userId: string, dto: UpdateSubscriptionListDto)` in `apps/api/src/subscription-lists/subscription-lists.service.ts`. Steps: (1) check at least one field present in dto, throw `BadRequestException` if empty, (2) call `findListByIdAndUser()`, throw `NotFoundException` if null, (3) if `sourceChannelIds` present: deduplicate, validate, count channels excluding this list, check limit, (4) execute in `prisma.$transaction()`: update scalar fields + if sourceChannelIds provided, `deleteMany` existing associations then `createMany` new ones, (5) `this.logger.log()` with list ID and user ID on successful update, (6) re-fetch with includes and return via `formatListResponse()`. See research.md Decision 4.
- [x] T018 [US3] Implement `PATCH /subscription-lists/:id` endpoint in `apps/api/src/subscription-lists/subscription-lists.controller.ts`. Accepts `@Param('id', ParseUUIDPipe) id: string` and `@Body() dto: UpdateSubscriptionListDto`. Extracts `userId`, calls `service.update(id, userId, dto)`.

**Checkpoint**: User Story 3 fully functional — PATCH supports partial updates with limit re-validation.

---

## Phase 6: User Story 4 — Delete a Subscription List (Priority: P2)

**Goal**: Authenticated users can soft-delete a list (set `isActive: false`), freeing capacity for new lists and channels.

**Independent Test**: Create a list, DELETE it → 204. Verify it no longer appears in GET. Verify deleted list's channels don't count toward limits. DELETE again → 404. DELETE non-owned → 404.

### Tests for User Story 4

- [x] T019 [US4] Add integration tests for DELETE /subscription-lists/:id in `apps/api/test/subscription-lists.spec.ts`. Tests: (1) soft-deletes and returns 204, (2) deleted list excluded from GET response, (3) returns 404 for non-owned list, (4) returns 404 for already soft-deleted list, (5) returns 401 for unauthenticated request.

### Implementation for User Story 4

- [x] T020 [US4] Implement `remove(id: string, userId: string)` in `apps/api/src/subscription-lists/subscription-lists.service.ts`. Calls `findListByIdAndUser()`, throws `NotFoundException` if null, then `prisma.subscriptionList.update({ where: { id }, data: { isActive: false } })`. `this.logger.log()` with list ID and user ID on successful soft-delete.
- [x] T021 [US4] Implement `DELETE /subscription-lists/:id` endpoint in `apps/api/src/subscription-lists/subscription-lists.controller.ts`. Accepts `@Param('id', ParseUUIDPipe) id: string`, extracts `userId`, calls `service.remove(id, userId)`, returns 204 (`@HttpCode(HttpStatus.NO_CONTENT)`).

**Checkpoint**: User Story 4 fully functional — DELETE soft-deletes with ownership verification.

---

## Phase 7: User Story 5 — Limit Enforcement Across Operations (Priority: P2)

**Goal**: Verify limits work holistically across create, update, and delete — especially the shared `countUserSourceChannels` method with `excludeListId`.

**Independent Test**: Create lists up to limit → 403 on next create. Delete a list → can create again. Create multiple lists, verify aggregate channel count. Update channel set and verify re-calculation with exclusion.

### Tests for User Story 5

- [x] T022 [US5] Add integration tests for cross-operation limit enforcement in `apps/api/test/subscription-lists.spec.ts`. Tests: (1) list limit: create up to maxLists, reject next, delete one, create succeeds, (2) channel limit: create list that brings total to exactly 30 → succeeds (201), then create with 1 more channel → fails (403), (3) per-list counting: same channel in two lists counts twice toward limit, (4) update recalculation: update a list's channels from 5 to 3, verify freed capacity, (5) soft-delete frees capacity: delete a list, verify its channels no longer counted.

**Checkpoint**: All limit enforcement scenarios verified end-to-end.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Full monorepo verification and cleanup

- [x] T023 Run `pnpm turbo run build test lint` from repo root. Fix any TypeScript, lint, or test failures across all packages.
- [x] T024 Verify all integration tests pass: `pnpm --filter @aggregator/api exec vitest run test/subscription-lists.spec.ts`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (module + DTOs must exist) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — implements GET endpoint
- **US2 (Phase 4)**: Depends on Phase 2 — implements POST endpoint. Can parallelize with US1.
- **US3 (Phase 5)**: Depends on Phase 2 — implements PATCH endpoint. Can parallelize with US1/US2.
- **US4 (Phase 6)**: Depends on Phase 2 — implements DELETE endpoint. Can parallelize with US1/US2/US3.
- **US5 (Phase 7)**: Depends on Phases 3-6 (needs all CRUD endpoints working for holistic limit testing)
- **Polish (Phase 8)**: Depends on all prior phases

### User Story Dependencies

- **US1 (GET)**: Independent after Phase 2
- **US2 (POST)**: Independent after Phase 2
- **US3 (PATCH)**: Independent after Phase 2
- **US4 (DELETE)**: Independent after Phase 2
- **US5 (Limits)**: Depends on US1-US4 all being complete (cross-operation testing)

### Within Each User Story

- Tests written first (TDD approach)
- Service methods before controller endpoints
- Story complete before its checkpoint

### Parallel Opportunities

- T002 and T003 can run in parallel (separate DTO files)
- US1 through US4 can all start after Phase 2 completes (different service methods + single controller file limits parallelism to service-then-controller)
- In practice, sequential P1 → P1 → P1 → P2 order is recommended since all endpoints share the same controller and service files

---

## Parallel Example: Phase 1

```bash
# After T001 (module skeleton):
Task: "T002 - Create CreateSubscriptionListDto" (separate file)
Task: "T003 - Create UpdateSubscriptionListDto" (separate file)
```

## Parallel Example: Phase 2

```bash
# T005-T009 are all in the same service file, so they run sequentially.
# However, they build incrementally on the service, so each is a clear unit of work.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (module + DTOs)
2. Complete Phase 2: Foundational (shared service methods)
3. Complete Phase 3: User Story 1 (GET endpoint)
4. **STOP and VALIDATE**: Run tests for GET /subscription-lists
5. The read endpoint is usable independently

### Incremental Delivery

1. Setup + Foundational → Module ready
2. US1 (GET) → Read endpoint works → MVP
3. US2 (POST) → Create + read works
4. US3 (PATCH) → Full write operations
5. US4 (DELETE) → Full CRUD
6. US5 (Limits) → Holistic limit verification
7. Polish → Full monorepo build/test/lint pass

---

## Notes

- All service methods and controller endpoints are in the same pair of files (`subscription-lists.service.ts` and `subscription-lists.controller.ts`), limiting parallelism within phases.
- Tests are written before implementation per TDD approach (spec mentions 7 test scenarios in SC-006).
- BigInt fields serialized as strings in responses (consistent with channels feature 004).
- The `rewriteRelativeImportExtensions` tsconfig option means all `.ts` extensions in imports.
- `ParseUUIDPipe` on `:id` params gives automatic 400 for malformed UUIDs.
