# Implementation Plan: Authentication (Telegram initData + JWT)

**Branch**: `003-telegram-jwt-auth` | **Date**: 2026-02-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-telegram-jwt-auth/spec.md`

## Summary

Add Telegram Mini App authentication to the API. Users authenticate by sending initData (validated via HMAC-SHA256 against the bot token), the system upserts the user in Postgres, and returns a JWT. A global AuthGuard protects all subsequent endpoints, with a `@Public()` decorator to exempt specific routes like `/health` and `/auth/validate`.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS
**Primary Dependencies**: NestJS 10, @nestjs/jwt, @nestjs/config, Prisma ORM v6, node:crypto (built-in)
**Storage**: PostgreSQL 16 (existing, via Docker Compose) — User table already exists
**Testing**: Vitest with unplugin-swc for NestJS decorator support
**Target Platform**: Linux server (Docker containers)
**Project Type**: Turborepo monorepo (`apps/api` is the primary consumer)
**Performance Goals**: Authentication response < 2 seconds (SC-001)
**Constraints**: No external crypto libraries; no Passport.js; no refresh tokens
**Scale/Scope**: Single auth strategy (Telegram initData), stateless JWT verification

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode & Code Quality | PASS | All new code in strict TS; AuthService, AuthGuard, AuthController each have single responsibility; no `any` types |
| II. Vitest Testing Standards | PASS | Tests planned for: HMAC validation (success + tampered + expired), user upsert (create + update), JWT issuance, AuthGuard (missing/invalid/expired tokens) |
| III. Observability & Logging | PASS | Auth failures logged at warn level with context; no console.log |
| IV. Performance Requirements | PASS | HMAC + DB upsert + JWT sign is sub-100ms; no full table scans (upsert by unique telegramId index) |
| V. Technology Stack & Monorepo | PASS | NestJS module pattern; @nestjs/jwt is well-established; Prisma for DB; Zod for validation |
| VI. Docker-First Deployment | PASS | BOT_TOKEN and JWT_SECRET via env vars; validated at startup with clear errors |
| VII. Data Architecture | PASS | No message content stored; auth writes only to existing User table in PostgreSQL |

**Gate Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-telegram-jwt-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── auth.md          # POST /auth/validate contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/src/
├── auth/
│   ├── auth.module.ts        # AuthModule: imports JwtModule, provides AuthService, registers global guard
│   ├── auth.controller.ts    # POST /auth/validate (public)
│   ├── auth.service.ts       # initData validation, user upsert, JWT signing
│   ├── auth.guard.ts         # Global JWT guard via APP_GUARD
│   ├── public.decorator.ts   # @Public() SetMetadata decorator
│   └── types.ts              # JwtPayload, ValidateInitDataDto, AuthResponse interfaces
├── env.schema.ts             # Updated: adds BOT_TOKEN, JWT_SECRET
├── app.module.ts             # Updated: imports AuthModule
└── health/
    └── health.controller.ts  # Updated: add @Public() decorator
apps/api/test/
└── auth.spec.ts              # Auth integration tests
```

**Structure Decision**: Auth module follows NestJS module-per-feature pattern at `src/auth/`. The guard is registered globally via `APP_GUARD` in AuthModule, consistent with NestJS best practices for default-deny security.
