# Implementation Plan: Redis Connection & Deduplication Service

**Branch**: `006-redis-dedup-service` | **Date**: 2026-02-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-redis-dedup-service/spec.md`

## Summary

Implement a message deduplication service backed by Redis. Pure text normalization and hashing functions live in `packages/shared`. The Redis-dependent `DedupService` (isDuplicate, markAsForwarded) lives in `apps/worker`. A global `RedisModule` in `apps/api` provides an ioredis client for health checks via a custom `RedisHealthIndicator`. Both apps already validate `REDIS_URL` at startup.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, ioredis, node:crypto (built-in)
**Primary Dependencies**: ioredis (new), @nestjs/terminus (existing), pino (existing), @aggregator/shared (existing)
**Storage**: Redis 7 (existing via Docker Compose) — ephemeral key-value with TTL, no PostgreSQL changes
**Testing**: Vitest — unit tests for pure functions in shared, integration tests for Redis-dependent dedup in worker, health check extension in api
**Target Platform**: Linux server (Docker containers)
**Project Type**: Turborepo monorepo (apps/api, apps/worker, packages/shared)
**Performance Goals**: Redis operations < 5ms per call under normal conditions
**Constraints**: Fail-open on Redis unavailability, all Redis keys must have explicit TTL
**Scale/Scope**: Handles 100+ messages/minute dedup checks per constitution performance requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | TypeScript Strict Mode & Code Quality | PASS | strict: true, no any types, single responsibility per function |
| II | Vitest Testing Standards | PASS | Unit tests for pure functions, integration tests for Redis service and health check |
| III | Observability & Logging | PASS | pino structured logging in worker DedupService, warn on Redis failures |
| IV | Performance Requirements | PASS | Redis ops are sub-millisecond, well within 5s forwarding budget |
| V | Technology Stack & Monorepo | PASS | ioredis for Redis, Turborepo structure, constitution explicitly mandates Redis for dedup |
| VI | Docker-First Deployment | PASS | Redis already in docker-compose.yml, REDIS_URL env var, health check extended |
| VII | Data Architecture | PASS | Redis for dedup keys with TTL only, no message content in PostgreSQL |

**Gate result**: 7/7 PASS — proceed to implementation.

## Project Structure

### Documentation (this feature)

```text
specs/006-redis-dedup-service/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── dedup-service.md # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/shared/
├── src/
│   ├── constants/
│   │   └── index.ts          # existing — already has DEDUP_TTL_HOURS
│   ├── dedup/
│   │   └── index.ts          # NEW — normalizeText(), computeHash()
│   └── index.ts              # modified — re-export dedup/*
└── test/
    └── dedup.spec.ts         # NEW — unit tests for pure functions

apps/api/
├── src/
│   ├── redis/
│   │   ├── redis.module.ts   # NEW — @Global() RedisModule with REDIS_CLIENT provider
│   │   └── redis.health.ts   # NEW — RedisHealthIndicator (extends HealthIndicator)
│   ├── health/
│   │   ├── health.module.ts  # modified — import RedisHealthIndicator provider
│   │   └── health.controller.ts  # modified — add Redis health check
│   └── app.module.ts         # modified — import RedisModule
└── test/
    └── health.spec.ts        # modified — add Redis health check test

apps/worker/
├── src/
│   └── dedup/
│       └── dedup.service.ts  # NEW — DedupService class (isDuplicate, markAsForwarded)
└── test/
    └── dedup.spec.ts         # NEW — integration tests against real Redis
```

**Structure Decision**: Follows existing monorepo layout. Pure functions in shared (no external deps), Redis-dependent service in worker (with ioredis), NestJS module in api (for health check DI). No new packages created.
