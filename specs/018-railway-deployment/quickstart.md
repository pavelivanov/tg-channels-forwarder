# Quickstart: Railway Deployment

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- Railway CLI installed (`npm install -g @railway/cli` or `brew install railway`)
- GitHub repository connected to Railway
- Telegram credentials ready (BOT_TOKEN, API_ID, API_HASH, SESSION)

## Step 1: Create Railway Project

1. Log in to [Railway dashboard](https://railway.app/dashboard)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select the `tg-channels-forwarder` repository
4. Railway creates one service automatically — this will become the API service

## Step 2: Add Database Services

1. In the project canvas, click **New** → **Database** → **Add PostgreSQL**
2. Click **New** → **Database** → **Add Redis**
3. Both services provision automatically with connection variables

## Step 3: Add Worker Service

1. Click **New** → **GitHub Repo** → select the same repository
2. Rename the service to `worker` (click the service → Settings → Service Name)
3. Under **Settings → Source**:
   - Config File Path: `/apps/worker/railway.toml`
4. The `railway.toml` will handle Dockerfile path and watch patterns

## Step 4: Configure API Service

1. Click the first service (API) → Settings → rename to `api`
2. Under **Settings → Source**:
   - Config File Path: `/apps/api/railway.toml`
3. Under **Settings → Networking**:
   - Generate a public domain (e.g., `your-app.up.railway.app`)

## Step 5: Set Shared Variables

1. Click **Variables** at the project level (or use Railway's shared variables)
2. Add these shared variables:

| Variable | Value |
|----------|-------|
| `BOT_TOKEN` | Your Telegram bot token |
| `JWT_SECRET` | Min 32 chars (generate: `openssl rand -base64 32`) |
| `TELEGRAM_API_ID` | From my.telegram.org |
| `TELEGRAM_API_HASH` | From my.telegram.org |
| `TELEGRAM_SESSION` | GramJS session string |
| `NODE_ENV` | `production` |

## Step 6: Set Per-Service Variables

**API service**:

| Variable | Value |
|----------|-------|
| `PORT` | `3000` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |

**Worker service**:

| Variable | Value |
|----------|-------|
| `PORT` | `3001` |
| `WORKER_HEALTH_PORT` | `3001` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |

## Step 7: Deploy

Push to `main`. Railway auto-builds and deploys both services:
- API runs `prisma migrate deploy` via preDeployCommand, then starts
- Worker starts and connects to Telegram MTProto

## Step 8: Verify

```bash
# Health checks
curl https://your-app.up.railway.app/health

# Mini App
# Open https://your-app.up.railway.app/app in browser
```

## Step 9: Configure BotFather

1. Open @BotFather in Telegram
2. `/mybots` → select your bot → Bot Settings → Menu Button
3. Set URL to `https://your-app.up.railway.app/app`

## Seed Source Channels (First Time)

After the API is running, seed channels using the Railway CLI:

```bash
railway link     # Link to your project
railway run -s api -- npx tsx apps/api/prisma/seed-channels.ts @channel1,@channel2
```

Or use the Railway dashboard's **Execute** button on the API service.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Build fails | Missing env vars during build | Ensure build doesn't need runtime secrets |
| Health check timeout | App not listening on correct PORT | Check `PORT` env var matches service config |
| Migration fails | DATABASE_URL not available | Verify `${{Postgres.DATABASE_URL}}` reference |
| Worker can't connect to Telegram | Missing TELEGRAM_SESSION | Re-generate session string and update var |
