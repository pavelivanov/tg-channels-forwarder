# Implementation Plan: Source Channel Management API

**Branch**: `004-channels-api` | **Date**: 2026-02-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-channels-api/spec.md`

## Summary

Expose two authenticated REST endpoints (`GET /channels`, `POST /channels`) for browsing active source channels and requesting new channel subscriptions. Implement a global exception filter for consistent `{ statusCode, error, message }` error responses. Use `class-validator` for DTO validation.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS
**Primary Dependencies**: NestJS 10, Prisma ORM v6+, `class-validator`, `class-transformer`
**Storage**: PostgreSQL 16 via Prisma (existing `SourceChannel` model)
**Testing**: Vitest with unplugin-swc + `@nestjs/testing`
**Target Platform**: Linux server (Docker)
**Project Type**: Turborepo monorepo — changes in `apps/api/`
**Performance Goals**: Channel list < 1s, channel submission < 2s
**Constraints**: All endpoints behind JWT auth (existing AuthGuard), no pagination needed initially
**Scale/Scope**: < 1000 channels expected initially

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode & Code Quality | PASS | Strict mode already active, ESLint/Prettier configured |
| II. Vitest Testing Standards | PASS | Will write Vitest integration tests covering success + failure paths |
| III. Observability & Logging | PASS | NestJS Logger (pino) for service-level logging; exception filter logs errors |
| IV. Performance Requirements | PASS | `isActive` filter uses index; `username` lookup uses index via `@unique` |
| V. Technology Stack & Monorepo | PASS | NestJS module, Prisma ORM, Turborepo |
| VI. Docker-First Deployment | N/A | No Dockerfile changes in this feature |
| VII. Data Architecture | PASS | PostgreSQL for channel config data, no message storage |

No violations. No Complexity Tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-channels-api/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── channels.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── src/
│   ├── auth/                    # Existing — AuthModule, AuthGuard, @Public()
│   ├── channels/                # NEW
│   │   ├── channels.controller.ts
│   │   ├── channels.service.ts
│   │   ├── channels.module.ts
│   │   └── dto/
│   │       └── create-channel.dto.ts
│   ├── filters/                 # NEW
│   │   └── http-exception.filter.ts
│   ├── health/                  # Existing
│   ├── prisma/                  # Existing
│   ├── app.module.ts            # Modified — import ChannelsModule
│   └── main.ts                  # Modified — register global pipe + filter
├── test/
│   ├── channels.spec.ts         # NEW
│   ├── auth.spec.ts             # Existing
│   ├── health.spec.ts           # Existing
│   └── prisma.spec.ts           # Existing
└── prisma/
    └── schema.prisma            # Modified — add unique index on SourceChannel.username
```

**Structure Decision**: New `channels/` module follows existing NestJS module pattern (auth/, health/). Global exception filter goes in `filters/` directory at app level.
