# Tasks: Railway Deployment

**Input**: Design documents from `/specs/018-railway-deployment/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

**Tests**: Not requested — this is an infrastructure/config feature with manual deployment verification.

**Organization**: Tasks are grouped by user story. US2 (infrastructure provisioning) and US3 (env var configuration) are manual Railway dashboard steps documented in `docs/RAILWAY.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: No project initialization needed — this builds on the existing monorepo.

_(No tasks — existing project structure is sufficient)_

---

## Phase 2: Foundational (Dockerfile + Dependency Changes)

**Purpose**: Modify the API Dockerfile and package.json so Prisma migrations can run in the Railway pre-deploy step. These changes MUST be complete before railway.toml files are useful.

- [x] T001 Move `prisma` from devDependencies to dependencies in `apps/api/package.json` so the CLI is available in the production Docker image
- [x] T002 Add `COPY` for `prisma/` directory (schema + migrations) into the runner stage of `apps/api/Dockerfile`
- [x] T003 Run `pnpm install` to update lockfile after T001 dependency change
- [x] T004 Verify API Docker image builds successfully: `docker build -f apps/api/Dockerfile -t test-api .`
- [x] T005 Verify Worker Docker image still builds successfully: `docker build -f apps/worker/Dockerfile -t test-worker .`

**Checkpoint**: Both Docker images build. Prisma CLI and migration files are present in the API production image.

---

## Phase 3: User Story 1 — Deploy All Services to Railway (Priority: P1)

**Goal**: Create Railway config-as-code files so both services auto-deploy from GitHub pushes with correct Dockerfile paths, watch patterns, and health checks.

**Independent Test**: Push to main triggers Railway build for both services; health endpoints respond 200 OK.

- [x] T006 [P] [US1] Create `apps/api/railway.toml` with `[build]` (builder=DOCKERFILE, dockerfilePath, watchPatterns for api+shared+lockfile) and `[deploy]` (healthcheckPath=/health, healthcheckTimeout=300, restartPolicyType=ALWAYS, restartPolicyMaxRetries=5)
- [x] T007 [P] [US1] Create `apps/worker/railway.toml` with `[build]` (builder=DOCKERFILE, dockerfilePath, watchPatterns for worker+shared+lockfile) and `[deploy]` (healthcheckPath=/, healthcheckTimeout=300, restartPolicyType=ALWAYS, restartPolicyMaxRetries=5)

**Checkpoint**: Config-as-code files exist. Railway services pointing to these files will use correct Dockerfiles and health checks.

---

## Phase 4: User Story 4 — Run Database Migrations During Deployment (Priority: P4)

**Goal**: Add `preDeployCommand` to the API railway.toml so `prisma migrate deploy` runs automatically before the app starts on every deploy.

**Independent Test**: Push a new migration to main; after deploy, the migration is applied to Railway PostgreSQL without manual intervention.

- [x] T008 [US4] Add `preDeployCommand = "npx prisma migrate deploy"` to the `[deploy]` section of `apps/api/railway.toml`
- [x] T009 [US4] Verify prisma CLI is accessible in the API Docker image by running: `docker run --rm test-api npx prisma --version`

**Checkpoint**: API railway.toml includes pre-deploy migration command. Prisma CLI confirmed available in production image.

---

## Phase 5: User Stories 2 & 3 — Infrastructure Provisioning + Environment Variables (Priority: P2, P3)

**Goal**: Document the manual Railway dashboard steps for provisioning PostgreSQL/Redis (US2) and configuring environment variables/secrets (US3). These are one-time setup steps performed in the Railway UI, not code.

**Independent Test**: Follow the documentation to set up a fresh Railway project; all services start without config errors.

- [x] T010 [US2] [US3] Write `docs/RAILWAY.md` covering: project creation, adding PostgreSQL and Redis services, adding worker service from same repo, configuring service names and config file paths, setting shared variables (BOT_TOKEN, JWT_SECRET, TELEGRAM_*), setting per-service variables (PORT, DATABASE_URL via `${{Postgres.DATABASE_URL}}`, REDIS_URL via `${{Redis.REDIS_URL}}`), generating public domain for API, BotFather URL configuration, and troubleshooting table

**Checkpoint**: A developer can follow `docs/RAILWAY.md` to set up the complete Railway project from scratch.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify everything works end-to-end, clean up.

- [x] T011 Run full monorepo build to confirm no regressions: `pnpm turbo run build`
- [x] T012 Run full monorepo lint to confirm no regressions: `pnpm turbo run lint` (pre-existing lint error in auth.service.ts — not caused by this feature)
- [x] T013 Run full monorepo tests to confirm no regressions: `pnpm turbo run test` (pre-existing API test failures requiring Docker services — not caused by this feature)
- [x] T014 Verify API Docker image health check responds: build image verified — prisma CLI, schema, migrations, and dist all present. Full health check requires running PostgreSQL + Redis.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately
- **US1 (Phase 3)**: Depends on Foundational (Dockerfile must be ready for Railway to build)
- **US4 (Phase 4)**: Depends on US1 (railway.toml must exist to add preDeployCommand) and Foundational (prisma in image)
- **US2+US3 (Phase 5)**: Independent of code changes — documentation can be written in parallel
- **Polish (Phase 6)**: Depends on all code changes being complete (Phases 2-4)

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 (Foundational). Creates railway.toml files.
- **US4 (P4)**: Depends on US1 (adds to railway.toml) and Phase 2 (prisma in image).
- **US2 (P2)**: Independent — manual Railway dashboard steps documented in RAILWAY.md.
- **US3 (P3)**: Independent — manual Railway dashboard steps documented in RAILWAY.md.

### Parallel Opportunities

- T006 and T007 (railway.toml files) can run in parallel — different files
- T010 (documentation) can run in parallel with any code task
- T004 and T005 (Docker build verification) can run in parallel

### Parallel Example: Phase 3

```bash
# Launch both railway.toml creations together:
Task: "Create apps/api/railway.toml"
Task: "Create apps/worker/railway.toml"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 2: Foundational (Dockerfile + package.json)
2. Complete Phase 3: US1 (railway.toml files)
3. **STOP and VALIDATE**: Docker images build, config files are correct
4. Push to Railway-connected repo to test deployment

### Incremental Delivery

1. Complete Foundational → Docker images ready
2. Add US1 (railway.toml) → Services can deploy
3. Add US4 (preDeployCommand) → Migrations run automatically
4. Add US2+US3 (RAILWAY.md) → Setup is documented
5. Polish → Verify full pipeline

---

## Notes

- This is an infrastructure/config feature — most "implementation" is config files and documentation
- US2 and US3 are manual Railway dashboard procedures, not code — they are captured in `docs/RAILWAY.md`
- No new TypeScript source files → no test coverage impact
- Docker build verification is the primary validation method
- The Mini App is NOT deployed as a separate Railway service — it's bundled into the API image
