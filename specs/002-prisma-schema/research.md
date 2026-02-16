# Research: Database Schema & Prisma Setup

**Feature**: 002-prisma-schema | **Date**: 2026-02-16

## R1: Prisma Version & ESM Compatibility

**Decision**: Use Prisma v6.x (latest) with ESM support.
**Rationale**: The project uses `"type": "module"` in `apps/api/package.json`. Prisma v6 has first-class ESM support. The `prisma` CLI and `@prisma/client` work together — `prisma` is a devDependency, `@prisma/client` is a runtime dependency.
**Alternatives considered**:
- Prisma v5: Older, requires workarounds for ESM. No benefit.

## R2: Prisma Schema Location

**Decision**: Place schema at `apps/api/prisma/schema.prisma` (Prisma default relative to the app).
**Rationale**: Prisma CLI auto-discovers `prisma/schema.prisma` relative to the package where it's invoked. Keeping it in the api app avoids cross-package schema resolution issues. The `prisma` field in `apps/api/package.json` can override if needed.
**Alternatives considered**:
- Root-level `prisma/` directory: Breaks Prisma CLI discovery when running from `apps/api/`. Would require `--schema` flag everywhere.
- `packages/shared/prisma/`: Over-engineers sharing for a single DB consumer.

## R3: PrismaService Pattern in NestJS

**Decision**: Create a `PrismaService` class extending `PrismaClient` that implements `OnModuleInit` and `OnModuleDestroy`. Wrap in a global `PrismaModule`.
**Rationale**: This is the canonical NestJS + Prisma pattern. Extending `PrismaClient` means injected services get full query API. `onModuleInit` calls `$connect()`, `onModuleDestroy` calls `$disconnect()`. Making the module `@Global()` avoids importing it in every feature module.
**Alternatives considered**:
- Inject raw PrismaClient as a provider: Loses lifecycle hooks. Connections not managed by NestJS.
- Use `nestjs-prisma` package: Adds unnecessary third-party dependency for a trivial wrapper.

## R4: UUID Generation Strategy

**Decision**: Use Prisma's `@default(uuid())` which generates UUIDs at the database level (PostgreSQL `gen_random_uuid()`).
**Rationale**: Database-generated UUIDs are consistent regardless of client. PostgreSQL's `gen_random_uuid()` produces v4 UUIDs with good distribution. No application-level UUID library needed.
**Alternatives considered**:
- Application-generated UUIDs (e.g., `uuid` package): Adds dependency, less consistent.
- CUID/nanoid: Non-standard for this use case, less tooling support.

## R5: BigInt Handling for Telegram IDs

**Decision**: Use Prisma's `BigInt` type which maps to PostgreSQL `BIGINT` and JavaScript `BigInt`.
**Rationale**: Telegram user/channel IDs can exceed `Number.MAX_SAFE_INTEGER` (2^53 - 1). PostgreSQL `BIGINT` supports up to 2^63 - 1. Prisma serializes these as JavaScript `BigInt` values. JSON serialization needs care (BigInt is not JSON-serializable by default), but this is handled at the API boundary, not in the schema layer.
**Alternatives considered**:
- Store as String: Loses numeric ordering and comparison. Wastes space.
- Store as Decimal: Overkill for integer IDs.

## R6: Seed Script Execution

**Decision**: Use `prisma db seed` with a TypeScript seed file executed via `tsx`. Configure in `package.json` under `prisma.seed`.
**Rationale**: Prisma's built-in seed command delegates to a configured command. Using `tsx` (already a devDependency) to run TypeScript directly avoids a build step. Upserts ensure idempotency.
**Alternatives considered**:
- Compile seed to JS first: Extra build step, unnecessary complexity.
- Use `ts-node`: Not installed, and `tsx` is already available and faster.

## R7: Migration Strategy

**Decision**: Generate a single initial migration via `npx prisma migrate dev --name init`. Deploy via `npx prisma migrate deploy`.
**Rationale**: `migrate dev` generates SQL and applies it in development. `migrate deploy` is the production-safe command that only applies pending migrations without interactive prompts. The initial migration creates all four tables in one atomic step.
**Alternatives considered**:
- One migration per model: Over-granular for an initial schema. All four tables are interdependent.

## R8: Prisma Client Generation in Build Pipeline

**Decision**: Add `prisma generate` to the `build` script in `apps/api/package.json`. Add `@prisma/client` to `pnpm-workspace.yaml` `onlyBuiltDependencies` if it runs postinstall.
**Rationale**: `prisma generate` produces the typed client from the schema. It must run before TypeScript compilation. Adding it to the build script ensures the client is always up-to-date. Prisma's postinstall hook also runs `generate` automatically on `pnpm install`.
**Alternatives considered**:
- Manual `prisma generate` only: Easy to forget, breaks builds in CI.

## R9: Health Check Integration with Prisma

**Decision**: Add a Prisma health indicator to the existing `@nestjs/terminus` health controller using `PrismaHealthIndicator` or a raw query check (`$queryRaw`).
**Rationale**: The health endpoint already exists from 001-monorepo-scaffold. Adding a DB check ensures the health endpoint reflects actual database connectivity. `@nestjs/terminus` supports custom health indicators.
**Alternatives considered**:
- Skip DB health check: Health endpoint would report OK even when DB is down. Misleading.
- Separate DB health endpoint: Unnecessary when terminus supports multiple indicators.
