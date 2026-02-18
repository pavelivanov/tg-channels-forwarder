# Research: Structured Logging & Health Check Finalization

**Date**: 2026-02-18
**Feature**: 012-logging-health-check

## R1: Health Endpoint Response Format

**Decision**: Replace both the API `@nestjs/terminus` response format and the worker's custom `{ status: 'ok' }` format with a unified response structure: `{ status, uptime, checks: { postgres, redis, userbot, bot, queue } }`.

**Rationale**: The current API uses `@nestjs/terminus` which returns its own format (`{ status: 'ok', info: {...}, error: {...}, details: {...} }`). The worker returns a flat `{ status: 'ok', queue: {...} }`. Neither matches the spec's required format. Both need to be refactored to return the unified structure.

**Approach**:
- **API**: Keep `@nestjs/terminus` for the actual health check execution (it handles timeouts, error catching, etc.), but transform its output into the unified format in the controller. Add bot status check via `BotService`. Add uptime tracking.
- **Worker**: Refactor `health.ts` to add postgres ping (via Prisma `$queryRaw`), redis ping, userbot connection state (via `TelegramClient.connected`), bot status (via grammY `Api.getMe()` as a ping), and retain existing queue metrics. Add status logic and uptime.

**Alternatives considered**:
- Remove `@nestjs/terminus` entirely from API → rejected; terminus handles timeouts and error wrapping well, just needs output transformation.
- Use terminus in worker too → rejected; worker is not NestJS, adding terminus would pull in unnecessary NestJS dependencies.

## R2: Pino Redaction Paths

**Decision**: Configure pino `redact` option with paths covering bot tokens, session strings, JWTs, and authorization headers.

**Rationale**: Pino's built-in `redact` option uses `fast-redact` under the hood, which is performant and handles nested paths via dot/bracket notation. It replaces values with `[Redacted]` by default.

**Paths to redact**:
- `req.headers.authorization` — JWT bearer tokens in API request logs
- `req.headers["x-api-key"]` — potential API keys
- `botToken` — bot token if logged in context objects
- `sessionString` — Telegram session string
- `config.BOT_TOKEN` — bot token from config
- `config.TELEGRAM_SESSION` — session from config
- `config.JWT_SECRET` — JWT secret from config
- `*.password` — any password field at any depth
- `*.token` — any token field at any depth
- `*.secret` — any secret field at any depth

**Approach**: Define redaction paths in a shared constant array and use them in both API (via `LoggerModule.forRoot({ pinoHttp: { redact } })`) and worker (via `pino({ redact })`).

## R3: Correlation ID Strategy

**Decision**: Generate a UUID correlation ID per inbound message in the worker's `ListenerService.handleNewMessage()` and pass it through the queue job data to the forwarder. Use pino child loggers to attach the correlation ID.

**Rationale**: The message processing pipeline is: ListenerService → QueueProducer → BullMQ → QueueConsumer → ForwarderService. The correlation ID must be present in all log entries across these stages.

**Approach**:
1. In `ListenerService.handleNewMessage()`: generate `correlationId = crypto.randomUUID()`, add it to the `ForwardJob` interface.
2. In `QueueProducer`: the job data already includes the ForwardJob fields, so correlationId passes through BullMQ automatically.
3. In `QueueConsumer` and `ForwarderService`: extract `correlationId` from job data and use `logger.child({ correlationId })` for all log calls within that job's processing.

**Alternatives considered**:
- AsyncLocalStorage for automatic propagation → rejected; the pipeline crosses a BullMQ queue boundary (serialize → deserialize), so async context doesn't propagate. Must be explicit in job data.
- Add correlationId to Redis dedup key → rejected; dedup already uses `channelId:messageId`, adding correlationId would break dedup logic.

## R4: LOG_LEVEL Configuration

**Decision**: Add `LOG_LEVEL` to both API and worker env config, defaulting to `info` in production and `debug` in development.

**Rationale**: Pino accepts a `level` option at initialization. The `nestjs-pino` `LoggerModule.forRoot` passes it through `pinoHttp.level`. Both apps already check `NODE_ENV` for transport selection; extending this to include level is straightforward.

**Approach**:
- API: Add `LOG_LEVEL` to `envSchema` (optional, with env-based default). Pass to `LoggerModule.forRoot({ pinoHttp: { level } })`.
- Worker: Add `LOG_LEVEL` to `loadConfig()`. Pass to `pino({ level })`.
- Valid values: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.

## R5: Bot Connection Status

**Decision**: Add an `isConnected()` method to the API's `BotService` that calls `api.getMe()` with a short timeout as a ping. For the worker, check `TelegramClient.connected` property from GramJS.

**Rationale**:
- The grammY `Api` object is send-only (no persistent connection), so there's no connection state to query. A lightweight `getMe()` call serves as a health ping.
- GramJS `TelegramClient` has a `.connected` boolean property that reflects the MTProto connection state.

**Approach**:
- API `BotService`: Add `async isHealthy(): Promise<boolean>` that calls `api.getMe()` in a try/catch with a 3s timeout. Return true on success, false on failure.
- Worker `ListenerService`: Add `isConnected(): boolean` that returns `this.client?.connected ?? false`.

## R6: Worker Health Endpoint — Bot Check

**Decision**: The worker needs access to both the grammY `Api` instance (for bot health) and the `ListenerService` (for userbot health). Pass these to the health server.

**Rationale**: Currently `startHealthServer` only receives queue instances. It needs additional dependencies for the comprehensive health check format.

**Approach**: Expand `startHealthServer` parameters to accept a health context object with: prisma, redis, listener, bot api, and queue instances. This keeps the function signature clean despite the growing number of dependencies.
