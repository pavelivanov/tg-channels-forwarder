# Quickstart: Authentication (Telegram initData + JWT)

**Branch**: `003-telegram-jwt-auth` | **Date**: 2026-02-16

## Prerequisites

- Docker running (PostgreSQL + Redis via `docker-compose up -d`)
- Prisma migrations applied (`cd apps/api && pnpm exec prisma migrate dev`)
- A Telegram bot token from @BotFather

## Environment Setup

Add to `apps/api/.env`:

```env
BOT_TOKEN=<your-telegram-bot-token>
JWT_SECRET=<random-string-at-least-32-chars>
```

## New Dependencies

```bash
cd apps/api && pnpm add @nestjs/jwt
```

## File Structure

```text
apps/api/src/
├── auth/
│   ├── auth.module.ts        # AuthModule: imports JwtModule, provides AuthService, AuthGuard
│   ├── auth.controller.ts    # POST /auth/validate
│   ├── auth.service.ts       # initData validation, user upsert, JWT signing
│   ├── auth.guard.ts         # Global JWT guard (APP_GUARD)
│   ├── public.decorator.ts   # @Public() decorator
│   └── types.ts              # JwtPayload interface, ValidateInitDataDto
├── env.schema.ts             # Updated: adds BOT_TOKEN, JWT_SECRET
└── app.module.ts             # Updated: imports AuthModule
```

## Test the Flow

### 1. Authenticate

```bash
# Generate test initData (see test helpers in auth.spec.ts)
curl -X POST http://localhost:3000/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"initData": "<valid-init-data-string>"}'
```

### 2. Access Protected Endpoint

```bash
curl http://localhost:3000/health \
  -H "Authorization: Bearer <token-from-step-1>"
```

Note: `/health` remains public (decorated with `@Public()`), so it works without a token too. Use it to verify the guard allows public routes.

## Key Decisions

- **Global guard by default**: All routes require JWT unless marked `@Public()`. Safer than opt-in.
- **No Passport.js**: Direct `@nestjs/jwt` integration is simpler for single-strategy auth.
- **No external crypto lib**: Node.js `crypto` handles HMAC-SHA256 natively.
- **Zod for env validation**: Consistent with existing pattern in `env.schema.ts`.
- **BigInt as string in JWT**: JSON cannot represent BigInt; string serialization is lossless.
