# Research: Redis Connection & Deduplication Service

**Feature Branch**: `006-redis-dedup-service`
**Date**: 2026-02-17

## R1: Redis Client Library

**Decision**: Use `ioredis` as the Redis client for both `apps/api` and `apps/worker`.

**Rationale**: ioredis is the most widely used Redis client for Node.js, supports Promises natively, has built-in reconnection with configurable retry, and is the recommended client for BullMQ (needed in future features). The user explicitly specified ioredis.

**Alternatives considered**:
- `redis` (node-redis v4): Official Redis client, but less ergonomic API and no native class instance pattern. BullMQ requires ioredis specifically.
- `@nestjs/microservices` Redis transport: Overkill — designed for pub/sub microservice communication, not key-value operations.

## R2: NestJS Redis Module Pattern

**Decision**: Create a custom `RedisModule` using `@Global()` + `useFactory` provider with a string injection token (`REDIS_CLIENT`).

**Rationale**: No official `@nestjs/redis` package exists. Third-party wrappers add unnecessary abstraction for a single-instance use case. A custom `useFactory` provider is transparent, has zero additional dependencies, and follows NestJS idioms. `@Global()` avoids repeated imports since Redis is needed by health and potentially other modules.

**Alternatives considered**:
- `@liaoliaots/nestjs-redis`: Adds multi-client support not needed here. Extra dependency for marginal benefit.
- Instantiate in `main.ts` and pass around: Breaks NestJS DI patterns, makes testing harder.

## R3: Health Check Integration

**Decision**: Create a custom `RedisHealthIndicator` extending `HealthIndicator` from `@nestjs/terminus` (v10 API). Use `redis.ping()` as the liveness probe.

**Rationale**: The project uses `@nestjs/terminus@10.2.3` which uses the class-based `HealthIndicator` API (not the v11+ `HealthIndicatorService` injection pattern). `PING` is the standard Redis liveness check — lightweight, no side effects.

**Alternatives considered**:
- Using `redis.status` property check: Less reliable than an actual round-trip PING — status can be "ready" while the connection is silently broken.
- `MicroserviceHealthIndicator`: Requires `@nestjs/microservices` package, overkill for a simple PING.

## R4: DedupService Placement

**Decision**: Place `DedupService` in `apps/worker/src/dedup/` rather than `packages/shared`.

**Rationale**: The dedup service requires ioredis as a runtime dependency and is only consumed by the worker. Placing it in `packages/shared` would force ioredis as a dependency on every package that imports shared, including the mini-app frontend. Pure functions (`normalizeText`, `computeHash`) will be placed in `packages/shared/src/dedup/` since they have no external dependencies and can be tested independently. The Redis-dependent methods (`isDuplicate`, `markAsForwarded`) stay in the worker.

**Alternatives considered**:
- Everything in `packages/shared`: Pollutes shared package with ioredis dependency. Violates constitution principle of clean public API per package.
- Everything in `apps/worker`: Duplicates pure functions if api ever needs them. Less testable.

## R5: Worker Redis Instance

**Decision**: Instantiate ioredis directly in the worker using the `REDIS_URL` from validated config (zod schema already includes `REDIS_URL`).

**Rationale**: The worker is a plain Node.js app (not NestJS), so no DI framework. Direct instantiation with `new Redis(url)` is idiomatic. The worker already validates `REDIS_URL` via its zod config schema.

**Alternatives considered**:
- NestJS for worker: Major architectural change not in scope. Worker is intentionally lightweight.

## R6: Fail-Open Strategy

**Decision**: When Redis is unreachable during `isDuplicate`, catch the error, log at `warn` level, and return `false` (not duplicate).

**Rationale**: Per FR-010, message delivery is prioritized over dedup accuracy. A brief Redis outage should not block all message forwarding. Logging at `warn` level ensures operators are alerted without triggering error-level alarms for transient issues.

**Alternatives considered**:
- Fail-closed (return `true`): Would silently drop all messages during Redis outages — unacceptable for a message forwarder.
- Throw and let caller decide: Pushes error handling complexity to every call site. Fail-open at the service boundary is simpler and consistent.

## R7: Text Normalization Strategy

**Decision**: Normalize via: lowercase → strip non-word characters (keep Unicode letters/digits/spaces) → collapse whitespace → split on spaces → take first 10 words → join with single space.

**Rationale**: The spec requires lowercase, strip punctuation, collapse whitespace, first 10 words. Using a regex that preserves Unicode word characters (`\p{L}` and `\p{N}`) ensures multilingual support. Taking first 10 words limits hash input to a consistent prefix, making long messages comparable by their opening content.

**Alternatives considered**:
- ASCII-only normalization: Would strip Cyrillic, Arabic, CJK characters — unacceptable for a Telegram forwarder with international users.
- Full-text normalization (all words): Longer messages produce different hashes for minor trailing edits. First 10 words is a reasonable fingerprint.
