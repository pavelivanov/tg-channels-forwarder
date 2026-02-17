# Implementation Plan: Subscription List CRUD API

**Branch**: `005-subscription-lists-api` | **Date**: 2026-02-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-subscription-lists-api/spec.md`

## Summary

Full CRUD API for subscription lists: GET (list active with populated source channels), POST (create with limit enforcement), PATCH (partial update with source channel replacement in a transaction), DELETE (soft delete). Uses separate `CreateSubscriptionListDto` / `UpdateSubscriptionListDto` with `class-validator`. Ownership verified via single query combining `id + userId + isActive`. Source channel count enforced via `prisma.subscriptionListChannel.count()` with relational filtering. No schema changes required — all models exist from feature 002.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS
**Primary Dependencies**: NestJS 10, Prisma ORM v6, class-validator, class-transformer
**Storage**: PostgreSQL 16 via Prisma (existing schema, no migrations)
**Testing**: Vitest with unplugin-swc for decorator metadata
**Target Platform**: Linux server (Docker container)
**Project Type**: Turborepo monorepo (`apps/api`)
**Performance Goals**: List retrieval < 1s, write operations < 2s
**Constraints**: Max 30 source channels across all active lists per user, per-user list limit via `user.maxLists`
**Scale/Scope**: Single module addition to existing NestJS API app

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode & Code Quality | PASS | strict: true, no `any` types, single-responsibility DTOs/service/controller |
| II. Vitest Testing Standards | PASS | Integration tests covering success + failure paths, deterministic test data |
| III. Observability & Logging | PASS | Service uses pino Logger, AllExceptionsFilter logs all errors |
| IV. Performance Requirements | PASS | Prisma indexed queries (userId index exists), no full table scans |
| V. Technology Stack & Monorepo | PASS | NestJS module in apps/api, follows controller/service/module conventions |
| VI. Docker-First Deployment | PASS | No infrastructure changes, health endpoint already exists |
| VII. Data Architecture | PASS | Configuration data in PostgreSQL, no message storage, Prisma schema is source of truth |

No violations. All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/005-subscription-lists-api/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: 5 technical decisions
├── data-model.md        # Phase 1: existing schema documentation
├── quickstart.md        # Phase 1: 15 curl test scenarios
├── contracts/
│   └── subscription-lists.md  # Phase 1: 4 endpoint contracts
├── checklists/
│   └── requirements.md  # Spec quality validation (16/16 PASS)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── src/
│   ├── subscription-lists/
│   │   ├── subscription-lists.module.ts       # NestJS module
│   │   ├── subscription-lists.controller.ts   # CRUD endpoints
│   │   ├── subscription-lists.service.ts      # Business logic + limit enforcement
│   │   └── dto/
│   │       ├── create-subscription-list.dto.ts  # Required fields DTO
│   │       └── update-subscription-list.dto.ts  # All-optional fields DTO
│   └── app.module.ts                          # Register SubscriptionListsModule
└── test/
    └── subscription-lists.spec.ts             # Integration tests
```

**Structure Decision**: Single new NestJS module (`subscription-lists`) within the existing `apps/api` app. Follows the same pattern as `channels/` and `health/` modules. DTOs in a `dto/` subdirectory per NestJS convention. Integration tests in `apps/api/test/`.

## Complexity Tracking

No violations to justify. All implementation uses existing patterns and infrastructure.
