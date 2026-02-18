# Contract: Health Endpoint

**Feature**: 012-logging-health-check

## API Health Endpoint

### GET /health

Returns the comprehensive health status of the API service and its dependencies.

**Authentication**: Public (no auth required)

**Response** (200 — always returns 200, status field indicates health):

```json
{
  "status": "healthy",
  "uptime": 123456,
  "checks": {
    "postgres": { "status": "up", "latencyMs": 2 },
    "redis": { "status": "up", "latencyMs": 1 },
    "bot": { "status": "connected" },
    "queue": { "active": 0, "waiting": 0, "failed": 0, "dlq": 0 }
  }
}
```

**Note**: The API does not have a `userbot` check — that is worker-only. The API does have a `queue` check if it has visibility into the forwarding queue via Redis.

### Degraded example:

```json
{
  "status": "degraded",
  "uptime": 456789,
  "checks": {
    "postgres": { "status": "up", "latencyMs": 3 },
    "redis": { "status": "up", "latencyMs": 1 },
    "bot": { "status": "disconnected" },
    "queue": { "active": 5, "waiting": 20, "failed": 2, "dlq": 3 }
  }
}
```

### Unhealthy example:

```json
{
  "status": "unhealthy",
  "uptime": 789012,
  "checks": {
    "postgres": { "status": "down", "latencyMs": 3000 },
    "redis": { "status": "up", "latencyMs": 1 },
    "bot": { "status": "connected" },
    "queue": { "active": 0, "waiting": 0, "failed": 0, "dlq": 0 }
  }
}
```

## Worker Health Endpoint

### GET / (worker health port)

Returns the comprehensive health status of the worker service and its dependencies.

**Response** (200):

```json
{
  "status": "healthy",
  "uptime": 123456,
  "checks": {
    "postgres": { "status": "up", "latencyMs": 1 },
    "redis": { "status": "up", "latencyMs": 1 },
    "userbot": { "status": "connected" },
    "bot": { "status": "connected" },
    "queue": { "active": 3, "waiting": 12, "failed": 0, "dlq": 0 }
  }
}
```

## Status Logic

| Condition | Result |
|-----------|--------|
| postgres `down` OR redis `down` | `unhealthy` |
| queue.dlq > 0 OR userbot `disconnected` | `degraded` |
| All checks pass | `healthy` |
| Multiple conditions | Most severe wins (`unhealthy` > `degraded` > `healthy`) |

## Health Check Timeouts

Each individual check has a 3-second timeout. If a check times out, it reports as `down` with `latencyMs` equal to the timeout value.
