# Tasks: Destination Channel Name Input

**Input**: Design documents from `/specs/015-destination-channel-name/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Backend — resolveChannel)

**Purpose**: Add the channel resolution capability to BotService that both user stories depend on.

- [ ] T001 Add `resolveChannel(username: string)` method to `apps/api/src/bot/bot.service.ts` — call `this.api.getChat("@" + username)`, return `{ id: number; title: string }`. Handle `GrammyError` by throwing `BadRequestException` with user-friendly message ("Channel not found or bot has no access"). Log resolution success at `info` and failure at `warn`.
- [ ] T002 Add unit tests for `resolveChannel` in `apps/api/test/bot.spec.ts` — test cases: successful resolution returns id+title, GrammyError (404) throws BadRequestException, non-Grammy error throws ServiceUnavailableException. Mock `getChat` alongside existing `getChatMember`/`getMe` mocks.

**Checkpoint**: `resolveChannel` method tested and working in isolation.

---

## Phase 2: User Story 1 — Enter Destination by Channel Name (Priority: P1) 🎯 MVP

**Goal**: Users create/edit subscription lists using `@username` instead of numeric channel ID. API resolves and stores both.

**Independent Test**: POST `/subscription-lists` with `destinationUsername: "testchannel"` → 201 with resolved `destinationChannelId` and stored `destinationUsername`.

### Implementation for User Story 1

- [ ] T003 [P] [US1] Update Create DTO in `apps/api/src/subscription-lists/dto/create-subscription-list.dto.ts` — remove `@IsInt() destinationChannelId`, make `destinationUsername` required with `@IsString() @IsNotEmpty() @Matches(/^@?[a-zA-Z][a-zA-Z0-9_]{3,}$/)`.
- [ ] T004 [P] [US1] Update Update DTO in `apps/api/src/subscription-lists/dto/update-subscription-list.dto.ts` — remove optional `@IsInt() destinationChannelId`, keep `destinationUsername` as optional with same `@Matches` validation.
- [ ] T005 [US1] Update `create()` in `apps/api/src/subscription-lists/subscription-lists.service.ts` — normalize username (strip `@`), call `botService.resolveChannel(username)` to get numeric ID, call `botService.verifyBotAdmin(id)`, store `destinationChannelId: BigInt(id)` and `destinationUsername`.
- [ ] T006 [US1] Update `update()` in `apps/api/src/subscription-lists/subscription-lists.service.ts` — when `dto.destinationUsername` is provided, resolve + verify + update both fields. Skip resolution when username unchanged.
- [ ] T007 [US1] Update test payloads in `apps/api/test/subscription-lists.spec.ts` — replace `destinationChannelId: number` with `destinationUsername: string` in all create/update request bodies. Mock `resolveChannel` in BotService mock (alongside `verifyBotAdmin`). Update response assertions.
- [ ] T008 [US1] Update test payloads in `apps/api/test/subscription-lists-bot-verify.spec.ts` — replace `destinationChannelId` with `destinationUsername` in all test cases. Add `resolveChannel` to mock BotService. Update assertions for resolution + verification flow.
- [ ] T009 [P] [US1] Update `SubscriptionList` interface in `apps/mini-app/src/types/index.ts` — remove `destinationChannelId` field (frontend no longer needs it).
- [ ] T010 [US1] Update `ListFormPage.tsx` in `apps/mini-app/src/pages/ListFormPage.tsx` — remove `destinationChannelId` state variable, change destination input to text field with label "Destination Channel", placeholder `@mychannel`. On submit, strip leading `@` from the value before sending `destinationUsername` (not `destinationChannelId`). On load (edit mode), populate from `list.destinationUsername` (fall back to numeric ID display if username is null for legacy lists).

**Checkpoint**: Full create/edit flow works with `@username`. All API and mini-app tests pass.

---

## Phase 3: User Story 2 — Validation and Error Feedback (Priority: P2)

**Goal**: Users see clear error messages for invalid, nonexistent, or inaccessible channels.

**Independent Test**: POST with `destinationUsername: "nonexistent_xyz"` → 400 with descriptive error message.

### Implementation for User Story 2

- [ ] T011 [US2] Add error display in `apps/mini-app/src/pages/ListFormPage.tsx` — show API error message near the destination field when submission fails due to channel resolution (distinguish from other errors). Clear error when user modifies the field.
- [ ] T012 [US2] Add edge-case tests in `apps/api/test/subscription-lists-bot-verify.spec.ts` — test: `resolveChannel` throws (channel not found) → 400 with "Channel not found" message; `resolveChannel` succeeds but `verifyBotAdmin` returns false → 400 with "bot not admin" message; username without `@` prefix is accepted.

**Checkpoint**: Invalid usernames produce clear, user-visible error messages. All tests pass.

---

## Phase 4: Polish & Validation

**Purpose**: Full validation across the monorepo.

- [ ] T013 Run `pnpm build` — verify all 6 packages build cleanly with no TypeScript errors.
- [ ] T014 Run `pnpm test` — verify all tests pass across api, worker, and mini-app.
- [ ] T015 Run `pnpm lint` — verify no lint errors. Fix any issues introduced by the changes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on Phase 1 (T001-T002) for `resolveChannel` method
- **Phase 3 (US2)**: Depends on Phase 2 (US1 must be working for error paths to be testable)
- **Phase 4 (Polish)**: Depends on Phase 2 + Phase 3

### Within Each Phase

- T003 and T004 are parallel (different DTO files)
- T003/T004 must complete before T005/T006 (service uses updated DTOs)
- T007 and T008 can run in parallel (different test files) after T005/T006
- T009 is parallel with backend tasks (different app)
- T010 depends on T009 (uses updated types)

### Parallel Opportunities

```
Phase 1:  T001 → T002

Phase 2:  T003 ─┐
          T004 ─┤→ T005 → T006 → T007 ─┐
          T009 ─┘              → T008 ─┤→ T010
                                       ┘
Phase 3:  T011, T012 (parallel after Phase 2)

Phase 4:  T013, T014, T015 (sequential validation)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Add `resolveChannel` to BotService
2. Complete Phase 2: Update DTOs, service, tests, and frontend
3. **STOP and VALIDATE**: All existing tests pass + new flow works
4. Ready for demo/deploy

### Incremental Delivery

1. Phase 1 → resolveChannel ready
2. Phase 2 (US1) → Core @username flow working → Deploy (MVP!)
3. Phase 3 (US2) → Error UX polished → Deploy
4. Phase 4 → Full validation → Merge

---

## Notes

- No database migration needed — `destinationUsername` field already exists in Prisma schema
- Worker/forwarder is untouched — continues using stored numeric `destinationChannelId`
- API response keeps `destinationChannelId` for backward compatibility; frontend ignores it
- Edge cases (private channels, stale usernames) are handled by existing `getChat` error responses
