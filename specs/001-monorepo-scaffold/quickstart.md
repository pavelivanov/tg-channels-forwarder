# Quickstart: Monorepo Scaffold & Infrastructure

**Branch**: `001-monorepo-scaffold` | **Date**: 2026-02-16

## Prerequisites

- Node.js 22 LTS
- pnpm (installed via `corepack enable`)
- Docker and Docker Compose

## Setup

```bash
# Clone and install
git clone <repo-url>
cd tg-channels-forwarder
corepack enable
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your values (see .env.example for descriptions)
```

## Run Locally (Docker)

```bash
# Start all services (Postgres, Redis, API, Worker)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Verify API health
curl http://localhost:3000/health
# Expected: { "status": "ok", ... }

# Verify Worker (check logs)
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs worker
# Expected: structured JSON log with startup message
```

## Run Locally (Without Docker)

```bash
# Start Postgres and Redis manually or via Docker
docker compose up postgres redis -d

# Run API
pnpm --filter @aggregator/api run dev

# Run Worker (separate terminal)
pnpm --filter @aggregator/worker run dev
```

## Build & Lint

```bash
# Build all packages
turbo run build

# Lint all packages
turbo run lint

# Run all tests
turbo run test

# Type check
turbo run typecheck
```

## Project Structure

```
tg-channels-forwarder/
├── apps/
│   ├── api/                  # NestJS API with health check
│   ├── worker/               # Node.js worker process
│   └── mini-app/             # Placeholder static site
├── packages/
│   ├── shared/               # Shared constants and types
│   ├── tsconfig/             # Shared TypeScript configs
│   └── eslint-config/        # Shared ESLint config
├── docker-compose.yml          # Production-like services
├── docker-compose.dev.yml      # Dev overrides
├── turbo.json                # Turborepo pipeline config
├── pnpm-workspace.yaml       # Workspace definition
├── .env.example              # Environment variable template
└── package.json              # Root package.json
```

## Verification Checklist

- [ ] `pnpm install` completes without errors
- [ ] `turbo run build` compiles all packages
- [ ] `turbo run lint` passes with zero violations
- [ ] `turbo run test` passes all tests
- [ ] `docker compose up` starts all services
- [ ] `curl localhost:3000/health` returns 200
- [ ] Worker logs show structured JSON startup message
- [ ] `import { MAX_CHANNELS_PER_USER } from '@aggregator/shared'`
      resolves to `30`
