# Feature Specification: Monorepo Scaffold & Infrastructure

**Feature Branch**: `001-monorepo-scaffold`
**Created**: 2026-02-16
**Status**: Draft
**Input**: User description: "Set up the project skeleton so all subsequent features have a home."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Bootstraps Local Environment (Priority: P1)

A developer clones the repository and runs a single command to start all
services locally. PostgreSQL and Redis spin up via Docker Compose. The API
app starts and responds to health checks. The worker app starts and logs
its startup message. The developer can immediately begin building features.

**Why this priority**: Without a working local environment, no other
feature development can begin. This is the foundation for everything.

**Independent Test**: Clone the repo, run `docker compose up`, verify the
API health endpoint returns 200 and the worker logs its startup message.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository, **When** the developer runs
   `pnpm install && docker compose up`, **Then** PostgreSQL, Redis, API,
   and Worker services all start successfully within 60 seconds.
2. **Given** all services are running, **When** the developer sends
   `GET /health` to the API, **Then** it returns `{ "status": "ok" }`
   with HTTP 200.
3. **Given** all services are running, **When** the developer inspects
   worker logs, **Then** they see a structured JSON startup message
   from pino.

---

### User Story 2 - Developer Builds and Lints All Packages (Priority: P2)

A developer runs Turborepo commands to build, test, and lint all packages
in the monorepo. Each command completes successfully with zero errors.
Turborepo caching accelerates subsequent runs.

**Why this priority**: Build and lint pipelines must work before any
feature code is written so that quality gates are enforced from day one.

**Independent Test**: Run `turbo run build`, `turbo run lint`, and
`turbo run test` from the repo root and verify all succeed.

**Acceptance Scenarios**:

1. **Given** the monorepo is set up, **When** the developer runs
   `turbo run build`, **Then** all packages compile with zero TypeScript
   errors under strict mode.
2. **Given** the monorepo is set up, **When** the developer runs
   `turbo run lint`, **Then** ESLint passes across all packages with
   zero violations.
3. **Given** the monorepo is set up, **When** the developer runs
   `turbo run test`, **Then** all tests pass including the API health
   endpoint test and shared constants import test.

---

### User Story 3 - Developer Imports Shared Constants (Priority: P3)

A developer working in any app or package imports shared constants from
`@aggregator/shared`. The constants are typed, available at build time,
and consistent across all consumers.

**Why this priority**: Shared constants establish the pattern for
cross-package code sharing that all future features will follow.

**Independent Test**: Import `MAX_CHANNELS_PER_USER` from
`@aggregator/shared` in a test file and verify the value is `30`.

**Acceptance Scenarios**:

1. **Given** the shared package is built, **When** a developer imports
   `{ MAX_CHANNELS_PER_USER }` from `@aggregator/shared`, **Then** the
   value is `30` and TypeScript recognizes the type as `number`.
2. **Given** the shared package is built, **When** a developer imports
   `{ DEFAULT_MAX_LISTS, DEDUP_TTL_HOURS }` from `@aggregator/shared`,
   **Then** the values are `1` and `72` respectively.

---

### Edge Cases

- What happens when Docker is not installed or the Docker daemon is
  not running? The developer receives a clear error message.
- What happens when port 5432 (Postgres) or 6379 (Redis) is already
  in use? Docker Compose fails with a descriptive port conflict error.
- What happens when `pnpm install` is run without pnpm installed?
  The `packageManager` field in `package.json` triggers a clear error.
- What happens when environment variables in `.env` are missing?
  The API and worker validate required variables on startup and fail
  fast with a message naming the missing variable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Repository MUST be structured as a Turborepo monorepo
  with pnpm workspaces, containing `apps/` and `packages/` directories.
- **FR-002**: `apps/api` MUST be a NestJS application exposing a
  `GET /health` endpoint that returns `{ "status": "ok" }` with
  HTTP 200.
- **FR-003**: `apps/worker` MUST be a Node.js process that logs a
  structured startup message via pino, exposes a minimal HTTP health
  check endpoint, and stays alive.
- **FR-004**: `apps/mini-app` MUST contain a placeholder `index.html`
  with minimal valid HTML.
- **FR-005**: `packages/shared` MUST export a `constants` module
  containing `MAX_CHANNELS_PER_USER = 30`,
  `DEFAULT_MAX_LISTS = 1`, and `DEDUP_TTL_HOURS = 72`.
- **FR-006**: `packages/tsconfig` MUST provide shared base TypeScript
  configuration with `strict: true`.
- **FR-007**: `packages/eslint-config` MUST provide shared ESLint
  configuration with TypeScript rules.
- **FR-008**: `docker-compose.yml` at the repo root MUST define services
  for PostgreSQL 16, Redis 7, API, and Worker.
- **FR-009**: `docker-compose.dev.yml` at the repo root MUST provide
  development overrides including volume mounts, port mapping, and
  hot reload support.
- **FR-010**: `apps/api`, `apps/worker`, and `apps/mini-app` MUST each
  have a multi-stage Dockerfile producing minimal production images
  without dev dependencies.
- **FR-011**: `.env.example` MUST document all required environment
  variables with descriptions.
- **FR-012**: `turbo.json` MUST define `build`, `dev`, `test`, and
  `lint` pipelines.
- **FR-013**: All apps and packages MUST use TypeScript with
  `strict: true` per the project constitution.
- **FR-014**: API and Worker MUST validate required environment
  variables on startup and fail fast with clear error messages.

### Key Entities

- **App**: A deployable service in `apps/` (api, worker, mini-app).
  Each has its own `package.json`, Dockerfile (where applicable),
  and build configuration.
- **Package**: A shared library in `packages/` (shared, tsconfig,
  eslint-config). Consumed by apps via workspace references.
- **Infrastructure Service**: An external dependency (PostgreSQL,
  Redis) managed via Docker Compose.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from fresh clone to running services
  in under 5 minutes (excluding Docker image build time on first run).
- **SC-002**: All Turborepo pipelines (`build`, `lint`, `test`) complete
  with zero errors on a clean checkout.
- **SC-003**: The API health endpoint responds within 1 second of the
  service being ready.
- **SC-004**: Shared constants are importable and type-checked across
  all consuming packages.
- **SC-005**: Docker images for API, Worker, and Mini-App build
  successfully and contain no dev dependencies or test files.
- **SC-006**: A second `turbo run build` with no changes completes in
  under 5 seconds via cache.

## Assumptions

- The npm scope `@aggregator` is used for all workspace packages.
- pnpm is the package manager (enforced via `packageManager` field).
- Node.js 22 LTS is the target runtime.
- Developers have Docker and Docker Compose installed locally.
- No remote Turborepo cache is required for the initial scaffold;
  local caching is sufficient.
