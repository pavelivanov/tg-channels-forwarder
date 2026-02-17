# Research: Source Channel Management API

## Decision 1: DTO Validation Library

**Decision**: Use `class-validator` + `class-transformer` with NestJS `ValidationPipe`

**Rationale**: NestJS has first-class integration with `class-validator` decorators. `ValidationPipe` transforms and validates request bodies automatically. The `@Matches()` decorator supports regex patterns for username format validation. `whitelist: true` strips extra properties, `forbidNonWhitelisted: true` rejects them.

**Alternatives considered**:
- **Zod (already used for env)**: Great for schema validation but NestJS's `ValidationPipe` is decorator-based and expects `class-validator`. Zod would require a custom pipe. Since env validation already uses Zod, the project would have two validation libraries — but this is standard NestJS practice (Zod for config, class-validator for DTOs).
- **Manual validation in service**: More error-prone, less declarative, no automatic 400 responses.

## Decision 2: Error Response Consistency

**Decision**: Create a global `AllExceptionsFilter` that normalizes all errors to `{ statusCode, error, message }`

**Rationale**: NestJS already returns `{ statusCode, message, error }` for most `HttpException` subclasses, but validation errors return `message` as an array. The filter ensures: (1) all errors have the same shape, (2) validation message arrays are joined into a string, (3) unexpected errors don't leak stack traces, (4) all errors are logged.

**Alternatives considered**:
- **Rely on NestJS defaults**: Almost works, but validation errors return `message: string[]` instead of `message: string`. The inconsistency would complicate client parsing.
- **Interceptor instead of filter**: Interceptors don't catch exceptions by design — filters are the NestJS mechanism for this.

## Decision 3: Username Uniqueness and Idempotent Creation

**Decision**: Add a `@@unique` constraint on `SourceChannel.username` (as a unique index, keeping nullable) and use `findFirst` + `create` with a try/catch for race condition handling.

**Rationale**: Telegram channel usernames are inherently unique. The `username` field is currently `String?` (nullable) because some channels may not have usernames (e.g., private channels with only numeric IDs). Adding a unique index on the nullable field allows PostgreSQL's unique constraint to apply to all non-null values while permitting multiple nulls. For the POST endpoint, the flow is: `findFirst({ where: { username } })` — if found, return it; if not, `create()` wrapped in try/catch for unique constraint violation (race condition: another request created it between our find and create). The `telegramId` for pending channels uses `-BigInt(Date.now())` — negative values avoid collision with real Telegram IDs (always positive) and with each other (timestamp-based uniqueness).

**Alternatives considered**:
- **Make username non-nullable**: Would break existing model semantics — private channels without usernames couldn't be stored.
- **Prisma `upsert`**: Requires a unique field in `where`. With a unique index on `username`, we could use `upsert({ where: { username } })`, but Prisma doesn't support `upsert` on nullable unique fields well. The `findFirst` + `create` pattern is more explicit.

## Decision 4: Channel Response Shape

**Decision**: Return channel fields directly as specified: `{ id, telegramId, username, title, subscribedAt, isActive }`. Include `isActive` to distinguish active vs pending channels in POST responses.

**Rationale**: The spec requires `id, telegramId, username, title, subscribedAt` for the GET endpoint. For POST, the client needs to know whether the channel is active (already subscribed) or pending (newly created). Including `isActive` in the response avoids a separate "status" field and reuses the existing model field.

**Alternatives considered**:
- **Separate `status: 'active' | 'pending'` field**: Adds mapping complexity with no benefit — `isActive` is a boolean that already conveys this.
- **Different response shapes for GET vs POST**: Inconsistent — better to have one channel response shape.

## Decision 5: ValidationPipe Registration

**Decision**: Register `ValidationPipe` in `main.ts` using `app.useGlobalPipes()`

**Rationale**: The pipe applies to all incoming requests globally. Registration in `main.ts` is simpler than `APP_PIPE` provider and doesn't require dependency injection. Options: `transform: true` (auto-transform to DTO instances), `whitelist: true` (strip extra props), `forbidNonWhitelisted: true` (reject extra props).

**Alternatives considered**:
- **`APP_PIPE` provider in AppModule**: Supports DI but adds complexity for no benefit here — the pipe doesn't need injected services.
- **Per-controller pipes**: Inconsistent — validation should be global.
