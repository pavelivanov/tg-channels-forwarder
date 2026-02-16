<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0
- Modified principles:
  - I. Code Quality → I. TypeScript Strict Mode & Code Quality
  - II. Testing Standards → II. Vitest Testing Standards
  - III. User Experience Consistency → III. Observability & Logging
  - IV. Performance Requirements → IV. Performance Requirements (retained, updated)
- Added principles:
  - V. Technology Stack & Monorepo
  - VI. Docker-First Deployment
  - VII. Data Architecture
- Modified sections:
  - Quality Gates (updated for Turborepo/Vitest)
  - Development Workflow (updated for monorepo)
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ compatible (Constitution Check)
  - .specify/templates/spec-template.md ✅ compatible (Success Criteria)
  - .specify/templates/tasks-template.md ✅ compatible (phase structure)
- Follow-up TODOs: none
-->

# TG Channels Forwarder Constitution

## Core Principles

### I. TypeScript Strict Mode & Code Quality

- All packages MUST use TypeScript with `strict: true` in
  `tsconfig.json`. No `any` types except when wrapping untyped
  third-party libraries, and those MUST be isolated behind
  typed wrappers.
- Functions and modules MUST have a single, clear responsibility.
  No function exceeds 50 lines without documented justification.
- Dead code, unused imports, and commented-out code MUST NOT be
  committed. ESLint and Prettier MUST pass before any merge.
- Dependencies MUST be pinned to exact versions. New dependencies
  require documented justification. Well-established libraries
  MUST be preferred over custom implementations.
- Each package MUST export a clean public API via `index.ts`.
  Internal modules MUST NOT be imported directly by other packages.

### II. Vitest Testing Standards

- All tests MUST use Vitest as the test runner. No other test
  frameworks are permitted.
- Every feature MUST include tests that cover the primary success
  path and at least one failure/edge case.
- Tests MUST be deterministic: no flaky tests, no reliance on
  external services without mocking, no time-dependent assertions.
- Test names MUST describe the scenario and expected outcome
  (e.g., `it("skips duplicate message based on Redis dedup key")`).
- Integration tests MUST exist for all external service boundaries:
  Telegram Bot API (grammY), MTProto (GramJS), PostgreSQL (Prisma),
  Redis, and BullMQ job queues.
- Test coverage MUST NOT decrease when merging new code. New source
  files MUST have corresponding `.test.ts` or `.spec.ts` files.

### III. Observability & Logging

- Every service and app MUST use `pino` for structured JSON logging.
  No `console.log` in production code.
- Log entries MUST include: timestamp, level, service name, and
  correlation ID where applicable.
- Error logs MUST include the error message, stack trace, and
  relevant context (channel ID, message ID, job ID).
- Log levels MUST be used consistently: `error` for failures
  requiring attention, `warn` for recoverable issues, `info` for
  significant events, `debug` for troubleshooting detail.
- Silent failures are prohibited. Every caught exception MUST be
  logged at `warn` or `error` level with actionable context.

### IV. Performance Requirements

- Message forwarding latency MUST NOT exceed 5 seconds end-to-end
  under normal operating conditions.
- The application MUST handle at least 100 messages per minute
  without degradation or message loss.
- Memory usage MUST remain stable over time. No unbounded caches,
  queues, or data structures that grow without limits.
- Prisma queries MUST use indexes for all lookup patterns.
  Full table scans on production data are prohibited.
- BullMQ jobs MUST have configurable TTL and max retry limits to
  prevent queue backlog accumulation.
- Startup time MUST NOT exceed 10 seconds including all
  initialization, database connections, and Redis connections.

### V. Technology Stack & Monorepo

- The project MUST be structured as a Turborepo monorepo with all
  packages in the `packages/` or `apps/` directories.
- **Backend API**: NestJS. All modules MUST follow NestJS
  conventions (controllers, services, modules, providers).
- **Telegram Bot**: grammY framework for Bot API interactions.
- **MTProto Userbot**: GramJS (`telegram`) for userbot/MTProto
  channel operations.
- **Database**: Prisma ORM with PostgreSQL. Schema changes MUST
  use Prisma migrations. No raw SQL except in documented
  performance-critical paths.
- **Cache & Queue**: Redis for deduplication cache and BullMQ
  for job queues. No other cache or queue systems.
- **Build**: Turborepo MUST manage build, test, and lint pipelines.
  Each package MUST define `build`, `test`, and `lint` scripts
  in its `package.json`.

### VI. Docker-First Deployment

- Every app in `apps/` MUST have a multi-stage Dockerfile that
  produces a minimal production image.
- Docker images MUST NOT include dev dependencies, source maps,
  or test files.
- A `docker-compose.yml` MUST exist at the repo root for local
  development with all required services (PostgreSQL, Redis).
- Environment variables MUST be the sole configuration mechanism.
  No config files baked into images. All required variables MUST
  be validated on startup with clear error messages for missing
  values.
- Health check endpoints MUST be exposed by every service for
  container orchestration readiness/liveness probes.

### VII. Data Architecture

- Messages MUST NOT be persisted. The system is a forwarder,
  not a store. No message content in PostgreSQL.
- Redis MUST be used exclusively for message deduplication keys
  (with TTL) and BullMQ job queue state.
- PostgreSQL MUST be used for configuration persistence: channel
  mappings, forwarding rules, user settings, and operational
  metadata.
- All Redis keys MUST have explicit TTL values. No indefinite
  key storage.
- Prisma schema MUST be the single source of truth for the
  database structure. No manual DDL outside of Prisma migrations.

## Quality Gates

- ESLint and Prettier MUST pass across all packages via
  `turbo run lint` before code review.
- `turbo run test` MUST pass with zero failures before merge.
  No `skip` or `todo` annotations without a linked issue.
- `turbo run build` MUST succeed for all affected packages.
  TypeScript strict mode errors are build failures.
- Code review MUST verify adherence to all seven core principles.
  Reviewers MUST flag violations explicitly.
- Performance-sensitive changes MUST include before/after
  measurements or benchmarks in the PR description.
- Dockerfile changes MUST be validated by building the image
  and verifying the health check endpoint responds.

## Development Workflow

- Feature branches MUST be created from `main` and kept up to
  date via rebase before merge.
- Commits MUST be atomic: one logical change per commit with a
  descriptive message.
- All merges to `main` MUST go through a pull request with at
  least one approval.
- Breaking changes MUST be communicated in the PR title with a
  `BREAKING:` prefix and include migration instructions.
- Turborepo caching MUST be leveraged: do not bypass the cache
  without documented justification.

## Governance

- This constitution supersedes all informal practices. When a
  conflict exists between this document and ad-hoc decisions,
  this document wins.
- Amendments require: (1) a documented proposal, (2) review of
  impact on existing code, (3) a migration plan if principles
  change retroactively.
- All PRs and reviews MUST verify compliance with the core
  principles. Non-compliance MUST be resolved before merge.
- Version follows semantic versioning: MAJOR for principle
  removals or redefinitions, MINOR for new principles or
  expanded guidance, PATCH for clarifications and typo fixes.

**Version**: 2.0.0 | **Ratified**: 2026-02-16 | **Last Amended**: 2026-02-16
