# Tasks: Fix Message Forwarding Bug

**Input**: Design documents from `/specs/020-fix-forwarding-bug/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included — explicitly requested in feature specification ("Cover it with tests").

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: No setup needed — this is a bug fix in an existing codebase. All infrastructure (Vitest, TypeScript, BullMQ, GramJS) is already in place.

_No tasks in this phase._

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core changes that MUST be complete before user story tests can pass.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Remove static `chats` filter from `NewMessage` event handler registration in `apps/worker/src/listener/listener.service.ts` — change `new NewMessage({ chats: channelIds, incoming: true })` to `new NewMessage({ incoming: true })`
- [x] T002 Add `addChannel(telegramId: number): void` and `removeChannel(telegramId: number): void` public methods to `ListenerService` in `apps/worker/src/listener/listener.service.ts` — updates the `activeChannelIds` Set and logs at info level
- [x] T003 Add optional `onChannelJoined` and `onChannelLeft` callback parameters to `ChannelOpsConsumer` constructor in `apps/worker/src/listener/channel-ops-consumer.ts` — invoke callbacks after successful join/leave operations in `processJob()`
- [x] T004 Wire `ChannelOpsConsumer` callbacks to `ListenerService` methods in `apps/worker/src/main.ts` — pass `(telegramId) => listener.addChannel(telegramId)` and `(telegramId) => listener.removeChannel(telegramId)` when constructing `ChannelOpsConsumer`

**Checkpoint**: Foundation ready — dynamic channel tracking is wired end-to-end. User story tests can now be written and verified.

---

## Phase 3: User Story 1 — Messages from newly-added channels are forwarded (Priority: P1) 🎯 MVP

**Goal**: Ensure messages from channels added after worker startup are tracked by the listener and forwarded correctly.

**Independent Test**: Start listener with initial channels, add a channel via `addChannel()`, send a message from that channel, verify it's enqueued. Remove a channel via `removeChannel()`, send a message, verify it's ignored.

### Tests for User Story 1

- [x] T005 [P] [US1] Add test "addChannel adds telegramId to active set and processes messages from it" in `apps/worker/test/listener.spec.ts` — start listener with channel 100, call `addChannel(200)`, fire message from channel 200, assert `enqueueMessage` called
- [x] T006 [P] [US1] Add test "removeChannel removes telegramId from active set and ignores messages from it" in `apps/worker/test/listener.spec.ts` — start listener with channel 100, call `removeChannel(100)`, fire message from channel 100, assert `enqueueMessage` NOT called
- [x] T007 [P] [US1] Add test "event handler is registered without chats filter" in `apps/worker/test/listener.spec.ts` — start listener, assert `addEventHandler` second argument does NOT contain a `chats` property (or verify it's `NewMessage({ incoming: true })`)
- [x] T008 [P] [US1] Add test "addChannel is idempotent — adding same channel twice does not cause issues" in `apps/worker/test/listener.spec.ts` — call `addChannel(200)` twice, fire one message from 200, assert `enqueueMessage` called once
- [x] T009 [P] [US1] Add test "after reconnect, dynamically-added channels are re-loaded from DB" in `apps/worker/test/listener.spec.ts` — start listener with channel 100, call `onReconnect()` with mock returning channels 100+300, fire message from channel 300, assert `enqueueMessage` called

**Checkpoint**: User Story 1 fully tested — dynamic channel add/remove works correctly.

---

## Phase 4: User Story 2 — All matching subscription lists receive forwarded messages (Priority: P2)

**Goal**: Verify the forwarder fans out to ALL active subscription lists matching a source channel.

**Independent Test**: Create a mock with 2 active subscription lists (different destinations) both containing the same source channel. Forward a message and verify it's sent to both destinations.

### Tests for User Story 2

- [x] T010 [P] [US2] Strengthen existing forwarder fan-out test in `apps/worker/test/forwarder.spec.ts` — add explicit assertion that the Prisma query includes `subscriptionListChannels: { some: { sourceChannel: { telegramId } } }` matching pattern alongside existing 2-destination send assertions
- [x] T011 [P] [US2] Add test "inactive subscription list destination is not sent to" in `apps/worker/test/forwarder.spec.ts` — mock Prisma to return only 1 active list (simulating DB filtering out inactive), forward job, assert `messageSender.send` called once (not twice)

**Checkpoint**: User Story 2 verified — fan-out to multiple destinations confirmed.

---

## Phase 5: User Story 3 — Forwarding covered by automated tests (Priority: P3)

**Goal**: Verify that `ChannelOpsConsumer` invokes the listener notification callbacks after successful join/leave operations, completing the end-to-end test coverage.

**Independent Test**: Create `ChannelOpsConsumer` with mock callbacks, process join/leave jobs, verify callbacks invoked with correct telegramId.

### Tests for User Story 3

- [x] T012 [P] [US3] Add test "onChannelJoined callback is invoked with telegramId after successful join" in `apps/worker/test/channel-ops-consumer.spec.ts` — pass mock `onChannelJoined` callback, process join job, assert callback called with `12345` (the mock joinChannel return value)
- [x] T013 [P] [US3] Add test "onChannelLeft callback is invoked with telegramId after successful leave" in `apps/worker/test/channel-ops-consumer.spec.ts` — pass mock `onChannelLeft` callback, process leave job, assert callback called with the telegramId from job data
- [x] T014 [P] [US3] Add test "callbacks are not invoked when join operation fails" in `apps/worker/test/channel-ops-consumer.spec.ts` — mock `joinChannel` to reject, process join job, assert `onChannelJoined` NOT called
- [x] T015 [P] [US3] Add test "backward compatibility — consumer works without callbacks" in `apps/worker/test/channel-ops-consumer.spec.ts` — create consumer without callbacks, process join job, assert no errors thrown (existing test behavior preserved)

**Checkpoint**: User Story 3 verified — channel-ops consumer correctly notifies listener on join/leave.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across the entire worker package.

- [x] T016 Run `pnpm turbo run build --filter=@aggregator/worker` and verify zero TypeScript errors
- [x] T017 Run `pnpm turbo run test --filter=@aggregator/worker` and verify all tests pass (existing + new)
- [x] T018 Run `pnpm turbo run lint --filter=@aggregator/worker` and verify zero lint errors
- [x] T019 Run quickstart.md validation — verify all 7 verification steps pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — existing project
- **Foundational (Phase 2)**: No external dependencies — can start immediately
  - T001 → T002 sequentially (same file: `listener.service.ts`)
  - T003 depends on nothing (separate file: `channel-ops-consumer.ts`)
  - T004 depends on T002 and T003 (wires them together in `main.ts`)
- **User Story 1 (Phase 3)**: Depends on T001 + T002 (listener changes)
- **User Story 2 (Phase 4)**: No dependencies on other phases — tests existing forwarder behavior
- **User Story 3 (Phase 5)**: Depends on T003 (channel-ops consumer changes)
- **Polish (Phase 6)**: Depends on all previous phases

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational T001 + T002 — tests the core fix
- **User Story 2 (P2)**: Independent — tests existing forwarder fan-out (no code changes needed)
- **User Story 3 (P3)**: Depends on Foundational T003 — tests callback wiring

### Within Each User Story

- Tests are written to initially FAIL (methods/callbacks don't exist yet)
- Foundational implementation (Phase 2) makes them pass
- Each story's tests can be run independently

### Parallel Opportunities

- **Phase 2**: T001→T002 sequential (same file), T003 in parallel with T001 (different file)
- **Phase 3**: All tests T005–T009 can be written in parallel
- **Phase 4**: T010–T011 can be written in parallel
- **Phase 5**: T012–T015 can be written in parallel
- **Cross-phase**: US2 tests (Phase 4) are independent and can run alongside US1 and US3 work

---

## Parallel Example: Foundational Phase

```bash
# These modify different files and can run in parallel:
Task: "T001 — Remove chats filter in listener.service.ts"
Task: "T003 — Add callbacks to channel-ops-consumer.ts"

