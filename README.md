# TG Channels Forwarder

A Telegram channel message forwarding system. Monitors source channels via MTProto userbot, forwards messages to destination channels via Bot API, with deduplication, rate limiting, and a Telegram Mini App for managing subscription lists.

## Architecture

```
┌─────────────┐     ┌───────────┐     ┌──────────────┐
│  Telegram   │     │  BullMQ   │     │  Telegram    │
│  Source     │────▶│  Queue    │────▶│  Destination │
│  Channels   │     │  (Redis)  │     │  Channels    │
└─────────────┘     └───────────┘     └──────────────┘
   MTProto            Worker             Bot API
   (GramJS)           (dedup +           (grammY)
                      rate limit)
```

**Apps:**
- `apps/api` — NestJS REST API (auth, channels, subscription lists, serves mini-app)
- `apps/worker` — Background worker (listener, forwarder, dedup, rate limiter)
- `apps/mini-app` — React Telegram Mini App (manage subscription lists, shadcn/ui + Tailwind CSS v4)

**Packages:**
- `packages/shared` — Shared types, constants, queue definitions, dedup utilities
- `packages/tsconfig` — Shared TypeScript configuration
- `packages/eslint-config` — Shared ESLint configuration

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| API | NestJS 10, Prisma ORM v6, PostgreSQL 16 |
| Worker | BullMQ, GramJS (MTProto), grammY (Bot API), Redis 7 |
| Mini App | React 19, Vite 6, Tailwind CSS v4, shadcn/ui (new-york), React Router 7 |
| Auth | Telegram `initData` HMAC validation → JWT |
| Testing | Vitest, Testing Library, Supertest |

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker and Docker Compose

## Local Development

### 1. Start infrastructure

```bash
docker compose up -d postgres redis
```

Wait until both are healthy:

```bash
docker compose ps
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aggregator?schema=public
REDIS_URL=redis://localhost:6379
WORKER_HEALTH_PORT=3001

# Telegram Bot (get from @BotFather)
BOT_TOKEN=your-bot-token

# API auth (min 32 chars — generate with: openssl rand -base64 32)
JWT_SECRET=your-secret-minimum-32-characters-long

# Telegram MTProto (get from https://my.telegram.org)
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=your-api-hash
TELEGRAM_SESSION=your-gramjs-session-string
```

**Getting `TELEGRAM_SESSION`**: This is a GramJS `StringSession` token that authenticates the MTProto userbot. To generate it, run:

```bash
npx telegram@latest
```

It will prompt for your `API_ID`, `API_HASH`, phone number, and 2FA password (if set). After login, it prints the session string — copy the full value into your `.env`.

### 4. Set up the database

```bash
cd apps/api
pnpm exec prisma migrate deploy
pnpm exec prisma generate
cd ../..
```

Generate the worker's Prisma client too:

```bash
cd apps/worker
pnpm exec prisma generate
cd ../..
```

### 5. Seed source channels

Add the Telegram channels you want to monitor:

```bash
cd apps/api
pnpm seed:channels @channel1,@channel2,@channel3
```

This resolves each channel username via MTProto, fetches its numeric ID and title, and upserts it into the database. You can re-run it safely — existing channels are updated, not duplicated.

To also join the channels with the userbot (required for the listener to receive messages):

```bash
pnpm seed:channels --join @channel1,@channel2,@channel3
```

Usernames can be comma-separated, space-separated, or mixed. The `@` prefix is optional.

```bash
cd ../..
```

### 6. Build all packages

```bash
pnpm build
```

### 7. Start services in development mode

Run each in a separate terminal:

```bash
# Terminal 1: API (port 3000)
cd apps/api && pnpm dev

# Terminal 2: Worker
cd apps/worker && pnpm dev

# Terminal 3: Mini App (port 5173)
cd apps/mini-app && pnpm dev
```

Or build and run production-like:

```bash
pnpm build

# Terminal 1
cd apps/api && pnpm start

# Terminal 2
cd apps/worker && pnpm start
```

### Health checks

- API: `http://localhost:3000/health`
- Worker: `http://localhost:3001/health`

### Mini App UI

