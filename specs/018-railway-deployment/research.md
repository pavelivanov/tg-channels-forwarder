# Research: Railway Deployment

## R1. Railway Project Architecture for Monorepos

**Decision**: Single Railway project with multiple services (not one project per service).

**Rationale**: Railway's architecture maps one project to one environment. Services within a project share private networking (`*.railway.internal`) and can reference each other's variables via `${{ServiceName.VAR}}`. This matches our monorepo structure perfectly.

**Alternatives considered**:
- Separate Railway projects per service — rejected because it loses private networking and variable references.
- Docker Compose on Railway — not supported; Railway deploys individual containers.

## R2. Config-as-Code Format

**Decision**: Per-service `railway.toml` files placed alongside each Dockerfile (`apps/api/railway.toml`, `apps/worker/railway.toml`).

**Rationale**: Railway supports `railway.toml` or `railway.json` for declarative config. Each service in the project can point to a different config file path (absolute from repo root). Co-locating with the Dockerfile keeps deployment config near the service code.

**Key fields used**:
- `[build]`: `builder`, `dockerfilePath`, `watchPatterns`
- `[deploy]`: `preDeployCommand`, `healthcheckPath`, `healthcheckTimeout`, `restartPolicyType`, `restartPolicyMaxRetries`

Config in code **overrides** dashboard settings. Schema at `https://railway.com/railway.schema.json`.

**Alternatives considered**:
- Single root-level railway.toml — not supported for multi-service projects.
- Dashboard-only config — rejected for reproducibility.

## R3. Service Count

**Decision**: 4 services total — API, Worker, PostgreSQL, Redis. No separate Mini App service.

**Rationale**: The API Dockerfile already copies the Mini App dist files and serves them at `/app`. Running a separate nginx container for the Mini App would be redundant. Railway charges per service, and the API already handles this.

**Alternatives considered**:
- 5 services (+ standalone Mini App nginx) — rejected as redundant; the API serves static files.

## R4. Managed Databases

**Decision**: Use Railway's built-in PostgreSQL and Redis services.

**Rationale**:
- PostgreSQL: Railway offers versions 15-18 via `ghcr.io/railwayapp-templates/postgres-ssl`. Version 16 matches our docker-compose.yml.
- Redis: Uses official `redis` Docker Hub image (7.x). Suitable for BullMQ queues and dedup keys.
- Both auto-provision connection variables (`DATABASE_URL`, `REDIS_URL`) on the database service itself. Application services pull them via `${{Postgres.DATABASE_URL}}` references.

**Alternatives considered**:
- External managed database (Neon, Supabase, Upstash) — rejected for simplicity; Railway's built-in databases are sufficient for this project's scale.

## R5. Prisma Migrations Strategy

**Decision**: Use Railway's `preDeployCommand` in the API service's railway.toml.

**Rationale**: `preDeployCommand` runs after the Docker image is built but before the application process starts. It has access to all environment variables (including `DATABASE_URL`). This is the recommended approach per Railway and Prisma docs.

**Requirements**:
1. The API Dockerfile must copy `prisma/` directory (schema + migrations) into the final runner stage.
2. The `prisma` CLI must be available in the final image. Currently it's in devDependencies — needs to move to dependencies, or a standalone prisma binary must be copied.

**Alternatives considered**:
- Baking migration into the start command (`prisma migrate deploy && node main.js`) — works but less clean; Railway's preDeployCommand is purpose-built for this.
- Separate one-off migration service — overkill for this project.

## R6. Worker Health Check Port

**Decision**: Configure `PORT=3001` explicitly in Railway for the worker service, matching `WORKER_HEALTH_PORT`.

**Rationale**: Railway health checks hit the `PORT` that the service listens on. Our worker's health server listens on `WORKER_HEALTH_PORT` (defaults to 3001). Rather than refactoring the worker to use `PORT`, we explicitly set `PORT=3001` in Railway so Railway's health check probes the correct port.

**Alternatives considered**:
- Refactoring worker to use `PORT` env var — would require code changes and could conflict with Railway's port injection.
- Setting `WORKER_HEALTH_PORT=${{PORT}}` — simpler, but Railway auto-injects PORT and we want explicit control.

## R7. Watch Paths for Selective Deploys

**Decision**: Use `watchPatterns` in each service's railway.toml to scope rebuilds.

| Service | Watch Patterns |
|---------|---------------|
| API | `apps/api/**`, `packages/shared/**`, `pnpm-lock.yaml` |
| Worker | `apps/worker/**`, `packages/shared/**`, `pnpm-lock.yaml` |

**Rationale**: Both API and Worker depend on `@aggregator/shared`. Changes to shared code should trigger rebuilds. `pnpm-lock.yaml` changes indicate dependency updates.

## R8. Environment Variable Strategy

**Decision**: Use Railway shared variables for secrets common to both services, plus `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}` references for infrastructure.

**Shared variables** (set once, available to all services):
- `BOT_TOKEN`, `JWT_SECRET`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`, `NODE_ENV`

**Per-service variables**:
- API: `PORT=3000`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `REDIS_URL=${{Redis.REDIS_URL}}`
- Worker: `PORT=3001`, `WORKER_HEALTH_PORT=3001`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `REDIS_URL=${{Redis.REDIS_URL}}`

**Alternatives considered**:
- Duplicating secrets per service without shared variables — more error-prone and harder to rotate.

## R9. Health Check Configuration

**Decision**: Use `healthcheckPath` in railway.toml with 300-second timeout.

| Service | Path | Timeout |
|---------|------|---------|
| API | `/health` | 300s |
| Worker | `/` | 300s |

**Rationale**: Health checks run during deployment only. Railway keeps the old deployment active until the new one passes. 300s (5 min) is the default and provides enough time for build + startup + migration.

**Key detail**: Health check requests come from hostname `healthcheck.railway.app`. Our services don't filter by Host header, so this is fine.
