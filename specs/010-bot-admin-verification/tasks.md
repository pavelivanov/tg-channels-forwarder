# Tasks: Bot Admin Verification & Destination Validation

**Input**: Design documents from `/specs/010-bot-admin-verification/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — spec explicitly requests 10 test cases (6 unit + 4 integration).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install grammY dependency in the API app

- [x] T001 Add `grammy` as a dependency to apps/api/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create BotModule and BotService — the core verification infrastructure all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

- [x] T002 [P] Write BotService unit tests covering: verifyBotAdmin returns true when bot is administrator, returns true when bot is creator, returns false when bot is regular member, returns false when getChatMember throws GrammyError 400 (channel not found), returns false when getChatMember throws GrammyError 403 (bot kicked/banned), throws ServiceUnavailableException on network error in apps/api/test/bot.spec.ts

### Implementation for Foundational

- [x] T003 [P] Implement BotService class with verifyBotAdmin(channelId: number): Promise<boolean> — create grammY Api instance from ConfigService BOT_TOKEN, cache bot user ID via api.getMe() in onModuleInit(), call api.getChatMember(channelId, botUserId) with 10s AbortSignal timeout, return true for status "administrator"/"creator", return false for GrammyError (400/403) and log at warn level with channelId context (NFR-002), throw ServiceUnavailableException for network/timeout errors and log at error level with channelId and error details (NFR-002) in apps/api/src/bot/bot.service.ts
- [x] T004 [P] Create BotModule as @Global() NestJS module that provides and exports BotService in apps/api/src/bot/bot.module.ts
- [x] T005 Register BotModule in AppModule imports array in apps/api/src/app.module.ts

**Checkpoint**: BotService is tested and implemented. BotModule is globally available for injection.

---

## Phase 3: User Story 1 — Prevent List Creation Without Bot Admin Access (Priority: P1) 🎯 MVP

**Goal**: Subscription list creation is blocked if the bot is not an administrator in the destination channel.

**Independent Test**: Mock BotService.verifyBotAdmin, POST /subscription-lists, verify 201 when admin and 400 with DESTINATION_BOT_NOT_ADMIN when not admin.

### Tests for User Story 1

- [x] T006 [US1] Write integration tests for creation verification: (1) list creation succeeds when BotService.verifyBotAdmin returns true — POST /subscription-lists returns 201, (2) list creation rejected with 400 and errorCode DESTINATION_BOT_NOT_ADMIN when BotService.verifyBotAdmin returns false in apps/api/test/subscription-lists-bot-verify.spec.ts

### Implementation for User Story 1

- [x] T007 [US1] Inject BotService into SubscriptionListsService constructor, add bot admin verification at the start of create() — call verifyBotAdmin(dto.destinationChannelId), if false throw a custom BotNotAdminException (extending BadRequestException) that includes errorCode "DESTINATION_BOT_NOT_ADMIN" and message "Please add the bot as an administrator to your destination channel before creating a subscription list." in the JSON response body; create BotNotAdminException class in apps/api/src/bot/bot-not-admin.exception.ts and use it in apps/api/src/subscription-lists/subscription-lists.service.ts

**Checkpoint**: List creation is blocked when bot is not admin. Existing creation tests continue to pass.

---

## Phase 4: User Story 2 — Prevent List Update to Unverified Destination (Priority: P1)

**Goal**: Subscription list destination channel updates are blocked if the bot is not an administrator in the new destination. Updates to other fields skip verification entirely (FR-003).

**Independent Test**: Mock BotService.verifyBotAdmin, PATCH /subscription-lists/:id with destinationChannelId, verify rejection. PATCH with only name field, verify no verification call.

### Tests for User Story 2

- [x] T008 [US2] Add integration tests for update verification to apps/api/test/subscription-lists-bot-verify.spec.ts: (1) list update rejected with 400 and errorCode DESTINATION_BOT_NOT_ADMIN when changing destination to non-admin channel, (2) list update succeeds when updating only name field without triggering verifyBotAdmin

### Implementation for User Story 2

- [x] T009 [US2] Add bot admin verification to SubscriptionListsService.update() — when dto.destinationChannelId is present, call verifyBotAdmin(dto.destinationChannelId) and throw BotNotAdminException if false; when destinationChannelId is NOT in the DTO, skip verification entirely in apps/api/src/subscription-lists/subscription-lists.service.ts

**Checkpoint**: Destination changes are verified. Non-destination updates are unaffected.

---

## Phase 5: User Story 3 — Handle Unreachable Destination Gracefully (Priority: P2)

**Goal**: Invalid channels, non-existent channels, and temporary Telegram API outages are handled with clear, appropriate errors.

**Independent Test**: Mock BotService.verifyBotAdmin to throw ServiceUnavailableException, verify API returns 503 with retry message.

### Tests for User Story 3

- [x] T010 [US3] Add integration test for service unavailable response to apps/api/test/subscription-lists-bot-verify.spec.ts: when BotService.verifyBotAdmin throws ServiceUnavailableException, POST /subscription-lists returns 503 with message "Unable to verify bot admin status. Please try again later."

### Implementation for User Story 3

No additional implementation needed — BotService already handles unreachable channels (returns false for GrammyError 400/403) and network errors (throws ServiceUnavailableException) from Phase 2. NestJS propagates the 503 exception automatically. This test validates the end-to-end error path.

**Checkpoint**: All error scenarios produce appropriate HTTP responses.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify full build, test suite, and lint pass across the monorepo

- [x] T011 Run `pnpm turbo run build` and fix any build errors
- [x] T012 Run `pnpm turbo run test` and verify all tests pass
- [x] T013 Run `pnpm turbo run lint` and fix any lint issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — this is the MVP
- **User Story 2 (Phase 4)**: Depends on US1 (same service file and test file)
- **User Story 3 (Phase 5)**: Depends on US1 (same test file, validates existing BotService behavior)
- **Polish (Phase 6)**: Depends on all user stories being complete

### Within Each Phase

- Tests written FIRST, verified to fail before implementation
- T002, T003, T004 can run in parallel (different files)
- T005 depends on T004 (BotModule must exist before registering in AppModule)
- T006 must complete before T007 (TDD)
- T007 must complete before T008 (same service file)
- T008 must complete before T009 (TDD)
- T010 depends on T006 (same test file, extends it)

### Parallel Opportunities

```
Phase 2 (parallel):
  T002 (bot.spec.ts) || T003 (bot.service.ts) || T004 (bot.module.ts)

After Foundational:
  US1 → US2 → US3 (sequential — same files modified)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T005)
3. Complete Phase 3: US1 — List creation verification (T006-T007)
4. **STOP and VALIDATE**: List creation is blocked for non-admin destinations
5. This is a deployable MVP that delivers core protection

### Incremental Delivery

1. Setup + Foundational → BotService ready
2. US1 (creation verification) → MVP deployed
3. US2 (update verification) → Full CRUD protection
4. US3 (error handling validation) → Robustness confirmed
5. Polish → Full monorepo verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- grammY `Api` class is used standalone (no bot.start(), no polling) — same pattern as worker app
- `api.getMe()` is called once in `onModuleInit()` and bot user ID is cached
- BotModule is `@Global()` so SubscriptionListsModule doesn't need to import it
- No Prisma schema changes — uses existing SubscriptionList.destinationChannelId
- BOT_TOKEN already validated in apps/api/src/env.schema.ts — no new env vars
- `AbortSignal.timeout(10_000)` enforces the 10-second verification timeout (FR-008)
