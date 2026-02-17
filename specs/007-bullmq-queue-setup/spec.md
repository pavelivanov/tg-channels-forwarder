# Feature Specification: BullMQ Queue Setup

**Feature Branch**: `007-bullmq-queue-setup`
**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "BullMQ Queue Setup — Message queue infrastructure between listener and forwarder."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enqueue and Process Forward Jobs (Priority: P1)

When a Telegram listener receives a new message from a source channel, it must place a forwarding job into a queue. A consumer picks the job off the queue, processes it (logging the payload for now; actual forwarding logic is deferred to a later feature), and marks it complete. This decouples message reception from message forwarding, ensuring reliable delivery even under load or transient failures.

**Why this priority**: This is the core value — without reliable enqueue/dequeue, no message forwarding can happen. It is the foundation for all downstream features.

**Independent Test**: Enqueue a job with a valid payload, verify the consumer picks it up and logs the payload within a reasonable time frame.

**Acceptance Scenarios**:

1. **Given** the queue system is running, **When** a forwarding job is enqueued with a valid payload, **Then** the consumer receives the job and logs the payload to the application log.
2. **Given** the queue system is running, **When** multiple jobs are enqueued in rapid succession, **Then** all jobs are consumed in order and each is logged.
3. **Given** the queue system is running, **When** a job is successfully processed, **Then** it is removed from the active queue (retained in completed history up to a configured limit).

---

### User Story 2 - Retry Failed Jobs with Dead Letter Queue (Priority: P1)

When a job fails during processing, the system must automatically retry it with increasing delays. After exhausting all retry attempts, the failed job must be moved to a dead letter queue for manual inspection. This prevents transient errors from permanently dropping messages while isolating persistently failing jobs.

**Why this priority**: Reliability is critical — without retries and DLQ, any transient failure means lost messages. This is equally important to the happy path.

**Independent Test**: Enqueue a job that always fails, verify it retries the configured number of times with increasing delays, then confirm it appears in the dead letter queue.

**Acceptance Scenarios**:

1. **Given** a job that fails on first processing attempt, **When** the job is retried, **Then** it is retried up to 3 times total with exponentially increasing delays.
2. **Given** a job that fails all 3 retry attempts, **When** the final attempt fails, **Then** the job is moved to a dedicated dead letter queue.
3. **Given** a job in the dead letter queue, **When** an operator inspects the DLQ, **Then** the full job payload and failure reason are available.

---

### User Story 3 - Health Check Reports Queue Statistics (Priority: P2)

The system's health endpoint must include queue statistics — active jobs, waiting jobs, failed jobs, and dead letter queue depth — so that operators can monitor queue health alongside existing database and Redis indicators.

**Why this priority**: Observability is important for production readiness but not required for basic message flow to work.

**Independent Test**: Hit the health endpoint and verify the response includes queue statistics with numeric values for each metric.

**Acceptance Scenarios**:

1. **Given** the system is running with an empty queue, **When** the health endpoint is called, **Then** the response includes queue statistics showing zero for all counters.
2. **Given** the system has jobs in various states (active, waiting, failed, in DLQ), **When** the health endpoint is called, **Then** the response accurately reflects the count of jobs in each state.

---

### User Story 4 - Queue Management Dashboard (Priority: P3)

Developers need a visual dashboard accessible at a known route to inspect queue state, view individual jobs, retry failed jobs, and drain queues during development and debugging. This is a development-only convenience tool.

**Why this priority**: Useful for debugging but not required for production message flow. Can be deferred or omitted without impacting core functionality.

**Independent Test**: Navigate to the dashboard route in a browser and verify it displays queue information with job details.

**Acceptance Scenarios**:

1. **Given** the system is running in development mode, **When** a developer navigates to the queue dashboard route, **Then** the dashboard displays current queue state with job counts and individual job details.
2. **Given** there are failed jobs in the queue, **When** a developer views the dashboard, **Then** they can see the failure reason and job payload for each failed job.

---

### Edge Cases

- What happens when the queue's backing store is unavailable at startup? The system should fail fast with a clear error message rather than silently dropping jobs.
- What happens when a job payload exceeds reasonable size limits? Jobs should be validated before enqueue; oversized payloads should be rejected.
- What happens when the consumer crashes mid-processing? The job should remain in the queue and be picked up again after the configured visibility timeout.
- What happens when the dead letter queue grows unbounded? Completed and failed job retention limits prevent unbounded growth.
- What happens when a media group message arrives as multiple jobs? Each message in a media group is a separate job; grouping logic is out of scope for this feature (deferred to a later spec).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a queue named `message-forward` for forwarding jobs.
- **FR-002**: System MUST provide a producer service that accepts a forwarding job payload and places it on the queue.
- **FR-003**: System MUST provide a consumer service that picks jobs from the queue and processes them (logging the payload for now).
- **FR-004**: System MUST define a shared job payload structure containing: message identifier, source channel identifier, optional text, optional caption, optional media type, optional media file identifier, optional media group identifier, optional media group array, and timestamp.
- **FR-005**: System MUST configure jobs with 3 retry attempts using exponential backoff starting at 5 seconds.
- **FR-006**: System MUST retain up to 1,000 completed jobs and up to 5,000 failed jobs in history.
- **FR-007**: System MUST move jobs to a dead letter queue named `message-forward-dlq` after all retry attempts are exhausted.
- **FR-008**: System MUST report queue statistics (active, waiting, failed, dead letter queue depth) in the worker health endpoint response.
- **FR-009**: System SHOULD provide a visual queue management dashboard accessible at a known route for development debugging.
- **FR-010**: System MUST handle queue backing store unavailability gracefully — fail fast at startup with a clear error, and log warnings for transient errors during operation.

### Key Entities

- **ForwardJob**: The unit of work placed on the queue. Contains all information needed to forward a message: message identity, source channel, text/media content references, and a timestamp.
- **Queue (message-forward)**: The primary work queue where forwarding jobs are placed by the producer and consumed by the consumer.
- **Dead Letter Queue (message-forward-dlq)**: A holding area for jobs that have exhausted all retry attempts, preserved for operator inspection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A forwarding job enqueued by the producer is consumed and logged by the consumer within 5 seconds under normal conditions.
- **SC-002**: A job that fails all 3 retry attempts appears in the dead letter queue within 60 seconds of initial failure (accounting for exponential backoff delays).
- **SC-003**: The health endpoint returns accurate queue statistics reflecting the actual state of active, waiting, failed, and dead letter queue jobs.
- **SC-004**: The system retains no more than 1,000 completed jobs and 5,000 failed jobs, preventing unbounded history growth.
- **SC-005**: Queue infrastructure supports processing at least 100 jobs per second without backlog accumulation under normal load.

## Assumptions

- Redis (already provisioned via Docker Compose) serves as the backing store for the queue — no additional infrastructure is needed.
- The `REDIS_URL` environment variable is already available in both apps (api and worker) from feature 006.
- The consumer's processing logic for this feature is limited to logging; actual message forwarding is deferred to a subsequent feature (Spec 09).
- Media group handling (correlating multiple media items into a single forward) is out of scope — each message is an independent job.
- The queue dashboard (US4) is optional and intended for development use only; it does not need authentication or production hardening.
- Job payload validation is lightweight — the producer trusts the caller (internal service) to provide well-formed data.
