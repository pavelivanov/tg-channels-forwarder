# Implementation Plan: Structured Logging & Health Check Finalization

**Branch**: `012-logging-health-check` | **Date**: 2026-02-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-logging-health-check/spec.md`

## Summary

Production-ready structured logging and comprehensive health monitoring for both the API (NestJS) and worker (standalone Node.js) apps. Enhances the existing pino/nestjs-pino setup with sensitive data redaction, configurable log levels, and correlation ID tracing through the message pipeline. Replaces the current health endpoints with a unified response format featuring individual dependency checks and a three-tier status system (healthy/degraded/unhealthy).

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS
**Primary Dependencies**: NestJS 10, nestjs-pino 4.x, pino 9.x, pino-http 10.x, @nestjs/terminus 10.x, grammY, GramJS (telegram), BullMQ, Prisma ORM v6
**Storage**: PostgreSQL 16 (existing), Redis (existing)
**Testing**: Vitest with mocked dependencies
**Target Platform**: Linux server (Docker containers)
**Project Type**: Turborepo monorepo (`apps/api`, `apps/worker`, `packages/shared`)
**Constraints**: Health endpoint must respond within 5 seconds; per-check timeout of 3 seconds

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode & Code Quality | PASS | All new code uses strict TypeScript. No new `any` types. |
| II. Vitest Testing Standards | PASS | Tests planned for health status logic, redaction, and correlation ID propagation. |
| III. Observability & Logging | PASS | This feature directly implements Constitution III requirements. |
| IV. Performance Requirements | PASS | Health endpoint constrained to 5s total, 3s per check timeout. |
| V. Technology Stack & Monorepo | PASS | Uses existing pino, nestjs-pino, @nestjs/terminus. No new frameworks. |
| VI. Docker-First Deployment | PASS | Health check endpoints exposed for container orchestration. `LOG_LEVEL` via env var. |
| VII. Data Architecture | PASS | No new database entities. Correlation ID is transient (in-memory + BullMQ job data). |

**Post-design re-check**: All gates still PASS. No new dependencies required — only configuration changes to existing libraries.

## Project Structure

### Documentation (this feature)

```text
specs/012-logging-health-check/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── health-endpoint.md
│   └── logging.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/shared/src/
├── constants/index.ts          # Add LOG_REDACT_PATHS, HEALTH_CHECK_TIMEOUT_MS
└── interfaces/                 # Add HealthResponse, ForwardJob.correlationId
    └── index.ts

apps/api/src/
├── env.schema.ts               # Add LOG_LEVEL (optional)
├── app.module.ts               # Update LoggerModule.forRoot with redact, level
├── health/
│   ├── health.controller.ts    # Refactor to return unified HealthResponse format
│   └── health.module.ts        # Add BotService provider for bot health check
└── bot/
    └── bot.service.ts          # Add isHealthy() method

apps/worker/src/
├── config.ts                   # Add LOG_LEVEL
├── main.ts                     # Update pino config (redact, level), pass deps to health
├── health.ts                   # Refactor to comprehensive health checks
├── listener/
│   └── listener.service.ts     # Add isConnected(), add correlationId to handleNewMessage
├── queue/
│   ├── queue-producer.ts       # Log correlationId on enqueue
│   └── queue-consumer.ts       # Extract correlationId, create child logger
└── forwarder/
    └── forwarder.service.ts    # Use correlationId child logger
```

**Structure Decision**: Existing monorepo structure. Changes are configuration and refactoring within existing files. One new shared interfaces file for HealthResponse types.
