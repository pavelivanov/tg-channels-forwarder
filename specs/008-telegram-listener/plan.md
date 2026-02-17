# Implementation Plan: Telegram Listener Service

**Branch**: `008-telegram-listener` | **Date**: 2026-02-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-telegram-listener/spec.md`

## Summary

Implement a Telegram MTProto listener service in the worker app that connects as a userbot via GramJS, listens for new messages on subscribed channels, extracts content (text, media, albums), and enqueues ForwardJobs onto the existing BullMQ queue. Includes channel join/leave operations triggered by the API via a `channel-ops` queue, rate limiting (5 joins/hour), album grouping (300ms window), and auto-reconnect.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS
**Primary Dependencies**: `telegram` (GramJS) ^2.26.22, BullMQ (existing), Prisma (existing), pino (existing)
**Storage**: PostgreSQL 16 via Prisma (existing SourceChannel model), Redis (existing, for BullMQ queues)
**Testing**: Vitest with `vi.useFakeTimers()` for album grouping, mocked GramJS client
**Target Platform**: Linux server (Docker container)
**Project Type**: Turborepo monorepo — changes in `apps/worker/` and `packages/shared/`
**Performance Goals**: Messages queued within 2 seconds of posting, 100+ messages/minute throughput
**Constraints**: Max 5 channel joins/hour, 300ms album grouping window, stable memory (no unbounded buffers)
**Scale/Scope**: Single userbot account, monitoring up to 30 source channels concurrently

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode | PASS | All new code in strict TS, GramJS typed |
| II. Vitest Testing | PASS | Unit tests for album grouper, rate limiter, message extractor; mocked GramJS |
| III. Observability & Logging | PASS | pino structured logging for all key events (FR-013) |
| IV. Performance | PASS | <2s message latency, bounded album buffers (max 10, 300ms timer) |
| V. Technology Stack | PASS | GramJS for MTProto (constitution V mandates it), BullMQ queues, Prisma |
| VI. Docker-First | PASS | Env vars for all config (TELEGRAM_API_ID/HASH/SESSION), health endpoint exists |
| VII. Data Architecture | PASS | No message persistence, Redis for queues only, Prisma for channel config |

No violations. All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/008-telegram-listener/
├── plan.md              # This file
├── research.md          # GramJS patterns, session setup, event handling, API-worker RPC
├── data-model.md        # ListenerSession, AlbumBuffer, ChannelOpsJob, RateLimiter, constants
├── quickstart.md        # Integration scenarios and test patterns
├── contracts/
│   ├── listener-service.md    # Core listener lifecycle and event handling
│   ├── album-grouper.md       # Album collection with 300ms timer
│   ├── channel-manager.md     # Join/leave with rate limiting
│   ├── channel-ops-consumer.md # BullMQ worker for API commands
│   └── message-extractor.md   # GramJS message → ForwardJob mapping
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
apps/worker/src/
├── listener/
│   ├── listener.service.ts      # GramJS client lifecycle, NewMessage handler
│   ├── album-grouper.ts         # Album collection buffer with timer
│   ├── channel-manager.ts       # Join/leave operations + rate limiter
│   ├── channel-ops-consumer.ts  # BullMQ worker for channel-ops queue
│   └── message-extractor.ts     # Api.Message → ForwardJob mapping
├── queue/
│   ├── queue-producer.ts        # (existing) ForwardJob enqueueing
│   └── queue-consumer.ts        # (existing) ForwardJob processing
├── config.ts                    # (modified) Add TELEGRAM_* env vars
├── main.ts                      # (modified) Initialize listener, channel-ops consumer
└── health.ts                    # (existing) Health endpoint

apps/worker/test/
├── listener.spec.ts             # ListenerService unit tests
├── album-grouper.spec.ts        # Album grouping timer tests
├── channel-manager.spec.ts      # Join/leave + rate limiter tests
├── message-extractor.spec.ts    # Message extraction tests
└── queue.spec.ts                # (existing) Queue integration tests

packages/shared/src/
├── queue/index.ts               # (modified) Add QUEUE_NAME_CHANNEL_OPS, ChannelOpsJob type
├── constants/index.ts           # (modified) Add album/rate-limit constants
└── index.ts                     # (existing) Re-exports

apps/api/src/channels/
├── channels.service.ts          # (modified) Enqueue channel-ops job on findOrCreate
└── channels.module.ts           # (modified) Import BullMQ Queue for channel-ops
```

**Structure Decision**: All listener code lives under `apps/worker/src/listener/` as a new module within the existing worker app. Shared constants and types are added to `packages/shared/`. The API gains a BullMQ producer for the `channel-ops` queue to trigger join operations.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