The Mini App uses [shadcn/ui](https://ui.shadcn.com/) components with Tailwind CSS v4. Telegram theme integration is automatic — shadcn's CSS design tokens are mapped to Telegram's `--tg-theme-*` runtime variables, so light/dark mode works without any JavaScript detection:

```
Telegram runtime → --tg-theme-* → shadcn :root tokens → @theme inline → Tailwind classes
```

To add new shadcn components:

```bash
cd apps/mini-app
npx shadcn@latest add <component-name>
```

### Testing the Mini App locally

The Mini App requires Telegram's `initData` for authentication, which is only available when opened inside the Telegram client. To test locally:

1. **Expose your local API via a public URL** using [ngrok](https://ngrok.com/) or similar:

```bash
ngrok http 3000
```

2. **Set the Mini App URL** in BotFather:
   - Open @BotFather → `/mybots` → select your bot → Bot Settings → Menu Button (or inline button)
   - Set the URL to your ngrok HTTPS URL + `/app` (e.g., `https://abc123.ngrok.io/app`)

3. **Start the API** (serves the built mini-app at `/app`):

```bash
cd apps/mini-app && pnpm build && cd ../..
cd apps/api && pnpm dev
```

4. **Open the Mini App** from your bot in Telegram — it will load from your local API through the ngrok tunnel.

**For faster frontend iteration**, run the Vite dev server alongside the API:

```bash
# Terminal 1: API (port 3000)
cd apps/api && pnpm dev

# Terminal 2: Mini App dev server (port 5173, proxies API to localhost:3000)
cd apps/mini-app && pnpm dev
```

Then set the BotFather URL to `https://<ngrok-id>.ngrok.io` and configure ngrok to point to port 5173 instead. The Vite dev server proxies `/auth`, `/channels`, `/subscription-lists`, and `/health` to the API on port 3000.

## Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific app
pnpm turbo run test --filter=@aggregator/api
pnpm turbo run test --filter=@aggregator/worker
pnpm turbo run test --filter=@aggregator/mini-app

# Lint
pnpm lint

# Format check
pnpm format:check
```

Tests require Docker Compose services running (PostgreSQL + Redis) for integration tests.

For manual end-to-end testing with real Telegram channels, see [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md).

## Production Deployment

### Option A: Docker Compose (simplest)

1. Create a `.env` file with production values on your server:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@postgres:5432/aggregator?schema=public
REDIS_URL=redis://redis:6379
WORKER_HEALTH_PORT=3001
BOT_TOKEN=your-bot-token
JWT_SECRET=your-production-secret-min-32-chars
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=your-api-hash
TELEGRAM_SESSION=your-gramjs-session-string
```

2. Build and start all services:

```bash
docker compose up -d --build
```

This starts 5 services:
- **postgres** — PostgreSQL 16 on port 5432
- **redis** — Redis 7 on port 6379
- **api** — NestJS API on port 3000 (includes mini-app at `/app`)
- **worker** — Background worker (health on port 3001)
- **mini-app** — React SPA via nginx on port 8080

3. Run database migrations:

```bash
docker compose exec api npx prisma migrate deploy
```

4. Verify services are healthy:

```bash
docker compose ps
curl http://localhost:3000/health
```

### Option B: Build Docker images individually

Each app has a multi-stage Dockerfile that produces a minimal production image:

```bash
# Build API image (also includes mini-app static files at /app)
docker build -f apps/api/Dockerfile -t tg-forwarder-api .

# Build Worker image
docker build -f apps/worker/Dockerfile -t tg-forwarder-worker .

# Build Mini App image (standalone nginx, optional)
docker build -f apps/mini-app/Dockerfile -t tg-forwarder-mini-app .
```

Run with your own orchestration (Kubernetes, ECS, etc.):

```bash
# API
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e BOT_TOKEN=... \
  -e JWT_SECRET=... \
  tg-forwarder-api

# Worker
docker run -d \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e BOT_TOKEN=... \
  -e TELEGRAM_API_ID=... \
  -e TELEGRAM_API_HASH=... \
  -e TELEGRAM_SESSION=... \
  -e WORKER_HEALTH_PORT=3001 \
  tg-forwarder-worker
```

### Environment Variables Reference

| Variable | Required By | Description |
|----------|------------|-------------|
| `DATABASE_URL` | api, worker | PostgreSQL connection string |
| `REDIS_URL` | api, worker | Redis connection string |
| `BOT_TOKEN` | api, worker | Telegram bot token from @BotFather |
| `JWT_SECRET` | api | Secret for JWT signing (min 32 chars) |
| `TELEGRAM_API_ID` | worker, seed | Telegram API ID from my.telegram.org |
| `TELEGRAM_API_HASH` | worker, seed | Telegram API hash from my.telegram.org |
| `TELEGRAM_SESSION` | worker, seed | GramJS session string for MTProto userbot |
| `PORT` | api | API server port (default: 3000) |
| `WORKER_HEALTH_PORT` | worker | Worker health check port (default: 3001) |
| `NODE_ENV` | api, worker | Environment: development, production, test |
| `LOG_LEVEL` | api, worker | Optional: trace, debug, info, warn, error, fatal |

## Project Structure

```
tg-channels-forwarder/
├── apps/
│   ├── api/                  # NestJS REST API
│   │   ├── prisma/           # Prisma schema and migrations
│   │   ├── src/              # Source code
│   │   ├── test/             # Tests
│   │   └── Dockerfile
│   ├── worker/               # Background job worker
│   │   ├── src/              # Source code
│   │   ├── test/             # Tests (unit + e2e)
│   │   └── Dockerfile
│   └── mini-app/             # React Telegram Mini App
│       ├── src/
│       │   ├── components/   # App components + ui/ (shadcn)
│       │   ├── pages/        # Route pages
│       │   ├── hooks/        # Custom React hooks
│       │   ├── lib/          # Utilities (cn, api-client, telegram)
│       │   ├── context/      # Auth context
│       │   └── styles/       # Tailwind CSS v4 + Telegram theme
│       ├── test/             # Tests (Vitest + Testing Library)
│       ├── components.json   # shadcn/ui configuration
│       └── Dockerfile
├── packages/
│   ├── shared/               # Shared types and utilities
│   ├── tsconfig/             # Shared TypeScript config
│   └── eslint-config/        # Shared ESLint config
├── docs/                     # Documentation
├── specs/                    # Feature specifications
├── docker-compose.yml        # Local dev + production compose
├── turbo.json                # Turborepo pipeline config
└── pnpm-workspace.yaml       # pnpm workspace config
```
