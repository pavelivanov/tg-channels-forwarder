# Tasks: Database Schema & Prisma Setup

**Input**: Design documents from `/specs/002-prisma-schema/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included — spec explicitly requests PrismaService connect/disconnect tests and seed data query tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `apps/api/` for Prisma schema, service, and tests
- Prisma schema: `apps/api/prisma/schema.prisma`
- Prisma seed: `apps/api/prisma/seed.ts`
- NestJS modules: `apps/api/src/prisma/`
- Tests: `apps/api/test/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install Prisma dependencies and configure the project

- [x] T001 Install `prisma` (devDependency) and `@prisma/client` (dependency) in `apps/api/package.json`
- [x] T002 Initialize Prisma with `npx prisma init` in `apps/api/` to create `apps/api/prisma/schema.prisma` with PostgreSQL provider and `DATABASE_URL` env reference
- [x] T003 Update `apps/api/package.json` to add `prisma generate` to the `build` script (before `tsc`) and configure `prisma.seed` command using `tsx`
- [x] T004 Add `@prisma/client` to `onlyBuiltDependencies` in `pnpm-workspace.yaml` if its postinstall requires it

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the Prisma schema with all four models — MUST be complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Define `User` model in `apps/api/prisma/schema.prisma` with fields: id (uuid, default), telegramId (BigInt, unique), firstName (String), lastName (String?), username (String?), photoUrl (String?), isPremium (Boolean, default false), maxLists (Int, default 1), createdAt (DateTime, default now), updatedAt (DateTime, updatedAt)
- [x] T006 Define `SourceChannel` model in `apps/api/prisma/schema.prisma` with fields: id (uuid, default), telegramId (BigInt, unique), username (String?), title (String), isActive (Boolean, default true), subscribedAt (DateTime, default now), updatedAt (DateTime, updatedAt)
- [x] T007 Define `SubscriptionList` model in `apps/api/prisma/schema.prisma` with fields: id (uuid, default), userId (FK to User), name (String), destinationChannelId (BigInt), destinationUsername (String?), isActive (Boolean, default true), createdAt (DateTime, default now), updatedAt (DateTime, updatedAt). Add `@@index([userId])`. Set `onDelete: Cascade` on User relation.
- [x] T008 Define `SubscriptionListChannel` model in `apps/api/prisma/schema.prisma` with fields: id (uuid, default), subscriptionListId (FK to SubscriptionList), sourceChannelId (FK to SourceChannel). Add `@@unique([subscriptionListId, sourceChannelId])`. Set `onDelete: Cascade` on both relations.

**Checkpoint**: Schema file complete with all four models, relationships, indexes, and cascade deletes

---

## Phase 3: User Story 1 — Developer Runs Migrations on Fresh Database (Priority: P1) 🎯 MVP

**Goal**: Generate the initial migration and verify it applies cleanly to a fresh PostgreSQL database

**Independent Test**: Start PostgreSQL via Docker Compose, run `npx prisma migrate deploy`, and verify all four tables exist with correct columns and constraints

### Tests for User Story 1

- [x] T009 [US1] Write test in `apps/api/test/prisma.spec.ts` that instantiates a raw `PrismaClient`, connects, queries each of the four tables (expect empty results), and disconnects cleanly (note: PrismaService does not exist yet — use PrismaClient directly)

### Implementation for User Story 1

- [x] T010 [US1] Generate initial migration by running `npx prisma migrate dev --name init` from `apps/api/` (creates `apps/api/prisma/migrations/<timestamp>_init/migration.sql`)
- [x] T011 [US1] Run `npx prisma generate` to produce typed Prisma client and verify it compiles with `tsc --noEmit`
- [x] T011a [US1] Add cascade delete test in `apps/api/test/prisma.spec.ts` that creates a User → SubscriptionList → SubscriptionListChannel chain, deletes the User, and verifies all child records are cascade-deleted. Also test SourceChannel deletion cascades to SubscriptionListChannel. (Covers FR-005, FR-006, SC-005)

**Checkpoint**: Migration applies to fresh PostgreSQL, all four tables created with correct schema, cascade deletes verified

---

## Phase 4: User Story 2 — Developer Seeds Test Data (Priority: P2)

**Goal**: Create a seed script that populates the database with one test user and two source channels

**Independent Test**: Run `npx prisma db seed`, then query and verify one user and two source channels exist

### Tests for User Story 2

