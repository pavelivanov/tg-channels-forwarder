# Feature Specification: Railway Deployment

**Feature Branch**: `018-railway-deployment`
**Created**: 2026-02-20
**Status**: Draft
**Input**: User description: "Use Railway, setup deployment process"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deploy All Services to Railway (Priority: P1)

As a developer, I want to deploy the API, Worker, and Mini App services to Railway so the system is running in production and accessible to users.

**Why this priority**: Without running services, nothing else matters. This is the core deployment that makes the application available.

**Independent Test**: Can be fully tested by deploying all three services and confirming each returns a healthy response at its public URL, and the Mini App is accessible at `/app`.

**Acceptance Scenarios**:

1. **Given** the repository is connected to Railway, **When** a push is made to the main branch, **Then** all three services (API, Worker, Mini App) are built and deployed automatically.
2. **Given** services are deployed, **When** a user visits the API health endpoint, **Then** it returns a 200 OK with healthy status for all dependencies (database, Redis).
3. **Given** services are deployed, **When** a user visits the Worker health endpoint, **Then** it returns a 200 OK confirming the worker is processing jobs.
4. **Given** services are deployed, **When** a user opens the Mini App URL in Telegram, **Then** the React SPA loads and can authenticate.

---

### User Story 2 - Provision and Connect Managed Infrastructure (Priority: P2)

As a developer, I want PostgreSQL and Redis provisioned as managed services on Railway so the application services can connect to persistent storage without manual infrastructure management.

**Why this priority**: Services cannot function without their database and cache dependencies. Railway provides managed PostgreSQL and Redis plugins that handle provisioning and connection strings.

**Independent Test**: Can be tested by provisioning PostgreSQL and Redis on Railway, connecting from a local client using the Railway-provided connection strings, and running a basic query/ping.

**Acceptance Scenarios**:

1. **Given** a Railway project exists, **When** PostgreSQL is added as a plugin, **Then** a `DATABASE_URL` variable is automatically injected into linked services.
2. **Given** a Railway project exists, **When** Redis is added as a plugin, **Then** a `REDIS_URL` variable is automatically injected into linked services.
3. **Given** infrastructure is provisioned, **When** the API service starts, **Then** it connects to PostgreSQL and Redis using Railway-injected variables without manual configuration.
4. **Given** PostgreSQL is provisioned, **When** database migrations are run, **Then** the schema is applied and the API can read/write data.

---

### User Story 3 - Configure Environment Variables and Secrets (Priority: P3)

As a developer, I want all required environment variables (Telegram credentials, JWT secret, etc.) configured securely in Railway so services have the secrets they need at runtime.

**Why this priority**: Some variables (BOT_TOKEN, JWT_SECRET, TELEGRAM_* credentials) are secrets that cannot be auto-provisioned. They must be manually set once but then persist across deployments.

**Independent Test**: Can be tested by setting all required variables in Railway's dashboard, deploying a service, and confirming the service reads the correct values at startup without errors.

**Acceptance Scenarios**:

1. **Given** the Railway project is configured, **When** all required environment variables are set, **Then** the API starts without configuration validation errors.
2. **Given** the Railway project is configured, **When** all required environment variables are set, **Then** the Worker starts and connects to Telegram MTProto.
3. **Given** a secret variable is updated in Railway, **When** the service is redeployed, **Then** it picks up the new value.

---

### User Story 4 - Run Database Migrations During Deployment (Priority: P4)

As a developer, I want database migrations to run automatically as part of the deployment process so the schema is always in sync with the deployed code.

**Why this priority**: Schema drift causes runtime failures. Automating migrations ensures every deploy has the correct database schema.

**Independent Test**: Can be tested by adding a new migration locally, pushing to the main branch, and confirming the migration is applied to the Railway PostgreSQL instance after deployment completes.

**Acceptance Scenarios**:

1. **Given** a new migration exists, **When** the API service deploys, **Then** `prisma migrate deploy` runs before the application starts.
2. **Given** migrations have already been applied, **When** the API service redeploys with no new migrations, **Then** the migration step completes quickly with no changes and the service starts normally.
3. **Given** a migration fails, **When** the deployment runs, **Then** the service does not start with the broken schema and the deployment is marked as failed.

---

### Edge Cases

- What happens when a deployment fails mid-build (e.g., out-of-memory during Docker build)?
  - Railway marks the deployment as failed and keeps the previous healthy deployment running.
- What happens when the database is temporarily unreachable during a deploy?
  - The health check fails, Railway does not route traffic to the new instance, and the previous deployment continues serving.
- What happens when a required environment variable is missing?
  - The service fails to start (NestJS config validation), Railway marks the deployment as failed, and the previous deployment stays active.
- What happens when Redis is temporarily down?
  - The API health check reports degraded status. The Worker cannot process jobs until Redis recovers. BullMQ retries automatically once Redis is back.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST deploy the API service from `apps/api/Dockerfile` to Railway as a web service accessible via HTTPS.
- **FR-002**: The system MUST deploy the Worker service from `apps/worker/Dockerfile` to Railway as a background service with health check.
- **FR-003**: The system MUST serve the Mini App as static files from the API service at the `/app` path (no separate Mini App service needed in production).
- **FR-004**: The system MUST provision a managed PostgreSQL 16 instance via Railway and inject `DATABASE_URL` into the API and Worker services.
- **FR-005**: The system MUST provision a managed Redis 7 instance via Railway and inject `REDIS_URL` into the API and Worker services.
- **FR-006**: The system MUST run `prisma migrate deploy` as part of the API deployment before the application process starts.
- **FR-007**: The system MUST support configuring Telegram-specific secrets (`BOT_TOKEN`, `JWT_SECRET`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`) as environment variables in Railway.
- **FR-008**: The system MUST auto-deploy on every push to the main branch.
- **FR-009**: The system MUST configure health check endpoints so Railway can detect unhealthy deployments (API on `/health`, Worker on `/`).
- **FR-010**: The system MUST provide documentation for initial project setup on Railway including all manual steps.

### Non-Functional Requirements

- **NFR-001**: Deployments MUST complete (build + start) within 10 minutes.
- **NFR-002**: Zero-downtime deploys — the previous deployment MUST remain active until the new one passes health checks.
- **NFR-003**: Secrets MUST never appear in build logs or be committed to the repository.

### Assumptions

- Railway's managed PostgreSQL supports version 16 and is suitable for the project's data volume.
- Railway's managed Redis supports version 7 and provides sufficient memory for BullMQ queues and dedup keys.
- The Mini App static files are bundled into the API Docker image at build time (existing `apps/api/Dockerfile` already copies them), so no separate Mini App service is needed on Railway.
- The developer has a Railway account and has installed the Railway CLI.
- The main branch (`main`) is the deployment target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All services are reachable via HTTPS within 10 minutes of pushing to the main branch.
- **SC-002**: The API health endpoint returns 200 OK with all dependencies (database, Redis) reported healthy.
- **SC-003**: The Worker health endpoint returns 200 OK confirming it is processing messages.
- **SC-004**: The Mini App loads in the Telegram client when opened via the bot's menu button.
- **SC-005**: A new migration pushed to main is applied automatically without manual intervention.
- **SC-006**: A failed deployment does not take down the currently running version.
