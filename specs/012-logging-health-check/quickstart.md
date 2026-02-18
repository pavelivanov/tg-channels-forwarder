# Quickstart: Structured Logging & Health Check Finalization

**Feature**: 012-logging-health-check

## Integration Scenarios

### Scenario 1: All-Healthy Health Check

```bash
# API health endpoint
curl http://localhost:3000/health
# Expected: { "status": "healthy", "uptime": ..., "checks": { postgres: up, redis: up, bot: connected, queue: all zeros } }

# Worker health endpoint
curl http://localhost:3001/
# Expected: { "status": "healthy", "uptime": ..., "checks": { postgres: up, redis: up, userbot: connected, bot: connected, queue: ... } }
```

### Scenario 2: Degraded Health (DLQ has items)

```bash
# Simulate: add a job to the DLQ manually or let a job fail max retries
curl http://localhost:3001/
# Expected: { "status": "degraded", "checks": { ..., queue: { dlq: >0 } } }
```

### Scenario 3: Unhealthy (Database down)

```bash
# Stop PostgreSQL
docker compose stop postgres

curl http://localhost:3000/health
# Expected: { "status": "unhealthy", "checks": { postgres: { "status": "down", "latencyMs": 3000 } } }

# Restart
docker compose start postgres
```

### Scenario 4: Structured Log Verification

```bash
# Start worker in production mode
NODE_ENV=production pnpm --filter @aggregator/worker dev

# Observe JSON output — each line is a valid JSON object
# Fields: level, time, pid, hostname, msg, service

# Override log level
LOG_LEVEL=debug NODE_ENV=production pnpm --filter @aggregator/worker dev
# Debug-level entries now visible
```

### Scenario 5: Redaction Verification

```bash
# Start API and make a request with JWT
curl -H "Authorization: Bearer eyJ..." http://localhost:3000/health

# Check API logs — authorization header should show [Redacted]
# grep for "authorization" in log output — value must be [Redacted]
```

### Scenario 6: Correlation ID Tracing

```bash
# Send a message to a monitored Telegram channel
# Check worker logs for the message pipeline:
#   1. ListenerService log: message_received + correlationId
#   2. QueueProducer log: job_enqueued + correlationId (same UUID)
#   3. ForwarderService log: message_forwarded + correlationId (same UUID)
# All three entries share the same correlationId value
```

## Configuration

### Environment Variables

| Variable   | Required | Default                    | Description                |
|-----------|----------|----------------------------|----------------------------|
| LOG_LEVEL  | No       | `info` (prod) / `debug` (dev) | Log verbosity level        |
| NODE_ENV   | No       | `development`              | Environment (affects defaults) |

### Existing Variables (unchanged)

- `DATABASE_URL` — PostgreSQL connection
- `REDIS_URL` — Redis connection
- `BOT_TOKEN` — Telegram Bot API token (will be redacted from logs)
- `TELEGRAM_SESSION` — MTProto session (will be redacted from logs)
- `JWT_SECRET` — JWT signing secret (will be redacted from logs)
