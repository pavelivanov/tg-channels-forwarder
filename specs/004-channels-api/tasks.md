# Tasks: Source Channel Management API

**Input**: Design documents from `/specs/004-channels-api/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/channels.md

**Tests**: Included — the feature specification explicitly requests 5 test scenarios.

**Organization**: Tasks are grouped by user story. US3 (error filter) is foundational since it affects all error responses. US1 and US2 share a module but deliver independent endpoints.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install dependencies, update schema, run migration

- [x] T001 Install `class-validator` and `class-transformer` dependencies in `apps/api/package.json`
- [x] T002 Add `@unique` constraint to `SourceChannel.username` in `apps/api/prisma/schema.prisma` and run migration (`prisma migrate dev --name add-unique-username-source-channel`)
- [x] T003 [P] Create `CreateChannelDto` in `apps/api/src/channels/dto/create-channel.dto.ts` — class with `username: string` field decorated with `@IsString()`, `@IsNotEmpty()`, `@Matches(/^[a-zA-Z0-9_]{5,32}$/)`, custom error message: "Username must be 5-32 characters, alphanumeric and underscores only". Apply `@Transform()` to trim whitespace before validation.
- [x] T004 [P] Register global `ValidationPipe` in `apps/api/src/main.ts` — `app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))`. Import `ValidationPipe` from `@nestjs/common`.

**Checkpoint**: Dependencies installed, schema migrated, DTO and validation pipe ready

---

## Phase 2: User Story 3 — Consistent Error Responses (Priority: P2, Foundational)

**Goal**: All error responses follow `{ statusCode, error, message }` shape. This is foundational because it affects all endpoints.

**Independent Test**: Trigger validation, auth, and server errors and verify all match the structure.

### Tests for User Story 3

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T005 [US3] Write error response tests in `apps/api/test/channels.spec.ts` — create the test file with env vars setup (DATABASE_URL, REDIS_URL, NODE_ENV, PORT, BOT_TOKEN, JWT_SECRET) and a `createInitData` helper (reuse pattern from `test/auth.spec.ts`). Test cases:
  - Validation error (POST /channels with invalid username) returns `{ statusCode: 400, error, message }` where all three fields are present and message is a string (not an array)
  - Authentication error (GET /channels without token) returns `{ statusCode: 401, error, message }` shape
  - Authentication error (POST /channels without token) returns same shape

### Implementation for User Story 3

- [x] T006 [US3] Implement `AllExceptionsFilter` in `apps/api/src/filters/http-exception.filter.ts` — catches all exceptions via `@Catch()`, normalizes to `{ statusCode, error, message }`. For `HttpException`: extract status and response. If `message` is an array (validation errors), join with "; ". For unknown exceptions: return 500 with "Internal server error" (no stack leak); log stack trace at `error` level for debugging. Log all caught exceptions at `warn` level (HttpException) or `error` level with stack trace (unknown) via NestJS `Logger` (Constitution III).
- [x] T007 [US3] Register `AllExceptionsFilter` globally in `apps/api/src/main.ts` — `app.useGlobalFilters(new AllExceptionsFilter())`. Must be registered AFTER the ValidationPipe.

**Checkpoint**: All error responses normalized — validation, auth, and server errors follow consistent shape

---

## Phase 3: User Story 1 — Browse Active Channels (Priority: P1) MVP

**Goal**: Authenticated users can retrieve a list of active source channels ordered by title.

**Independent Test**: Authenticate, call GET /channels, verify seeded active channels are returned ordered by title.

### Tests for User Story 1

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [US1] Add GET /channels tests to `apps/api/test/channels.spec.ts` — test cases:
  - GET /channels with valid JWT returns 200 with array of active channels ordered by title (verify seeded channels "Dev Updates" before "Tech News Channel")
  - GET /channels response includes all required fields: id, telegramId (string), username, title, subscribedAt, isActive (all true)
  - GET /channels filters out inactive channels (create an inactive channel in test setup, verify it's excluded)
  - GET /channels without auth token returns 401 (already covered in T005, but verify shape)

### Implementation for User Story 1

- [x] T009 [US1] Implement `ChannelsService.findAllActive()` in `apps/api/src/channels/channels.service.ts` — inject `PrismaService`, query `sourceChannel.findMany({ where: { isActive: true }, orderBy: { title: 'asc' } })`. Map results to serialize `telegramId` as string.
- [x] T010 [US1] Implement `ChannelsController` with `GET /channels` in `apps/api/src/channels/channels.controller.ts` — `@Get()` handler calling `ChannelsService.findAllActive()`. No `@Public()` decorator (requires auth via global guard).
- [x] T011 [US1] Create `ChannelsModule` in `apps/api/src/channels/channels.module.ts` — imports nothing extra (PrismaModule is global or imported), provides `ChannelsService`, declares `ChannelsController`.
- [x] T012 [US1] Import `ChannelsModule` in `apps/api/src/app.module.ts`
- [x] T013 [US1] Run T008 tests and verify they pass

**Checkpoint**: `GET /channels` returns active channels — MVP complete

---

## Phase 4: User Story 2 — Request New Channel Subscription (Priority: P1)

**Goal**: Authenticated users can submit a channel username to request subscription. Returns existing channel if found, creates pending record otherwise.

**Independent Test**: POST /channels with valid username creates pending record. POST again returns same record (idempotent). POST with existing active channel username returns it.

**Depends on**: User Story 1 (shares ChannelsService and ChannelsModule)

### Tests for User Story 2

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T014 [US2] Add POST /channels tests to `apps/api/test/channels.spec.ts` — test cases:
  - POST /channels with valid username creates new pending channel (isActive: false, telegramId is a negative string, title equals username)
  - POST /channels with same username again returns 200 (not 201) with the existing pending record (idempotent)
  - POST /channels with username of existing active channel returns 200 with the active channel
  - POST /channels with username of existing inactive channel returns 200 with the existing inactive record (no duplicate)
  - POST /channels with invalid username (too short: "ab") returns 400 with `{ statusCode, error, message }` shape
  - POST /channels with invalid username (contains @: "@chan") returns 400
  - POST /channels with whitespace-padded username ("  valid_name  ") creates channel with trimmed username
  - POST /channels without auth token returns 401

### Implementation for User Story 2

- [x] T015 [US2] Add `ChannelsService.findOrCreate(username: string)` in `apps/api/src/channels/channels.service.ts` — `findFirst({ where: { username } })`, if found return `{ channel, created: false }`. If not found, generate a unique placeholder telegramId via `-BigInt(Date.now())` (negative values avoid collision with real Telegram IDs and each other), then `create({ data: { telegramId: placeholderId, username, title: username, isActive: false } })` wrapped in try/catch for unique constraint violation (race condition on username: catch and re-fetch). Return `{ channel, created: true }`. Log new channel creation at `info` level.
- [x] T016 [US2] Add `POST /channels` handler to `ChannelsController` in `apps/api/src/channels/channels.controller.ts` — `@Post()` accepting `CreateChannelDto` body, calls `ChannelsService.findOrCreate(dto.username)`. If `created` is true, use `@HttpCode` or set status 201; if false, return 200. Serialize response with `telegramId` as string.
- [x] T017 [US2] Run T014 tests and verify they pass

**Checkpoint**: `POST /channels` works end-to-end — idempotent creation, validation, existing channel return

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Full verification, ensure existing tests still pass

- [x] T018 Run full monorepo verification: `pnpm turbo run build test lint`
- [x] T019 Verify existing tests still pass (auth.spec.ts, health.spec.ts, prisma.spec.ts) — the global exception filter and validation pipe should not break them

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US3 (Phase 2)**: Depends on Setup (needs ValidationPipe from T004 to test validation errors)
- **US1 (Phase 3)**: Depends on US3 (error filter must be active for consistent responses)
- **US2 (Phase 4)**: Depends on US1 (shares ChannelsService, ChannelsModule, ChannelsController)
- **Polish (Phase 5)**: Depends on US1 + US2 completion

### User Story Dependencies

- **User Story 3 (P2)**: Foundational — must complete first (affects all error responses)
- **User Story 1 (P1)**: Depends on US3 — creates the module skeleton (service, controller, module)
- **User Story 2 (P1)**: Depends on US1 — adds POST endpoint to existing controller/service

### Within Each User Story

- Tests FIRST → ensure they FAIL
- Service before controller
- Module wiring after components exist
- App-level wiring last (app.module.ts import)
- Verify tests pass after implementation

### Parallel Opportunities

Within Phase 1:
```
T003 (create-channel.dto.ts) | T004 (main.ts ValidationPipe)
```

Within Phase 3 (US1), after T008 tests:
```
T009 (channels.service.ts) → T010 (channels.controller.ts) → T011 (channels.module.ts) — sequential
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: User Story 3 (error filter — foundational)
3. Complete Phase 3: User Story 1 (GET /channels)
4. **STOP and VALIDATE**: GET /channels returns active channels, errors are consistent
5. Deploy/demo if ready — users can browse channels

### Full Delivery

1. Setup → US3 (error filter) → US1 (GET) → US2 (POST) → Polish
2. Sequential since US2 depends on US1 module skeleton
3. Total: 19 tasks, ~5 phases
