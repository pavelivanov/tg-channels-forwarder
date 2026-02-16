# Project Constitution

## Project Identity

**Name:** Telegram Channel Aggregator
**Type:** Backend service + Telegram Mini App
**Stage:** MVP
**Goal:** Allow users to aggregate messages from multiple Telegram channels and forward them to their own channel via a managed bot.

---

## Technology Stack (Non-Negotiable)

- **Runtime:** Node.js 20+
- **Language:** TypeScript (strict mode, no `any` types)
- **Backend Framework:** NestJS
- **Testing:** Vitest (unit + integration)
- **Monorepo:** Turborepo with pnpm workspaces
- **Telegram Bot API:** grammY
- **Telegram MTProto (userbot):** telegram (GramJS)
- **Database:** PostgreSQL 16 with Prisma ORM
- **Cache & Queue:** Redis 7 (shared instance, key-prefix separated)
- **Message Queue:** BullMQ (backed by Redis)
- **Containerization:** Docker with multi-stage builds, Docker Compose for orchestration
- **Logging:** pino (via nestjs-pino in the API)

Do not introduce alternative frameworks, ORMs, or queue systems. Do not add MongoDB, Mongoose, TypeORM, Sequelize, RabbitMQ, Kafka, or Express. The Nest API is the only HTTP server.

---

## Architecture Principles

### Service Separation

The system consists of three independently deployable units that share code via internal packages:

1. **API** (`apps/api`) — NestJS application. Handles authentication, user management, channel management, subscription CRUD, and health checks. Owns the Prisma schema and all database writes.
2. **Worker** (`apps/worker`) — Long-running process containing the Listener (MTProto userbot) and Forwarder (BullMQ consumer + grammY bot). No HTTP server. Communicates with the API only through the shared database and Redis.
3. **Mini App** (`apps/mini-app`) — Lightweight frontend served as a Telegram WebApp. Communicates exclusively with the API via REST.

### Message Flow (Mandatory Pattern)

```
Source Channel → Listener (MTProto) → BullMQ Queue → Forwarder (grammY bot) → Destination Channel
```

The listener MUST NOT forward messages directly. All messages pass through the BullMQ queue. This is non-negotiable — it enables retry logic, rate limiting, and decoupled scaling.

### No Message Persistence

Messages are never stored in the database. Redis is used only for:
- Deduplication cache (TTL-based, 72 hours)
- BullMQ job queue (transient, auto-cleaned)

### Deduplication

- Algorithm: SHA-256 hash of the first 10 words of the normalized message text (lowercased, punctuation stripped, whitespace collapsed).
- Scope: per destination channel. Key format: `dedup:{destinationChannelId}:{hash}`
- TTL: 72 hours.
- Messages with no text content (media-only, no caption) skip deduplication.

### Authentication

Users authenticate via Telegram Mini App `initData`. The backend validates the HMAC-SHA256 signature using the bot token. On first valid request, the user is upserted. A JWT is issued for subsequent API calls within the session.

---

## Monorepo Structure

```
telegram-aggregator/
├── apps/
│   ├── api/          # NestJS backend
│   ├── worker/       # Listener + Forwarder
│   ├── mini-app/     # Telegram Mini App (frontend)
│   └── landing/      # Placeholder for future landing page
├── packages/
│   ├── shared/       # Types, constants, utility functions
│   ├── eslint-config/
│   └── tsconfig/
├── infrastructure/
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
├── turbo.json
└── package.json
```

All shared types, constants (rate limits, TTLs, channel limits), and utility functions (normalization, hashing) live in `packages/shared`. Apps import from `@aggregator/shared`. Never duplicate logic across apps.

---

## Data Model Constraints

### User Limits
- Default `maxLists`: 1 (free tier). Additional lists gated for future payment integration.
- Maximum 30 source channels per user across ALL active subscription lists.
- These limits are enforced at the API level, not the database level. Use application-layer validation.

### Source Channels
- `SourceChannel` is a global shared pool. When any user adds a channel, it becomes available to all users.
- The userbot subscribes to each channel exactly once, regardless of how many users reference it.
- Rate limit channel joins: maximum 5 per hour with 2-5 second random delays between joins.

### Subscription Lists
- A list maps N source channels to 1 destination channel.
- The same source channel MAY appear in multiple lists (same user or different users).
- Deduplication prevents the same message from reaching the same destination twice, even via different lists.
- Deleting a list is a soft delete (`isActive: false`).

---

## Error Handling Strategy

### Retry Policy (BullMQ)
- Max 3 attempts per job.
- Exponential backoff: 5s → 25s → 125s.
- After 3 failures: move to dead letter queue (`message-forward-dlq`).
- On Telegram 429 (rate limit): honor `retry_after` value from the response.

### Recoverable Errors (automatic)
- Network timeouts, Redis reconnection, Telegram 429s.

### Recoverable Errors (manual intervention)
- Userbot session expired or banned → alert via logs.
- Bot removed from destination channel → mark subscription list as inactive.

### Non-Recoverable Errors
- Unsupported message type → skip and log.
- Source channel deleted → mark as inactive.

