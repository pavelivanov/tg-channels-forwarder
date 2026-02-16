# Research: Authentication (Telegram initData + JWT)

**Branch**: `003-telegram-jwt-auth` | **Date**: 2026-02-16

## R1: Telegram initData Validation Algorithm

**Decision**: Use Node.js built-in `crypto` module for HMAC-SHA256 validation — no third-party crypto library needed.

**Rationale**: The algorithm is straightforward (3 crypto operations) and `node:crypto` is stable, well-documented, and has zero dependency overhead.

**Algorithm**:

1. Parse the initData query string and extract the `hash` parameter.
2. Build a data-check-string: all remaining key-value pairs (excluding `hash`), sorted alphabetically by key, formatted as `key=value`, joined by `\n`.
3. Derive secret key: `HMAC-SHA256(key="WebAppData", data=bot_token)`.
4. Compute hash: `hex(HMAC-SHA256(key=secret_key, data=data_check_string))`.
5. Compare computed hash with received hash (constant-time comparison).
6. Verify `auth_date` is within 5-minute window.

**initData format**: URL-encoded query string with fields: `query_id`, `user` (JSON string), `auth_date` (unix timestamp), `hash` (HMAC-SHA256 hex), and optional fields (`receiver`, `chat`, `chat_type`, `chat_instance`, `start_param`, `can_send_after`, `signature`).

**WebAppUser structure**:
- `id`: number (Telegram user ID)
- `first_name`: string
- `last_name?`: string
- `username?`: string
- `language_code?`: string
- `is_premium?`: boolean
- `photo_url?`: string

**Alternatives considered**:
- `@telegram-apps/init-data-node` package: Adds a dependency for 20 lines of crypto. Rejected per Constitution I (prefer well-established libraries, minimize deps).

## R2: JWT Strategy in NestJS

**Decision**: Use `@nestjs/jwt` with `JwtModule.register({ global: true })` and a custom `AuthGuard` registered via `APP_GUARD`.

**Rationale**: This is the official NestJS pattern. Global registration means all routes are protected by default; only explicitly `@Public()` decorated routes bypass the guard. This is safer than opt-in protection.

**Pattern**:
- `AuthModule` imports `JwtModule.register({ global: true, secret, signOptions: { expiresIn: '1h' } })`.
- `AuthGuard` implements `CanActivate`, extracts Bearer token, calls `JwtService.verifyAsync()`, attaches payload to `request['user']`.
- `@Public()` decorator uses `SetMetadata` to mark unauthenticated routes (e.g., `POST /auth/validate`, `GET /health`).
- `APP_GUARD` provider in `AuthModule` makes the guard global.

**JWT payload**: `{ sub: userId (UUID), telegramId: bigint-as-string }`. Using `sub` follows JWT RFC 7519 convention.

**Alternatives considered**:
- Passport.js (`@nestjs/passport`): Heavier abstraction, unnecessary for single-strategy auth. Rejected.
- Manual token verification: Loses `@nestjs/jwt` integration with ConfigService. Rejected.

## R3: Environment Validation Approach

**Decision**: Extend existing Zod-based `env.schema.ts` with `BOT_TOKEN` and `JWT_SECRET` fields.

**Rationale**: The project already uses Zod for env validation in `apps/api/src/env.schema.ts`. Adding fields to the existing schema is consistent and requires no new dependencies.

**New fields**:
- `BOT_TOKEN`: `z.string().min(1)` — Telegram bot token from @BotFather.
- `JWT_SECRET`: `z.string().min(32)` — signing secret, minimum 32 chars for security.

**Alternatives considered**:
- `class-validator` + `class-transformer`: Would require additional dependencies and a different validation pattern. Rejected for consistency.
- `joi`: Same reasoning. Zod is already in use.

## R4: Constant-Time Hash Comparison

**Decision**: Use `crypto.timingSafeEqual()` for hash comparison.

**Rationale**: Prevents timing attacks on HMAC validation. Standard security practice.

## R5: BigInt Handling in JWT

**Decision**: Serialize `telegramId` as string in JWT payload since JSON does not support BigInt.

**Rationale**: The Prisma User model stores `telegramId` as `BigInt`. JWT payloads are JSON, which cannot represent BigInt. Storing as string is lossless and idiomatic.