# Then sequentially:
Task: "T002 — Add addChannel/removeChannel to listener.service.ts"
Task: "T004 — Wire callbacks in main.ts" (depends on T002 + T003)
```

## Parallel Example: All Test Phases

```bash
# All test tasks across US1, US2, US3 can run in parallel (different test files):
Task: "T005–T009 — Listener tests in listener.spec.ts"
Task: "T010–T011 — Forwarder tests in forwarder.spec.ts"
Task: "T012–T015 — Channel-ops tests in channel-ops-consumer.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T004) — ~30 minutes
2. Complete Phase 3: US1 tests (T005–T008) — ~20 minutes
3. **STOP and VALIDATE**: Run `pnpm turbo run test --filter=@aggregator/worker`
4. Deploy if passing — the core bug is fixed

### Incremental Delivery

1. Phase 2 → Foundational wiring complete
2. Phase 3 → US1 tests confirm dynamic tracking works → Deploy (MVP!)
3. Phase 4 → US2 tests confirm fan-out correctness
4. Phase 5 → US3 tests confirm callback wiring
5. Phase 6 → Full build/test/lint validation

---

## Notes

- Total tasks: **19**
- Tasks per user story: US1: 5, US2: 2, US3: 4, Foundational: 4, Polish: 4
- Parallel opportunities: T001+T003 parallel in Phase 2; all test phases can run in parallel
- Independent test criteria: Each US has its own checkpoint
- Suggested MVP scope: Phase 2 + Phase 3 (9 tasks) — fixes the core bug
- Implementation files modified: 3 source files, 2 test files (no new files)
