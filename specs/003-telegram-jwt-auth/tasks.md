# Tasks: Authentication (Telegram initData + JWT)

**Input**: Design documents from `/specs/003-telegram-jwt-auth/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/auth.md

**Tests**: Included — the feature specification explicitly requests 6 test scenarios.

**Organization**: Tasks are grouped by user story. US2 depends on US1 (JWT issuance is needed to test the guard).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install dependency, create shared types and utilities, update environment validation

- [x] T001 Install `@nestjs/jwt` dependency in `apps/api/package.json`
- [x] T002 [P] Create auth types and DTOs in `apps/api/src/auth/types.ts` — define `JwtPayload` interface (`sub: string`, `telegramId: string`), `ValidateInitDataDto` class (`initData: string`), and `AuthResponse` interface (`token: string`, `user: UserProfile`)
- [x] T003 [P] Create `@Public()` decorator in `apps/api/src/auth/public.decorator.ts` — uses `SetMetadata` with `IS_PUBLIC_KEY` constant
- [x] T004 [P] Add `BOT_TOKEN` and `JWT_SECRET` to env validation in `apps/api/src/env.schema.ts` — `BOT_TOKEN: z.string().min(1)`, `JWT_SECRET: z.string().min(32)`
- [x] T005 [P] Update `apps/api/.env.example` and `apps/api/.env` with `BOT_TOKEN` and `JWT_SECRET` placeholder values

**Checkpoint**: Shared infrastructure ready — auth module implementation can begin

---

## Phase 2: User Story 1 — Authenticate via Telegram Mini App (Priority: P1) MVP

**Goal**: Users send Telegram initData to `POST /auth/validate`, the system validates the HMAC signature, upserts the user in Postgres, and returns a JWT + user profile.

**Independent Test**: Send valid/invalid initData to `POST /auth/validate` and verify JWT issuance or 401 rejection.

### Tests for User Story 1

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T006 [US1] Write auth tests in `apps/api/test/auth.spec.ts` — include a test helper function `createInitData(botToken, userData, overrides?)` that generates correctly signed initData strings. Test cases:
  - HMAC validation accepts correctly signed initData
  - HMAC validation rejects tampered initData (modified hash)
  - HMAC validation rejects expired initData (auth_date older than 5 minutes) — use `vi.useFakeTimers()` or set auth_date to a known past timestamp (e.g., `Math.floor(Date.now()/1000) - 400`) for determinism
  - initData with missing user object returns 401
  - initData with user having no username creates user with username=null
  - User is created on first authentication (verify DB record)
  - User profile is updated on subsequent authentication (changed firstName)
  - JWT is returned with correct payload (`sub` = user UUID, `telegramId` = string) and 1-hour expiry
  - Response includes user profile alongside JWT

### Implementation for User Story 1

- [x] T007 [US1] Implement `AuthService` in `apps/api/src/auth/auth.service.ts` — three methods:
  1. `validateInitData(initDataRaw: string): WebAppUser` — parse query string, extract hash, build data-check-string (sorted key=value pairs joined by `\n`), derive secret via `HMAC-SHA256(key="WebAppData", data=botToken)`, compute hash via `HMAC-SHA256(key=secret, data=dataCheckString)`, compare with `crypto.timingSafeEqual()`, verify `auth_date` within 5 minutes, parse and return user object. Throw `UnauthorizedException` on any failure.
  2. `upsertUser(webAppUser: WebAppUser): Promise<User>` — call `prisma.user.upsert()` by `telegramId`, create with all fields, update firstName/lastName/username/photoUrl/isPremium.
  3. `authenticate(initDataRaw: string): Promise<AuthResponse>` — orchestrates: validate → upsert → sign JWT with `{ sub: user.id, telegramId: String(user.telegramId) }` → return `{ token, user }`. Inject `JwtService`, `PrismaService`, `ConfigService`.
  Log failed HMAC validations and expired auth_date at `warn` level via NestJS `Logger` with actionable context (Constitution III).
- [x] T008 [US1] Implement `AuthController` in `apps/api/src/auth/auth.controller.ts` — `@Public()` decorated `@Post('validate')` endpoint accepting `ValidateInitDataDto` body, delegates to `AuthService.authenticate()`, returns `AuthResponse`
- [x] T009 [US1] Create `AuthModule` in `apps/api/src/auth/auth.module.ts` — imports `JwtModule.registerAsync()` using `ConfigService` to read `JWT_SECRET` with `signOptions: { expiresIn: '1h' }` and `global: true`. Provides `AuthService`. Declares `AuthController`. Exports `AuthService`.
- [x] T010 [US1] Import `AuthModule` in `apps/api/src/app.module.ts`
- [x] T011 [US1] Run T006 tests and verify they pass

**Checkpoint**: `POST /auth/validate` works end-to-end — valid initData returns JWT + profile, invalid returns 401

---

## Phase 3: User Story 2 — Access Protected Endpoints with JWT (Priority: P1)

**Goal**: All endpoints are protected by default via a global JWT guard. Only routes marked `@Public()` are accessible without a token. The guard extracts and validates the JWT from the Authorization Bearer header and attaches the user payload to the request context.

**Independent Test**: Obtain a JWT from US1, call a protected endpoint with/without/expired token and verify access control.

**Depends on**: User Story 1 (needs JWT issuance to test guard)

### Tests for User Story 2

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T012 [US2] Add guard tests to `apps/api/test/auth.spec.ts` — test cases:
  - Protected endpoint with valid JWT returns 200 and request has user context
  - Protected endpoint without Authorization header returns 401
  - Protected endpoint with malformed token returns 401
  - Protected endpoint with expired JWT returns 401
  - Public endpoint (`/health`, `/auth/validate`) accessible without token

### Implementation for User Story 2

- [x] T013 [US2] Implement `AuthGuard` in `apps/api/src/auth/auth.guard.ts` — implements `CanActivate`, uses `Reflector` to check `IS_PUBLIC_KEY` metadata (skip validation if public), extracts Bearer token from `Authorization` header, calls `JwtService.verifyAsync()`, attaches payload to `request['user']`, throws `UnauthorizedException` on failure. Log failed JWT verifications at `warn` level via NestJS `Logger` (Constitution III).
- [x] T014 [US2] Register `AuthGuard` as global guard via `APP_GUARD` provider in `apps/api/src/auth/auth.module.ts`
- [x] T015 [P] [US2] Add `@Public()` decorator to `HealthController` in `apps/api/src/health/health.controller.ts`
- [x] T016 [US2] Run T012 tests and verify they pass

**Checkpoint**: All routes protected by default, `@Public()` routes exempt, JWT validation works end-to-end

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Finalize environment files, verify full pipeline, cleanup

- [x] T017 [P] Add `process.env['BOT_TOKEN']` and `process.env['JWT_SECRET']` to existing test files before dynamic `AppModule` imports — update `apps/api/test/health.spec.ts` and `apps/api/test/prisma.spec.ts` (env vars must be set before `import()` since ConfigModule.forRoot validates at import time)
- [x] T018 Run full monorepo verification: `pnpm turbo run build test lint`
- [x] T019 Verify existing tests still pass (health.spec.ts, prisma.spec.ts) with the global guard active

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on Setup completion
- **US2 (Phase 3)**: Depends on US1 completion (needs JWT issuance for testing)
- **Polish (Phase 4)**: Depends on US1 + US2 completion

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Setup (Phase 1) — independently testable via `POST /auth/validate`
- **User Story 2 (P1)**: Depends on User Story 1 — needs JWT tokens to test guard behavior

### Within Each User Story

- Tests FIRST → ensure they FAIL
- Service before controller (auth.service.ts before auth.controller.ts)
- Module wiring after components exist (auth.module.ts after service + controller)
- App-level wiring last (app.module.ts import)
- Verify tests pass after implementation

### Parallel Opportunities

Within Phase 1:
```
T002 (types.ts) | T003 (public.decorator.ts) | T004 (env.schema.ts) | T005 (.env files)
```

Within Phase 2, after T006 tests written:
```
T007 (auth.service.ts) — sequential from here (each depends on previous)
```

Within Phase 3:
```
T015 (health.controller.ts @Public) can run in parallel with T013 (auth.guard.ts)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: User Story 1
3. **STOP and VALIDATE**: `POST /auth/validate` works, tests pass
4. Deploy/demo if ready — users can authenticate

### Full Delivery

1. Setup → US1 → US2 → Polish
2. Sequential since US2 depends on US1
3. Total: 19 tasks, ~4 phases
