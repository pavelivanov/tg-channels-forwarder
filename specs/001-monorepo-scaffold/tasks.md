# Tasks: Monorepo Scaffold & Infrastructure

**Input**: Design documents from `/specs/001-monorepo-scaffold/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included — spec explicitly requests health endpoint test and shared constants import test.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `apps/<app>/src/`, `packages/<pkg>/src/` per plan.md structure

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Root monorepo configuration and shared packages that all apps depend on

- [x] T001 Create root `package.json` with `@aggregator` scope, pnpm `packageManager` field, and workspace scripts in `./package.json`
- [x] T002 Create `pnpm-workspace.yaml` defining `apps/*` and `packages/*` workspaces in `./pnpm-workspace.yaml`
- [x] T003 Create `turbo.json` with `build`, `dev`, `test`, and `lint` pipelines in `./turbo.json`
- [x] T004 Create root `.gitignore` with Node.js, TypeScript, and IDE patterns in `./.gitignore`
- [x] T005 Create root `.prettierrc` with shared Prettier configuration in `./.prettierrc`
- [x] T006 Create `.env.example` documenting all required environment variables (NODE_ENV, PORT, DATABASE_URL, REDIS_URL) in `./.env.example`
- [x] T007 [P] Create `packages/tsconfig/package.json` with `@aggregator/tsconfig` name and no-op `build`, `test`, `lint` scripts for Turborepo pipeline compatibility in `packages/tsconfig/package.json`
- [x] T008 [P] Create `packages/tsconfig/tsconfig.base.json` with `strict: true`, ES2022 target, NodeNext module resolution in `packages/tsconfig/tsconfig.base.json`
- [x] T009 [P] Create `packages/tsconfig/tsconfig.node.json` extending base with Node.js-specific options in `packages/tsconfig/tsconfig.node.json`
- [x] T010 [P] Create `packages/tsconfig/tsconfig.nestjs.json` extending node with `experimentalDecorators` and `emitDecoratorMetadata` in `packages/tsconfig/tsconfig.nestjs.json`
- [x] T011 Create `packages/eslint-config/package.json` with `@aggregator/eslint-config` name, ESLint 9, typescript-eslint dependencies, and no-op `build`, `test`, `lint` scripts for Turborepo pipeline compatibility in `packages/eslint-config/package.json`
- [x] T012 [P] Create `packages/eslint-config/index.js` exporting base flat config array with typescript-eslint rules in `packages/eslint-config/index.js`
- [x] T013 [P] Create `packages/eslint-config/nestjs.js` extending base config with NestJS-specific rules in `packages/eslint-config/nestjs.js`

**Checkpoint**: Shared tooling packages ready. `pnpm install` should succeed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared library package and infrastructure that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T014 Create `packages/shared/package.json` with `@aggregator/shared` name, build script, and Vitest dependency in `packages/shared/package.json`
- [x] T015 Create `packages/shared/tsconfig.json` extending `@aggregator/tsconfig/tsconfig.node.json` in `packages/shared/tsconfig.json`
- [x] T016 Create `packages/shared/vitest.config.ts` in `packages/shared/vitest.config.ts`
- [x] T017 Create `packages/shared/eslint.config.js` importing `@aggregator/eslint-config` base config in `packages/shared/eslint.config.js`
- [x] T018 Create `packages/shared/src/constants/index.ts` exporting `MAX_CHANNELS_PER_USER = 30`, `DEFAULT_MAX_LISTS = 1`, `DEDUP_TTL_HOURS = 72` in `packages/shared/src/constants/index.ts`
- [x] T019 Create `packages/shared/src/index.ts` re-exporting constants module in `packages/shared/src/index.ts`
- [x] T020 Run `pnpm install` and verify `turbo run build --filter=@aggregator/shared` succeeds

**Checkpoint**: Foundation ready — shared constants importable, user story implementation can begin.

---

## Phase 3: User Story 1 — Developer Bootstraps Local Environment (Priority: P1) MVP

**Goal**: Developer clones repo, runs `docker compose up`, API responds to health checks, worker logs startup.

**Independent Test**: `docker compose up` starts all services. `curl localhost:3000/health` returns 200. Worker logs structured JSON startup.

### Tests for User Story 1

- [x] T021 [P] [US1] Write health endpoint test asserting GET /health returns 200 with `{ status: "ok" }` in `apps/api/test/health.spec.ts`
- [x] T022 [P] [US1] Write worker startup test asserting pino logs structured startup message in `apps/worker/test/main.spec.ts`

### Implementation for User Story 1

- [x] T023 [P] [US1] Create `apps/api/package.json` with `@aggregator/api` name, NestJS 10, @nestjs/terminus, nestjs-pino, pino, pino-pretty, @nestjs/config, zod dependencies in `apps/api/package.json`
- [x] T024 [P] [US1] Create `apps/api/tsconfig.json` extending `@aggregator/tsconfig/tsconfig.nestjs.json` in `apps/api/tsconfig.json`
- [x] T025 [P] [US1] Create `apps/api/vitest.config.ts` in `apps/api/vitest.config.ts`
- [x] T026 [P] [US1] Create `apps/api/eslint.config.js` importing `@aggregator/eslint-config/nestjs` config in `apps/api/eslint.config.js`
- [x] T027 [US1] Create `apps/api/src/env.schema.ts` with Zod schema validating NODE_ENV, PORT, DATABASE_URL, REDIS_URL in `apps/api/src/env.schema.ts`
- [x] T028 [US1] Create `apps/api/src/health/health.module.ts` importing TerminusModule in `apps/api/src/health/health.module.ts`
- [x] T029 [US1] Create `apps/api/src/health/health.controller.ts` with GET /health using HealthCheckService and MemoryHealthIndicator (512MB threshold) in `apps/api/src/health/health.controller.ts`
- [x] T030 [US1] Create `apps/api/src/app.module.ts` importing HealthModule, LoggerModule.forRoot (nestjs-pino), ConfigModule.forRoot with Zod validate in `apps/api/src/app.module.ts`
- [x] T031 [US1] Create `apps/api/src/main.ts` bootstrapping NestJS with `bufferLogs: true`, `app.useLogger(app.get(Logger))`, listening on PORT in `apps/api/src/main.ts`
- [x] T032 [P] [US1] Create `apps/worker/package.json` with `@aggregator/worker` name, pino, pino-pretty, zod dependencies in `apps/worker/package.json`
- [x] T033 [P] [US1] Create `apps/worker/tsconfig.json` extending `@aggregator/tsconfig/tsconfig.node.json` in `apps/worker/tsconfig.json`
- [x] T034 [P] [US1] Create `apps/worker/vitest.config.ts` in `apps/worker/vitest.config.ts`
- [x] T035 [P] [US1] Create `apps/worker/eslint.config.js` importing `@aggregator/eslint-config` base config in `apps/worker/eslint.config.js`
- [x] T036 [US1] Create `apps/worker/src/config.ts` with standalone Zod env validation (NODE_ENV, REDIS_URL, WORKER_HEALTH_PORT) in `apps/worker/src/config.ts`
- [x] T037 [US1] Create `apps/worker/src/health.ts` with minimal HTTP server on WORKER_HEALTH_PORT (default 3001) returning `{ "status": "ok" }` in `apps/worker/src/health.ts`
- [x] T038 [US1] Create `apps/worker/src/main.ts` with pino logger, structured startup log, health server start, and process keep-alive in `apps/worker/src/main.ts`
- [x] T039 [P] [US1] Create `apps/mini-app/package.json` with `@aggregator/mini-app` name (no build) in `apps/mini-app/package.json`
- [x] T040 [P] [US1] Create `apps/mini-app/index.html` with minimal valid HTML placeholder in `apps/mini-app/index.html`
- [x] T041 [US1] Create `apps/mini-app/Dockerfile` with two-stage build (node builder → nginx:alpine runner) serving static files in `apps/mini-app/Dockerfile`
- [x] T042 [P] [US1] Create `apps/api/Dockerfile` with four-stage build (base → pruner → installer → runner) using `turbo prune --docker` in `apps/api/Dockerfile`
- [x] T043 [P] [US1] Create `apps/worker/Dockerfile` with four-stage build (base → pruner → installer → runner) using `turbo prune --docker` in `apps/worker/Dockerfile`
- [x] T044 [US1] Create `docker-compose.yml` with PostgreSQL 16, Redis 7, API, Worker, and Mini-App services in `docker-compose.yml`
- [x] T045 [US1] Create `docker-compose.dev.yml` with dev overrides (volume mounts, port mapping, hot reload commands) in `docker-compose.dev.yml`
- [x] T046 [US1] Run `pnpm install` and verify `turbo run build` succeeds for all packages
- [x] T047 [US1] Verify `turbo run test --filter=@aggregator/api` passes health endpoint test
- [x] T048 [US1] Verify `turbo run test --filter=@aggregator/worker` passes worker startup test

**Checkpoint**: User Story 1 complete. `docker compose up` starts all services. Health check returns 200. Worker logs startup.

---

## Phase 4: User Story 2 — Developer Builds and Lints All Packages (Priority: P2)

**Goal**: `turbo run build`, `turbo run lint`, and `turbo run test` all pass with zero errors.

**Independent Test**: Run all three Turborepo pipelines from repo root and verify zero failures.

### Implementation for User Story 2

- [x] T049 [US2] Verify `turbo run build` compiles all packages with zero TypeScript strict mode errors
- [x] T050 [US2] Verify `turbo run lint` passes ESLint across all packages with zero violations
- [x] T051 [US2] Verify `turbo run test` passes all tests (health endpoint + worker startup + shared constants)
- [x] T052 [US2] Verify second `turbo run build` (no changes) completes in <5s via cache

**Checkpoint**: User Story 2 complete. All Turborepo pipelines pass clean.

---

## Phase 5: User Story 3 — Developer Imports Shared Constants (Priority: P3)

**Goal**: `@aggregator/shared` constants are importable and type-checked across all consuming packages.

**Independent Test**: Import `MAX_CHANNELS_PER_USER` from `@aggregator/shared` in a test and verify value is `30`.

### Tests for User Story 3

- [x] T053 [P] [US3] Write constants import test asserting `MAX_CHANNELS_PER_USER === 30`, `DEFAULT_MAX_LISTS === 1`, `DEDUP_TTL_HOURS === 72` in `packages/shared/test/constants.spec.ts`

### Implementation for User Story 3

- [x] T054 [US3] Verify `turbo run test --filter=@aggregator/shared` passes constants import test

**Checkpoint**: User Story 3 complete. Shared constants importable with correct types and values.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T055 Run `turbo run lint` and fix any remaining violations across all packages
- [x] T056 Run `turbo run build && turbo run test` full pipeline validation
- [x] T057 Validate quickstart.md by following setup steps on a clean state
- [x] T058 [P] Verify Docker images for API, Worker, and Mini-App contain no dev dependencies or test files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (shared tooling packages)
- **User Story 1 (Phase 3)**: Depends on Phase 2 (shared constants, configs)
- **User Story 2 (Phase 4)**: Depends on Phase 3 (needs all apps to exist)
- **User Story 3 (Phase 5)**: Depends on Phase 2 (shared package only)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 — creates all apps and infrastructure
- **US2 (P2)**: Depends on US1 — validates pipelines across all packages
- **US3 (P3)**: Depends on Phase 2 only — can start in parallel with US1

### Within Each Phase

- Config files (package.json, tsconfig, eslint.config) before source files
- Source files before Dockerfiles
- Dockerfiles before Docker Compose
- All source before verification tasks

### Parallel Opportunities

- T007–T010: All tsconfig files can be created in parallel
- T012–T013: Both ESLint config files in parallel
- T023–T026, T032–T035, T039–T040: App package configs in parallel
- T042–T043: API and Worker Dockerfiles in parallel
- T021–T022, T053: All test files can be written in parallel
- US1 and US3 can run in parallel after Phase 2

---

## Parallel Example: Phase 1

```bash
# Create all tsconfig files in parallel:
Task: "T007 Create packages/tsconfig/package.json"
Task: "T008 Create packages/tsconfig/tsconfig.base.json"
Task: "T009 Create packages/tsconfig/tsconfig.node.json"
Task: "T010 Create packages/tsconfig/tsconfig.nestjs.json"

# Create both ESLint config exports in parallel:
Task: "T012 Create packages/eslint-config/index.js"
Task: "T013 Create packages/eslint-config/nestjs.js"
```

## Parallel Example: User Story 1

```bash
# Create all app package configs in parallel:
Task: "T023 Create apps/api/package.json"
Task: "T024 Create apps/api/tsconfig.json"
Task: "T025 Create apps/api/vitest.config.ts"
Task: "T026 Create apps/api/eslint.config.js"
Task: "T032 Create apps/worker/package.json"
Task: "T033 Create apps/worker/tsconfig.json"
Task: "T034 Create apps/worker/vitest.config.ts"
Task: "T035 Create apps/worker/eslint.config.js"
Task: "T039 Create apps/mini-app/package.json"
Task: "T040 Create apps/mini-app/index.html"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (shared tooling)
2. Complete Phase 2: Foundational (shared constants)
3. Complete Phase 3: User Story 1 (apps + Docker)
4. **STOP and VALIDATE**: `docker compose up`, health check, worker logs
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Tooling ready
2. User Story 1 → Docker environment works → MVP!
3. User Story 2 → All pipelines validated
4. User Story 3 → Cross-package imports verified
5. Polish → Final cleanup and validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