- [x] T012 [US2] Add seed data query tests in `apps/api/test/prisma.spec.ts` that verify: one User exists with expected telegramId, two SourceChannels exist with expected titles, and all required fields are non-null

### Implementation for User Story 2

- [x] T013 [US2] Create seed script at `apps/api/prisma/seed.ts` that upserts one test user (telegramId: realistic value, firstName, username) and two source channels (telegramId: realistic values, title, isActive: true) using `prisma.user.upsert` and `prisma.sourceChannel.upsert` for idempotency

**Checkpoint**: Seed script runs idempotently, test data is queryable

---

## Phase 5: User Story 3 — API App Connects to Database via PrismaService (Priority: P3)

**Goal**: Create a PrismaService NestJS provider and integrate it into the API app with health check

**Independent Test**: Start the API app, verify health endpoint includes database status, verify clean shutdown

### Tests for User Story 3

- [x] T014 [US3] Add PrismaService lifecycle test in `apps/api/test/prisma.spec.ts` that verifies PrismaService can be resolved from NestJS testing module, connects on init, and disconnects on close. Include a failure-path test that verifies PrismaService surfaces a clear connection error when DATABASE_URL points to an unreachable host (covers edge case: DB unreachable at startup)

### Implementation for User Story 3

- [x] T015 [P] [US3] Create `apps/api/src/prisma/prisma.service.ts` — class extending PrismaClient, implements OnModuleInit (calls `$connect()`), OnModuleDestroy (calls `$disconnect()`)
- [x] T016 [P] [US3] Create `apps/api/src/prisma/prisma.module.ts` — `@Global()` module that provides and exports PrismaService
- [x] T017 [US3] Import PrismaModule in `apps/api/src/app.module.ts`
- [x] T018 [US3] Add Prisma database health indicator to `apps/api/src/health/health.controller.ts` — use `$queryRaw` or custom health indicator to check DB connectivity alongside existing memory check

**Checkpoint**: API starts with PrismaService, health endpoint reports database status, clean shutdown

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T019 Verify `turbo run build` succeeds across all packages (prisma generate + tsc)
- [x] T020 Verify `turbo run test` passes all tests including new prisma tests
- [x] T021 Verify `turbo run lint` passes with no new violations
- [x] T022 Run quickstart.md validation: `docker compose up -d postgres` → `npx prisma migrate deploy` → `npx prisma db seed` → `pnpm dev` → `curl /health`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — generates migration from schema
- **User Story 2 (Phase 4)**: Depends on User Story 1 — needs migration applied to seed
- **User Story 3 (Phase 5)**: Depends on Foundational — PrismaService needs generated client
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 (schema must exist to generate migration)
- **User Story 2 (P2)**: Depends on US1 (migration must be applied before seeding)
- **User Story 3 (P3)**: Depends on Phase 2 (needs generated Prisma client). Can run in parallel with US1/US2.

### Within Each User Story

- Tests written alongside or before implementation
- Schema/migration before service code
- Service code before integration (health check)

### Parallel Opportunities

- T005–T008 (schema models) are in a single file but logically sequential — executed as one editing session
- T015 and T016 (PrismaService + PrismaModule) can be created in parallel [P]
- US1 and US3 can start in parallel after Phase 2 (US3 doesn't need migration to create PrismaService)

---

## Parallel Example: User Story 3

```bash
# Launch PrismaService and PrismaModule creation in parallel:
Task: "Create PrismaService in apps/api/src/prisma/prisma.service.ts"
Task: "Create PrismaModule in apps/api/src/prisma/prisma.module.ts"

# Then sequentially:
Task: "Import PrismaModule in apps/api/src/app.module.ts"
Task: "Add DB health indicator to apps/api/src/health/health.controller.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install Prisma)
2. Complete Phase 2: Foundational (define all 4 models)
3. Complete Phase 3: User Story 1 (generate migration, verify it applies)
4. **STOP and VALIDATE**: `npx prisma migrate deploy` on fresh DB
5. Schema is usable by all subsequent features

### Incremental Delivery

1. Complete Setup + Foundational → Schema defined
2. Add User Story 1 → Migration generated and applied (MVP!)
3. Add User Story 2 → Seed data available for local dev
4. Add User Story 3 → PrismaService integrated, health check enhanced
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All four Prisma models are in a single `schema.prisma` file (Prisma convention)
- Tests require a running PostgreSQL instance — use Docker Compose
- Commit after each phase completion
- Stop at any checkpoint to validate story independently
