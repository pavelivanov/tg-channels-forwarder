# Contract: Structured Logging

**Feature**: 012-logging-health-check

## Log Format

All log output is structured JSON. Each line is a single JSON object.

### Base Fields (all log entries)

| Field    | Type   | Description                         |
|---------|--------|-------------------------------------|
| level    | number | Pino log level (10-60)              |
| time     | number | Unix epoch milliseconds             |
| pid      | number | Process ID                          |
| hostname | string | Machine hostname                    |
| msg      | string | Human-readable message              |

### Service Context (via child loggers)

| Field   | Type   | Description                          |
|--------|--------|--------------------------------------|
| service | string | Service name (e.g., `ListenerService`) |

### Correlation ID (worker message pipeline only)

| Field         | Type   | Description                                |
|--------------|--------|--------------------------------------------|
| correlationId | string | UUID tracing a message from listener to forwarder |

### API Request Logs (automatic via nestjs-pino / pino-http)

| Field  | Type   | Description                         |
|-------|--------|-------------------------------------|
| req    | object | Request details (method, url, id)   |
| res    | object | Response details (statusCode)       |
| responseTime | number | Duration in milliseconds      |

## Redaction

Pino `redact` option with paths:

```javascript
[
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  '*.password',
  '*.token',
  '*.secret',
  'botToken',
  'sessionString',
  'config.BOT_TOKEN',
  'config.TELEGRAM_SESSION',
  'config.JWT_SECRET',
]
```

Redacted values are replaced with `[Redacted]`.

## Log Level Configuration

| Environment | Default Level | Override             |
|------------|---------------|----------------------|
| production  | `info`        | `LOG_LEVEL` env var  |
| development | `debug`       | `LOG_LEVEL` env var  |
| test        | `warn`        | `LOG_LEVEL` env var  |

Valid values: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.

## Correlation ID Flow

```
ListenerService.handleNewMessage()
  → generates correlationId (crypto.randomUUID())
  → attaches to ForwardJob

QueueProducer.enqueueMessage(job)
  → job.data includes correlationId
  → passes through BullMQ

QueueConsumer.processJob(job)
  → extracts correlationId from job.data
  → creates child logger: logger.child({ correlationId })

ForwarderService.forward(job)
  → receives correlationId in job data
  → uses child logger with correlationId
```
