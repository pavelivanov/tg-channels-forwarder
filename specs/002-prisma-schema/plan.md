# Implementation Plan: Database Schema & Prisma Setup

**Branch**: `002-prisma-schema` | **Date**: 2026-02-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-prisma-schema/spec.md`

## Summary

Define the Prisma schema with four models (User, SourceChannel, SubscriptionList, SubscriptionListChannel), create the initial migration, add a PrismaService NestJS provider, and provide a seed script for local development. All models use UUID primary keys, BigInt for Telegram IDs, and cascade deletes through parent-child relationships.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS
**Primary Dependencies**: NestJS 10, Prisma ORM (latest v6), @prisma/client
**Storage**: PostgreSQL 16 (via Docker Compose, already provisioned in 001-monorepo-scaffold)
**Testing**: Vitest with unplugin-swc for NestJS decorator support
**Target Platform**: Linux server (Docker containers)
**Project Type**: Turborepo monorepo (`apps/api` is the primary consumer)
**Performance Goals**: Prisma queries MUST use indexes for all lookup patterns (Constitution IV)
**Constraints**: No raw SQL except documented performance-critical paths (Constitution V)
**Scale/Scope**: Configuration data only (users, channels, subscription lists) — not message content

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode & Code Quality | PASS | All new code in strict TS; PrismaService has single responsibility |
| II. Vitest Testing Standards | PASS | Tests planned for PrismaService connect/disconnect and seed data queries |
| III. Observability & Logging | PASS | PrismaService uses NestJS Logger; no console.log |
| IV. Performance Requirements | PASS | Indexes on userId (SubscriptionList), unique constraints on telegramId fields and composite key |
| V. Technology Stack & Monorepo | PASS | Prisma ORM with PostgreSQL; schema changes via Prisma migrations only |
| VI. Docker-First Deployment | PASS | PostgreSQL already in docker-compose.yml; DATABASE_URL validated on startup |
| VII. Data Architecture | PASS | No message content stored; PostgreSQL for config persistence only |

**Gate Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-prisma-schema/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A — no new API endpoints)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── prisma/
│   ├── schema.prisma        # Prisma schema with 4 models
│   ├── seed.ts              # Seed script (tsx runner)
│   └── migrations/          # Generated migration directory
│       └── YYYYMMDDHHMMSS_init/
│           └── migration.sql
├── src/
│   ├── prisma/
│   │   ├── prisma.service.ts   # PrismaService (extends PrismaClient)
│   │   └── prisma.module.ts    # PrismaModule (global provider)
│   ├── app.module.ts           # Updated to import PrismaModule
│   └── ...existing files...
└── test/
    └── prisma.spec.ts          # PrismaService connect/disconnect + seed query tests
```

**Structure Decision**: Prisma lives in `apps/api/prisma/` (Prisma convention). PrismaService is a NestJS module at `src/prisma/` following NestJS module-per-feature pattern. This keeps the ORM co-located with its primary consumer while making PrismaService injectable across all API modules.
