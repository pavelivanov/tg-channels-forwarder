# Railway Deployment Guide

Deploy the TG Channels Forwarder to [Railway](https://railway.app) — a single project with 4 services: API, Worker, PostgreSQL, and Redis.

## Architecture

```
Railway Project: tg-channels-forwarder
├── api          Web service (NestJS + Mini App at /app)
├── worker       Background service (BullMQ listener + forwarder)
├── Postgres     Managed PostgreSQL 16
└── Redis        Managed Redis 7
```

The Mini App is bundled into the API Docker image and served at `/app`. No separate Mini App service is needed.

## Prerequisites

- Railway account
- Railway CLI: `npm install -g @railway/cli` or `brew install railway`
- GitHub repository connected to Railway
- Telegram credentials (see [Environment Variables](#environment-variables))

## Setup

### 1. Create the project

1. Log in to [Railway dashboard](https://railway.app/dashboard)
2. **New Project** → **Deploy from GitHub repo** → select `tg-channels-forwarder`
3. Railway creates one service automatically — rename it to `api`

### 2. Add databases

1. In the project canvas: **New** → **Database** → **Add PostgreSQL**
2. **New** → **Database** → **Add Redis**

Both provision automatically with connection variables.

### 3. Add the worker service

1. **New** → **GitHub Repo** → select the same `tg-channels-forwarder` repository
2. Rename the service to `worker`

### 4. Configure service settings

For each app service, set the config file path under **Settings → Source → Config File Path**:

| Service | Config File Path |
|---------|-----------------|
| api | `/apps/api/railway.toml` |
| worker | `/apps/worker/railway.toml` |

The `railway.toml` files handle Dockerfile paths, watch patterns, health checks, and restart policies.

### 5. Generate a public domain

1. Click the **api** service → **Settings → Networking**
2. Click **Generate Domain** (e.g., `your-app.up.railway.app`)

The worker does not need a public domain — it communicates with databases over Railway's private network.

### 6. Set environment variables

#### Shared variables

Set these as **shared variables** (available to all services) in the project settings:

| Variable | Value | Notes |
|----------|-------|-------|
| `BOT_TOKEN` | Your Telegram bot token | From @BotFather |
| `JWT_SECRET` | Min 32 characters | Generate: `openssl rand -base64 32` |
| `TELEGRAM_API_ID` | Numeric ID | From [my.telegram.org](https://my.telegram.org) |
| `TELEGRAM_API_HASH` | Hash string | From [my.telegram.org](https://my.telegram.org) |
| `TELEGRAM_SESSION` | GramJS session string | See [README.md](../README.md) for generation |
| `NODE_ENV` | `production` | |

#### API service variables

| Variable | Value |
|----------|-------|
| `PORT` | `3000` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |

#### Worker service variables

| Variable | Value |
|----------|-------|
| `PORT` | `3001` |
| `WORKER_HEALTH_PORT` | `3001` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |

The `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}` syntax are Railway variable references that resolve to the actual connection strings from the managed database services.

### 7. Deploy

Push to `main`. Railway auto-builds and deploys both services:

- **API**: Builds from `apps/api/Dockerfile`, runs `prisma migrate deploy` (pre-deploy), starts NestJS
- **Worker**: Builds from `apps/worker/Dockerfile`, starts BullMQ listener

### 8. Verify

```bash
curl https://your-app.up.railway.app/health
```

Expected: `200 OK` with healthy status for database and Redis.

Open `https://your-app.up.railway.app/app` in a browser to verify the Mini App loads.

### 9. Configure BotFather

1. Open @BotFather in Telegram → `/mybots` → select your bot
2. **Bot Settings → Menu Button** → set URL to `https://your-app.up.railway.app/app`

## Environment Variables

Full reference of all variables used by the application:

| Variable | Required By | Description |
|----------|------------|-------------|
| `DATABASE_URL` | api, worker | PostgreSQL connection string (use `${{Postgres.DATABASE_URL}}`) |
| `REDIS_URL` | api, worker | Redis connection string (use `${{Redis.REDIS_URL}}`) |
| `BOT_TOKEN` | api, worker | Telegram bot token from @BotFather |
| `JWT_SECRET` | api | Secret for JWT signing (min 32 chars) |
| `TELEGRAM_API_ID` | worker | Telegram API ID from my.telegram.org |
| `TELEGRAM_API_HASH` | worker | Telegram API hash from my.telegram.org |
| `TELEGRAM_SESSION` | worker | GramJS session string for MTProto userbot |
| `PORT` | api, worker | Service port (api: 3000, worker: 3001) |
| `WORKER_HEALTH_PORT` | worker | Health check port (3001) |
| `NODE_ENV` | api, worker | Set to `production` |
| `LOG_LEVEL` | api, worker | Optional: trace, debug, info, warn, error, fatal |

## How It Works

### Config-as-code

Each service has a `railway.toml` that configures:

- **Builder**: Uses existing multi-stage Dockerfiles
- **Watch patterns**: Only rebuilds when relevant files change (e.g., API doesn't rebuild when only worker code changes)
- **Health checks**: Railway verifies the new deployment is healthy before routing traffic
- **Restart policy**: Services auto-restart on crashes

### Database migrations

The API service runs `prisma migrate deploy` via Railway's `preDeployCommand` — this executes after the Docker image builds but before the application starts. Migrations have access to the `DATABASE_URL` environment variable.

### Zero-downtime deploys

Railway keeps the previous deployment active until the new one passes its health check. If the health check times out (300s), the deployment is marked as failed and the old deployment continues serving traffic.

### Selective rebuilds

Watch patterns in `railway.toml` ensure each service only rebuilds when its relevant files change:

| Service | Triggers rebuild |
|---------|-----------------|
| api | `apps/api/**`, `packages/shared/**`, `pnpm-lock.yaml` |
| worker | `apps/worker/**`, `packages/shared/**`, `pnpm-lock.yaml` |

## Seed Source Channels

After the first deploy, seed the channels you want to monitor:

```bash
railway link                 # Link CLI to your project
railway run -s api -- npx tsx apps/api/prisma/seed-channels.ts @channel1,@channel2
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Build fails with OOM | Docker build runs out of memory | Increase Railway service memory limit |
| Health check timeout | App not listening on correct port | Verify `PORT` env var matches railway.toml |
| Migration fails | `DATABASE_URL` not available | Verify `${{Postgres.DATABASE_URL}}` reference is set |
| Worker can't connect to Telegram | Missing `TELEGRAM_SESSION` | Re-generate session string and update variable |
| API starts but DB queries fail | Migrations haven't run | Check deploy logs for `preDeployCommand` output |
| Mini App returns 404 | API not serving static files | Verify `apps/mini-app/dist` is in the API Docker image |
| Secrets in build logs | Env vars used during build | Move sensitive vars to runtime-only (Railway injects at runtime, not build) |
