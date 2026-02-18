# Feature Specification: Structured Logging & Health Check Finalization

**Feature Branch**: `012-logging-health-check`
**Created**: 2026-02-18
**Status**: Draft
**Input**: User description: "Structured Logging & Health Check Finalization — Production-ready logging and comprehensive health monitoring."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comprehensive Health Monitoring (Priority: P1)

An operator queries the system's health endpoint to determine if all dependencies are functioning correctly. The response provides a clear overall status (`healthy`, `degraded`, or `unhealthy`) along with individual checks for each dependency — database, cache, message queue, userbot connection, and bot connection. This enables automated monitoring, load balancer integration, and quick incident triage.

**Why this priority**: Health monitoring is the foundation for production reliability. Without accurate health reporting, operators cannot detect or diagnose failures.

**Independent Test**: Can be fully tested by calling the health endpoint under different dependency states and verifying the response structure, status logic, and individual check results.

**Acceptance Scenarios**:

1. **Given** all dependencies are functioning, **When** the health endpoint is queried, **Then** the response status is `healthy`, uptime is reported in milliseconds, and each dependency check shows `up` or `connected` with latency where applicable.
2. **Given** the message queue's dead-letter queue has items (DLQ > 0), **When** the health endpoint is queried, **Then** the overall status is `degraded` and the queue check reflects the DLQ count.
3. **Given** the userbot (Telegram listener) is disconnected, **When** the health endpoint is queried, **Then** the overall status is `degraded` and the userbot check shows `disconnected`.
4. **Given** the database is unreachable, **When** the health endpoint is queried, **Then** the overall status is `unhealthy` and the database check shows `down`.
5. **Given** the cache (Redis) is unreachable, **When** the health endpoint is queried, **Then** the overall status is `unhealthy` and the cache check shows `down`.
6. **Given** both the userbot is disconnected and the DLQ has items, **When** the health endpoint is queried, **Then** the overall status is `degraded` (not `unhealthy`) since non-critical services are affected.
7. **Given** the database is unreachable AND the userbot is disconnected, **When** the health endpoint is queried, **Then** the overall status is `unhealthy` (the most severe status takes precedence).

---

### User Story 2 - Structured Logging with Sensitive Data Redaction (Priority: P2)

All system logs are emitted in structured JSON format with consistent fields: timestamp, severity level, service name, event type, and a correlation ID that traces a message's journey from ingestion through forwarding. Sensitive data — authentication tokens, session strings, and user credentials — is automatically redacted from all log output. Log verbosity is configurable per environment.

**Why this priority**: Structured logging is essential for production debugging and monitoring, but the system can technically operate without it. Health monitoring (P1) is more immediately critical for uptime.

**Independent Test**: Can be tested by triggering operations that produce logs and verifying the output format, field presence, correlation ID propagation, and absence of sensitive data.

**Acceptance Scenarios**:

1. **Given** a message is received by the listener and forwarded, **When** reviewing the logs, **Then** both the listener log entry and the forwarder log entry share the same correlation ID.
2. **Given** the system handles a request containing authentication tokens, **When** the log entry is emitted, **Then** token values, session strings, and credentials are replaced with a redaction placeholder (e.g., `[REDACTED]`).
3. **Given** the environment is configured for production, **When** the system starts, **Then** log verbosity defaults to `info` level and output is JSON.
4. **Given** the environment is configured for development, **When** the system starts, **Then** log verbosity defaults to `debug` level.
5. **Given** a `LOG_LEVEL` environment variable is set, **When** the system starts, **Then** the log level matches the configured value regardless of environment.

---

### User Story 3 - API Request Logging (Priority: P3)

Every HTTP request to the API is automatically logged with method, URL, response status code, and response time. This provides a complete audit trail for debugging and performance analysis without manual instrumentation in each endpoint.

**Why this priority**: Automatic request logging builds on the structured logging foundation (P2) and provides per-request visibility. It depends on P2 being in place.

**Independent Test**: Can be tested by making HTTP requests to the API and verifying that each request produces a log entry with the required fields.

**Acceptance Scenarios**:

1. **Given** a successful API request, **When** the request completes, **Then** a log entry is emitted with method, URL, status code (2xx), and duration.
2. **Given** a failed API request (4xx or 5xx), **When** the request completes, **Then** a log entry is emitted with the error status code and duration.
3. **Given** multiple concurrent requests, **When** reviewing the logs, **Then** each request's log entry is distinct and includes a unique request identifier.