Never silently swallow errors. Every caught exception must be logged with structured context.

---

## Rate Limiting

### Bot Forwarding
- Global: 20 messages/second maximum.
- Per destination channel: 15 messages/minute.
- Use BullMQ's built-in rate limiter or `bottleneck`.

### Userbot Channel Joins
- Maximum 5 joins per hour.
- Random delay of 2-5 seconds between joins.
- Honor `FloodWaitError` wait times.

### API
- Standard rate limiting on public endpoints (use `@nestjs/throttler`).

---

## Supported Message Types (MVP)

Forward these types: text, photo, video, document, animation (GIF), audio, media groups (albums).

Do NOT implement forwarding for: voice messages, stickers, polls, contacts, locations, venues, dice.

Albums (media groups) require special handling: the listener collects all parts within a 300ms window before queuing a single job. The forwarder sends via `sendMediaGroup`.

Messages are reconstructed (sent as new messages via the bot), not natively forwarded. Original formatting (bold, italic, links, entities) must be preserved.

---

## Logging

Use structured JSON logging via pino across all services.

Every log entry MUST include:
- `timestamp` (ISO-8601)
- `level` (error, warn, info, debug)
- `service` (api, listener, forwarder)
- `event` (descriptive event name)

Key events to log:
- `message_forwarded` — successful forward with source/destination IDs and duration.
- `message_deduplicated` — duplicate detected, message skipped.
- `forward_failed` — forward attempt failed with error details.
- `channel_joined` — userbot subscribed to a new channel.
- `channel_join_failed` — subscription attempt failed.
- `userbot_disconnected` / `userbot_reconnected` — session state changes.
- `job_moved_to_dlq` — job exhausted all retries.

Debug-level logging (job payloads, hash calculations) is disabled in production.

---

## Testing Requirements

- All business logic must have unit tests (Vitest).
- Minimum test coverage for: dedup logic, subscription limit validation, initData HMAC validation, normalization/hashing utilities, API endpoint behavior.
- Integration tests for: API endpoints with a test database, BullMQ job processing with Redis.
- Test files are colocated with source files: `*.spec.ts` alongside `*.ts`.
- Use `beforeEach`/`afterEach` for test isolation. Never rely on test execution order.

---

## Code Style & Conventions

- Use NestJS conventions: modules, controllers, services, guards, interceptors, pipes.
- Use constructor injection for all dependencies.
- DTOs for all API request/response shapes, validated with `class-validator`.
- All environment variables accessed through a typed `ConfigService` (NestJS `@nestjs/config`).
- No magic strings. Constants live in `packages/shared/src/constants/`.
- Prefer `async/await` over raw promises. No callback-style code.
- No default exports except where required by NestJS module conventions.
- Barrel exports (`index.ts`) in each package and module for clean imports.

---

## Docker & Deployment

- Multi-stage Dockerfile for each app (deps → build → runtime).
- Base image: `node:20-alpine`.
- Docker Compose includes: postgres, redis, api, worker.
- All configuration via environment variables. No hardcoded values.
- Prisma migrations run as a separate step (`npx prisma migrate deploy`), not on app startup.
- Health check endpoint at `GET /health` reports: postgres, redis, userbot session, bot connectivity, queue stats.

---

## Security

- Never log sensitive data: bot tokens, session strings, user tokens.
- Validate `initData` HMAC server-side on every request before JWT issuance.
- JWT tokens are short-lived (1 hour). No refresh tokens in MVP.
- Sanitize all user input (channel usernames) before using in Telegram API calls.
- Environment variables for all secrets. Use `.env.example` as a template; `.env` is gitignored.

---

## What This Project Is NOT (Scope Boundaries)

- Not a general-purpose Telegram bot framework. It does one thing: aggregate and forward.
- Not a real-time chat application. There is no WebSocket connection to end users.
- Not a message archive or search engine. Messages are not stored.
- Not a multi-tenant SaaS with billing (yet). Payment integration is deferred.
- Not a public API. The API serves only the Mini App frontend.

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Single userbot account | MVP simplicity. Accepted risk of ban. Secondary account ready for manual failover. |
| BullMQ over direct forwarding | Decouples listener from forwarder. Enables retry, rate limiting, and future scaling. |
| Dedup via first-10-words hash | Simple, fast, good enough for MVP. Fuzzy matching deferred. |
| Postgres for users, Redis for everything else | Users/subscriptions are relational. Messages are transient. |
| Reconstruct messages instead of native forward | Bot forwards show "Forwarded from" which may not be desired. Reconstruction gives control over presentation. |
| Soft delete for subscription lists | Preserves audit trail. Allows easy reactivation. |
| Channel cleanup after 30 days | Userbot leaves channels with no active references for 30 days to reduce exposure. |
| Bot admin check on list creation | `getChat` to verify bot is admin in destination before activating a list. |
| Mini App served via API static middleware | Simplifies deployment for MVP. Separate deployment later if needed. |
| JWT from initData, 1-hour TTL | Simple auth for MVP. No refresh flow needed given Mini App session patterns. |
