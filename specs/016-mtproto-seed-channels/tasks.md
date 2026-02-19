# Tasks: MTProto Seed Channels

**Input**: Design documents from `/specs/016-mtproto-seed-channels/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Constitution requires tests for all new source files. Unit tests cover argument parsing, dedup, `@`-stripping, and mocked resolution error handling.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Add GramJS dependency and npm script to `apps/api`

- [x] T001 [P] Add `telegram` (GramJS) ^2.26.22 as a devDependency in `apps/api/package.json`
- [x] T002 [P] Add `"seed:channels": "tsx --env-file=.env prisma/seed-channels.ts"` script to `apps/api/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the seed script skeleton with argument parsing, env validation, MTProto client init, and Prisma client init

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create `apps/api/prisma/seed-channels.ts` with main entrypoint structure: parse CLI args (`process.argv`), extract `--join` flag, collect remaining args as channel usernames, split each arg by commas to support both `@a,@b,@c` and `@a @b @c` formats, strip `@` prefixes, deduplicate, validate non-empty (print usage and exit 1 if empty)
- [x] T004 Add environment variable validation in `apps/api/prisma/seed-channels.ts`: check `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`, and `DATABASE_URL` are present; exit with clear error message if any are missing
- [x] T005 Add MTProto client initialization in `apps/api/prisma/seed-channels.ts`: create `TelegramClient` with `StringSession`, connect, call `getMe()` to validate session; wrap in try/catch and exit with descriptive error on failure
- [x] T006 Add Prisma client initialization in `apps/api/prisma/seed-channels.ts`: create `PrismaClient` with `PrismaPg` adapter (same pattern as existing `apps/api/prisma/seed.ts`); ensure `$disconnect()` is called in finally block

**Checkpoint**: Script skeleton runs, validates env vars, connects to MTProto and Prisma, prints parsed usernames, then exits cleanly

- [x] T007 Write unit tests in `apps/api/test/seed-channels.spec.ts`: test argument parsing (comma-separated split, space-separated, mixed), `@` prefix stripping, deduplication of duplicate usernames, empty input validation (exits with usage message), and missing env var detection. Mock `TelegramClient` and `PrismaClient` — do not require live connections.

---

## Phase 3: User Story 1 - Seed Source Channels (Priority: P1) 🎯 MVP

**Goal**: Resolve channel usernames via MTProto and upsert into `SourceChannel` table

**Independent Test**: Run `pnpm seed:channels @durov,@telegram` and verify rows appear in the database with correct `telegramId`, `username`, and `title`

### Implementation for User Story 1

- [x] T008 [US1] Implement `resolveChannel(client, username)` function in `apps/api/prisma/seed-channels.ts`: call `client.getEntity(username)` to resolve channel, extract `id` (telegramId) and `title` from the returned `Api.Channel` entity, return `{ telegramId, title, username }`
- [x] T009 [US1] Implement `upsertChannel(prisma, channelData)` function in `apps/api/prisma/seed-channels.ts`: use `prisma.sourceChannel.upsert()` matching on `username`, create with `{ telegramId: BigInt(telegramId), username, title, isActive: true }`, update with `{ telegramId: BigInt(telegramId), title }`
- [x] T010 [US1] Implement the main processing loop in `apps/api/prisma/seed-channels.ts`: iterate over deduplicated usernames, call `resolveChannel()` then `upsertChannel()` for each, add 2-3 second random delay between iterations, track counters for seeded/skipped
- [x] T011 [US1] Add error handling per channel in the processing loop in `apps/api/prisma/seed-channels.ts`: catch resolution failures, log warning with username and error message, increment skipped counter, continue to next channel
- [x] T012 [US1] Add `FloodWaitError` handling in `resolveChannel()` in `apps/api/prisma/seed-channels.ts`: detect `FloodWaitError` from GramJS, extract wait seconds, log the wait, sleep for the required duration, retry resolution once
- [x] T013 [US1] Add summary output at end of main function in `apps/api/prisma/seed-channels.ts`: print total processed, seeded count, skipped count with reasons

**Checkpoint**: `pnpm --filter @aggregator/api seed:channels @durov,@telegram` resolves channels via MTProto and upserts them. Re-running produces updates, not duplicates. Invalid usernames are skipped with warnings.

---

## Phase 4: User Story 2 - Join Channels (Priority: P2)

**Goal**: When `--join` flag is provided, join each resolved channel via the userbot MTProto account

**Independent Test**: Run `pnpm seed:channels --join @somepublicchannel` and verify the userbot has joined the channel and the record has `isActive: true`

### Implementation for User Story 2

- [x] T014 [US2] Implement `joinChannel(client, telegramId)` function in `apps/api/prisma/seed-channels.ts`: call `client.invoke(new Api.channels.JoinChannel({ channel: telegramId }))`, handle `UserAlreadyParticipantError` gracefully (log info and continue), handle other errors by logging warning
- [x] T015 [US2] Integrate join step into the main processing loop in `apps/api/prisma/seed-channels.ts`: after successful resolve and before upsert, if `--join` flag is set, call `joinChannel()`; if join fails, still proceed with upsert (channel was resolved successfully)

**Checkpoint**: `pnpm --filter @aggregator/api seed:channels --join @somechannel` resolves, joins, and upserts. Without `--join`, no join attempt is made.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validation, cleanup, and build verification

- [x] T016 [P] Add `telegram` to `onlyBuiltDependencies` in `pnpm-workspace.yaml` if GramJS has install scripts that need approval (not needed — no install scripts)
- [x] T017 Verify `pnpm turbo run build` passes with the new devDependency in `apps/api`
- [x] T018 Verify `pnpm turbo run lint` passes for `apps/api/prisma/seed-channels.ts` and `apps/api/test/seed-channels.spec.ts`
- [ ] T019 Run quickstart.md scenario TS1 (basic seed) manually to validate end-to-end (requires live MTProto session)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001-T002 complete)
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T003-T007 complete)
- **User Story 2 (Phase 4)**: Depends on Phase 3 (US1 working — needs resolveChannel and upsert functions)
- **Polish (Phase 5)**: Depends on Phase 4 completion

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 — uses the same processing loop and resolve function; adds join step

### Within Each Phase

- T001 and T002 are independent [P] within Phase 1
- T003 → T004 → T005 → T006 are sequential (each extends the same file)
- T007 creates test file (separate file, depends on T003 for the functions to test)
- T008 → T009 → T010 → T011 → T012 → T013 are sequential (building on the processing loop)
- T014 → T015 are sequential (function then integration)

### Parallel Opportunities

- T001 and T002 can run in parallel (different sections of package.json)
- T016 can run in parallel with T017-T018 (different files)
- User stories are sequential for this feature (US2 extends the US1 processing loop in the same file)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (add dependency + script)
2. Complete Phase 2: Foundational (script skeleton with env/client init)
3. Complete Phase 3: User Story 1 (resolve + upsert loop)
4. **STOP and VALIDATE**: Run `pnpm seed:channels @durov,@telegram` and check database
5. This is a fully functional seed tool without the join feature

### Incremental Delivery

1. Setup + Foundational → Script skeleton runs and connects
2. Add US1 → Channels can be resolved and seeded (MVP!)
3. Add US2 → Join functionality for one-step setup
4. Polish → Build/lint verification

---

## Notes

- Most tasks modify a single file (`apps/api/prisma/seed-channels.ts`) — limited parallelism within stories; T007 creates a separate test file
- The script is a standalone CLI tool, not wired into the API runtime
- `telegram` is a devDependency — does not affect API production bundle
- No Prisma schema changes needed — uses existing `SourceChannel` model