---

### Edge Cases

- What happens when a health check dependency times out? The check should report `down` after a reasonable timeout rather than hanging indefinitely.
- What happens when the health endpoint itself fails (e.g., the check logic throws)? The endpoint should return `unhealthy` with whatever partial data is available, never a 500 error.
- What happens when a log message contains deeply nested objects with sensitive data? Redaction must cover all configured paths regardless of nesting depth.
- What happens when both the API and worker start simultaneously? Each should log independently with its own service identifier.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The health endpoint MUST return a JSON response with an overall status field (`healthy`, `degraded`, or `unhealthy`), an uptime value in milliseconds, and individual checks for each dependency.
- **FR-002**: The health endpoint MUST check database connectivity and report status (`up`/`down`) with latency in milliseconds.
- **FR-003**: The health endpoint MUST check cache (Redis) connectivity and report status (`up`/`down`) with latency in milliseconds.
- **FR-004**: The health endpoint MUST report the userbot (Telegram listener) connection status (`connected`/`disconnected`).
- **FR-005**: The health endpoint MUST report the bot connection status (`connected`/`disconnected`).
- **FR-006**: The health endpoint MUST report queue statistics: active jobs, waiting jobs, failed jobs, and dead-letter queue count.
- **FR-007**: The overall status MUST be `unhealthy` when the database or cache is down, `degraded` when the DLQ count is greater than zero or the userbot is disconnected, and `healthy` when all checks pass.
- **FR-008**: When multiple degradation conditions exist simultaneously, the most severe status MUST take precedence (`unhealthy` > `degraded` > `healthy`).
- **FR-009**: All log output MUST be structured JSON with fields: timestamp, level, service name, and event.
- **FR-010**: A correlation ID MUST be generated for each message entering the system and propagated through the entire processing pipeline (listener to forwarder).
- **FR-011**: Sensitive data (authentication tokens, session strings, credentials) MUST be automatically redacted from all log output.
- **FR-012**: Log verbosity MUST be configurable via a `LOG_LEVEL` environment variable, defaulting to `info` in production and `debug` in development.
- **FR-013**: The API MUST automatically log every HTTP request with method, URL, response status code, and duration in milliseconds.
- **FR-014**: Each health check MUST complete within a timeout threshold; timed-out checks MUST report as `down`.

### Key Entities

- **Health Response**: Represents the aggregated system health state — overall status, uptime, and a map of individual dependency checks.
- **Dependency Check**: Represents the health of a single dependency — status, latency (where applicable), and additional metrics (for queues).
- **Correlation ID**: A unique identifier generated per inbound message, propagated through all processing stages to enable end-to-end tracing in logs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Health endpoint responds within 5 seconds even when individual dependency checks time out.
- **SC-002**: 100% of HTTP requests to the API produce a structured log entry with method, URL, status, and duration.
- **SC-003**: 100% of configured sensitive data patterns are redacted from log output — no tokens, session strings, or credentials appear in logs.
- **SC-004**: Correlation IDs appear in 100% of log entries for the message processing pipeline, enabling end-to-end trace from ingestion to forwarding.
- **SC-005**: Operators can determine system health status (healthy/degraded/unhealthy) from a single endpoint call with no additional queries needed.
- **SC-006**: Log level can be changed via environment variable without code changes, taking effect on the next process start.

## Assumptions

- The worker app already uses pino for logging; this feature standardizes and enhances the existing setup.
- The API app already has a basic health endpoint; this feature replaces it with a comprehensive one.
- The worker health endpoint (used for container health checks) will also be updated to match the new response format.
- Both apps share the same JSON log format but run as separate processes with separate service identifiers.
- Health check timeout for each dependency defaults to 3 seconds.
- The bot status check uses a lightweight `getMe()` ping with a 3-second timeout. This is the minimal API call to verify bot token validity and connectivity.

## Scope Boundaries

**In Scope**:
- Structured JSON logging for both API and worker apps
- Sensitive data redaction configuration
- Correlation ID generation and propagation in the worker message pipeline
- Comprehensive health endpoint with dependency checks and status logic
- Environment-based log level configuration

**Out of Scope**:
- Log aggregation or shipping to external services (e.g., ELK, Datadog)
- Alerting based on health status
- Historical health data or health check history
- Distributed tracing across API and worker (correlation ID is worker-internal for the message pipeline)
- Log rotation or retention policies
