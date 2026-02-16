# Data Model: Monorepo Scaffold & Infrastructure

**Branch**: `001-monorepo-scaffold` | **Date**: 2026-02-16

## Overview

This feature is infrastructure scaffold — there are no application-level
data entities, database tables, or Prisma models to define. The "entities"
are the structural components of the monorepo itself.

## Structural Entities

### App

A deployable service in the `apps/` directory.

| Attribute       | Type   | Description                          |
|-----------------|--------|--------------------------------------|
| name            | string | Package name (e.g., `@aggregator/api`) |
| directory       | path   | Location in `apps/<name>`            |
| has_dockerfile  | bool   | Whether it has a multi-stage Dockerfile |
| has_health_check| bool   | Whether it exposes `/health`         |
| runtime         | string | NestJS, plain Node.js, or static     |

**Instances for this feature**:
- `apps/api` — NestJS, Dockerfile, health check
- `apps/worker` — plain Node.js, Dockerfile, health check (HTTP on WORKER_HEALTH_PORT)
- `apps/mini-app` — static HTML, Dockerfile (nginx:alpine two-stage), no health check

### Package

A shared library in the `packages/` directory.

| Attribute  | Type   | Description                            |
|------------|--------|----------------------------------------|
| name       | string | Package name (e.g., `@aggregator/shared`) |
| directory  | path   | Location in `packages/<name>`          |
| has_build  | bool   | Whether it requires a build step       |
| exports    | list   | Public API exports                     |

**Instances for this feature**:
- `packages/shared` — build required, exports `constants/`
- `packages/tsconfig` — no build, exports tsconfig JSON files
- `packages/eslint-config` — no build, exports config arrays

### Infrastructure Service

An external dependency managed via Docker Compose.

| Attribute  | Type   | Description                      |
|------------|--------|----------------------------------|
| name       | string | Service name in compose file     |
| image      | string | Docker image and version         |
| port       | number | Exposed port                     |
| volume     | string | Named volume for persistence     |

**Instances for this feature**:
- PostgreSQL 16 — port 5432, named volume `pgdata`
- Redis 7 — port 6379, no persistent volume (ephemeral)

## Shared Constants

Defined in `packages/shared/src/constants/index.ts`:

| Constant               | Type   | Value | Purpose                          |
|------------------------|--------|-------|----------------------------------|
| MAX_CHANNELS_PER_USER  | number | 30    | User channel subscription limit  |
| DEFAULT_MAX_LISTS      | number | 1     | Default forwarding lists per user|
| DEDUP_TTL_HOURS        | number | 72    | Message dedup key TTL in hours   |

## Database Schema

No Prisma schema is created in this feature. PostgreSQL is provisioned
via Docker Compose but remains empty. Schema will be added in subsequent
features that require persistence.
