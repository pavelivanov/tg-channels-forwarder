# Implementation Plan: Bot Admin Verification & Destination Validation

**Branch**: `010-bot-admin-verification` | **Date**: 2026-02-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-bot-admin-verification/spec.md`

## Summary

Add bot admin verification to the subscription list creation and update flows. Before a user can create or update a subscription list with a destination channel, the system verifies that the forwarding bot has administrator privileges in that channel using grammY's `getChatMember` API. If verification fails, the request is rejected with a clear, actionable error message (`DESTINATION_BOT_NOT_ADMIN`).

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10
**Primary Dependencies**: grammY (Bot API client), @nestjs/common, @nestjs/config, Prisma ORM v6
**Storage**: PostgreSQL 16 via Prisma (no schema changes)
**Testing**: Vitest with unplugin-swc for NestJS decorator support
**Target Platform**: Linux server (Docker)
**Project Type**: Turborepo monorepo — `apps/api`
**Performance Goals**: Bot admin verification completes within 2 seconds under normal conditions (NFR-001), 10-second hard timeout (FR-008)
**Constraints**: No caching of admin status, no periodic re-verification (out of scope)
**Scale/Scope**: Single new NestJS module (BotModule) with one service (BotService), modifications to SubscriptionListsService

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode & Code Quality | PASS | TypeScript strict, single-responsibility BotService, grammY is well-established |
| II. Vitest Testing Standards | PASS | Unit tests for BotService + integration tests for verification flow |
| III. Observability & Logging | PASS | Verification failures logged at warn/error level with channel ID context |
| IV. Performance Requirements | PASS | 10s timeout, no unbounded caches |
| V. Technology Stack & Monorepo | PASS | NestJS module pattern, grammY for Bot API (constitutionally mandated) |
| VI. Docker-First Deployment | PASS | BOT_TOKEN already in env schema, no new env vars needed |
| VII. Data Architecture | PASS | No new tables, no message content stored |

**Quality Gates**: ESLint + Prettier, `turbo run test`, `turbo run build` all required.

## Project Structure

### Documentation (this feature)

```text
specs/010-bot-admin-verification/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── bot-service.md   # BotService contract
├── checklists/
│   └── requirements.md  # Spec quality validation
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── src/
│   ├── bot/
│   │   ├── bot.module.ts          # NEW — Global NestJS module
│   │   └── bot.service.ts         # NEW — verifyBotAdmin implementation
│   ├── subscription-lists/
│   │   └── subscription-lists.service.ts  # MODIFIED — inject BotService, add verification
│   └── app.module.ts              # MODIFIED — import BotModule
├── test/
│   ├── bot.spec.ts                         # NEW — BotService unit tests
│   └── subscription-lists-bot-verify.spec.ts  # NEW — Integration tests
└── package.json                   # MODIFIED — add grammy dependency
```

**Structure Decision**: All new code lives within `apps/api`. A new `bot/` module directory follows the existing NestJS module convention (like `auth/`, `channels/`, `health/`, `prisma/`, `redis/`). No new packages, no worker changes, no shared package changes.
