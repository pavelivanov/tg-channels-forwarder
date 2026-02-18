# Data Model: Structured Logging & Health Check Finalization

**Date**: 2026-02-18
**Feature**: 012-logging-health-check

## Overview

This feature does not introduce new database entities. All changes are to runtime interfaces and log structures.

## Runtime Interfaces

### HealthResponse

The unified health endpoint response returned by both API and worker.

| Field        | Type                          | Description                          |
|-------------|-------------------------------|--------------------------------------|
| status      | `healthy` / `degraded` / `unhealthy` | Overall system status                |
| uptime      | number (ms)                   | Process uptime in milliseconds       |
| checks      | ChecksMap                     | Individual dependency check results  |

### ChecksMap

| Field    | Type              | Description                              |
|---------|-------------------|------------------------------------------|
| postgres | ServiceCheck      | Database connectivity                    |
| redis    | ServiceCheck      | Cache/queue connectivity                 |
| userbot  | ConnectionCheck   | Telegram MTProto listener status         |
| bot      | ConnectionCheck   | Telegram Bot API status                  |
| queue    | QueueCheck        | Message queue statistics                 |

### ServiceCheck

| Field     | Type           | Description                            |
|----------|----------------|----------------------------------------|
| status   | `up` / `down`  | Whether the service is reachable       |
| latencyMs | number         | Ping latency in milliseconds           |

### ConnectionCheck

| Field   | Type                           | Description                  |
|--------|--------------------------------|------------------------------|
| status | `connected` / `disconnected`   | Connection state             |

### QueueCheck

| Field   | Type   | Description                            |
|--------|--------|----------------------------------------|
| active  | number | Currently processing jobs              |
| waiting | number | Jobs waiting to be processed           |
| failed  | number | Jobs that failed processing            |
| dlq     | number | Jobs in the dead-letter queue          |

### Status Logic

```
if (postgres.status === 'down' || redis.status === 'down') → unhealthy
else if (queue.dlq > 0 || userbot.status === 'disconnected') → degraded
else → healthy
```

Severity precedence: `unhealthy` > `degraded` > `healthy`.

## ForwardJob Extension

The existing `ForwardJob` interface in `@aggregator/shared` gains a new field:

| Field         | Type   | Description                                      |
|--------------|--------|--------------------------------------------------|
| correlationId | string | UUID generated per inbound message for log tracing |

## Log Entry Structure

All log entries follow this base structure (pino default + custom fields):

| Field         | Type   | Source              | Description                           |
|--------------|--------|---------------------|---------------------------------------|
| level         | number | pino                | Log level (30=info, 40=warn, 50=error)|
| time          | number | pino                | Unix epoch milliseconds               |
| pid           | number | pino                | Process ID                            |
| hostname      | string | pino                | Machine hostname                      |
| service       | string | logger.child()      | Service name (e.g., `ListenerService`)|
| msg           | string | pino                | Human-readable message                |
| correlationId | string | logger.child()      | Message pipeline trace ID (worker)    |

### Redacted Paths

Values at these paths are replaced with `[Redacted]`:

- `req.headers.authorization`
- `req.headers["x-api-key"]`
- `*.password`, `*.token`, `*.secret`
- `botToken`, `sessionString`
- `config.BOT_TOKEN`, `config.TELEGRAM_SESSION`, `config.JWT_SECRET`
