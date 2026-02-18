# Implementation Plan: Channel Cleanup Job

**Branch**: `011-channel-cleanup` | **Date**: 2026-02-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-channel-cleanup/spec.md`

## Summary

Add a scheduled background job to the worker application that automatically identifies source channels no longer referenced by any subscription list for 30+ days, leaves them via Telegram, and marks them inactive. Uses BullMQ `upsertJobScheduler` with a daily cron schedule (3:00 AM UTC) and the existing `ChannelManager.leaveChannel()` for Telegram operations.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS
**Primary Dependencies**: BullMQ (existing), Prisma ORM v6 (existing), pino (existing), `ChannelManager` (existing)
**Storage**: PostgreSQL 16 via Prisma (add `lastReferencedAt` field to SourceChannel)
**Testing**: Vitest (existing)
**Target Platform**: Linux server (Docker container)
**Project Type**: Turborepo monorepo — changes in `apps/worker` and `packages/shared`
**Performance Goals**: Cleanup job completes within 10 minutes for up to 1,000 orphaned channels
**Constraints**: Must not interfere with message forwarding while running
**Scale/Scope**: Typically < 100 channels; worst case ~1,000

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode | PASS | All new code in strict TypeScript, no `any` types |
| II. Vitest Testing | PASS | Unit tests for cleanup service, covers success + failure + edge cases |
| III. Observability & Logging | PASS | Structured pino logging with cleanup-specific events |
| IV. Performance | PASS | Sequential leave with error resilience, no unbounded data structures |
| V. Technology Stack | PASS | BullMQ for scheduling (existing), Prisma for queries (existing) |
| VI. Docker-First | PASS | No new services, runs in existing worker container |
| VII. Data Architecture | PASS | PostgreSQL for config (channel state), no message persistence |
| Quality Gates | PASS | build + test + lint required before merge |

**Post-design re-check**: PASS — No violations introduced. Single new nullable field on existing model via Prisma migration.

## Project Structure

### Documentation (this feature)

```text
specs/011-channel-cleanup/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cleanup-service.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/worker/
├── src/
│   ├── cleanup/
│   │   ├── channel-cleanup.service.ts   # Core cleanup logic
│   │   └── channel-cleanup.consumer.ts  # BullMQ worker for cleanup queue
│   ├── listener/
│   │   └── channel-manager.ts           # Existing — leaveChannel() reused
│   └── main.ts                          # Modified — register cleanup scheduler
├── prisma/
│   └── schema.prisma                    # Modified — add lastReferencedAt
└── test/
    └── channel-cleanup.spec.ts          # Cleanup service unit tests

apps/api/
└── prisma/
    └── schema.prisma                    # Modified — add lastReferencedAt (mirror)

packages/shared/
└── src/
    └── constants/
        └── index.ts                     # Add QUEUE_NAME_CHANNEL_CLEANUP, CLEANUP_GRACE_PERIOD_DAYS
```

**Structure Decision**: New `cleanup/` directory in the worker app following the existing pattern of feature-based directories (`listener/`, `forwarder/`, `dedup/`, `queue/`). The cleanup service is a self-contained module with its own service and consumer.
