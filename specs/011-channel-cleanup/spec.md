# Feature Specification: Channel Cleanup Job

**Feature Branch**: `011-channel-cleanup`
**Created**: 2026-02-17
**Status**: Draft
**Input**: Automatically leave Telegram channels that no users reference anymore via a scheduled background job.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Orphaned Channel Cleanup (Priority: P1)

As a system operator, I want the platform to automatically leave Telegram source channels that are no longer referenced by any subscription list, so that the bot does not remain in channels unnecessarily and resources are freed.

The system runs a scheduled cleanup job once daily. It identifies source channels that are marked active but have had no subscription list references for 30 or more days. For each orphaned channel, the system instructs the bot to leave the channel and marks it as inactive. The job logs a summary of how many channels were cleaned up.

**Why this priority**: This is the core value of the feature — preventing resource waste and ensuring the bot only stays in channels that are actively used.

**Independent Test**: Can be fully tested by creating source channels with and without subscription list references, advancing time past the 30-day threshold, running the cleanup job, and verifying that only the orphaned channels are deactivated and left.

**Acceptance Scenarios**:

1. **Given** a source channel is active and has no subscription list references for 30+ days, **When** the cleanup job runs, **Then** the bot leaves the channel and the channel is marked inactive.
2. **Given** a source channel is active and still has at least one subscription list reference, **When** the cleanup job runs, **Then** the channel is not touched and remains active.
3. **Given** a source channel is active and lost its last reference fewer than 30 days ago, **When** the cleanup job runs, **Then** the channel is not touched and remains active (grace period).
4. **Given** there are no orphaned channels, **When** the cleanup job runs, **Then** the job completes successfully with zero channels cleaned, and no errors are logged.

---

### User Story 2 - Cleanup Observability (Priority: P2)

As a system operator, I want the cleanup job to produce structured logs summarizing each run, so that I can monitor cleanup activity and diagnose issues.

**Why this priority**: Observability is important for operations but the core cleanup logic delivers value even without detailed logging. This builds on US1.

**Independent Test**: Can be tested by running the cleanup job and verifying that structured log entries are produced with the count of channels left and any errors encountered.

**Acceptance Scenarios**:

1. **Given** the cleanup job runs and deactivates 3 channels, **When** the job completes, **Then** a summary log entry is produced indicating 3 channels were left.
2. **Given** the cleanup job runs but the bot fails to leave one channel, **When** the error occurs, **Then** the error is logged with the channel identifier, and the job continues processing remaining channels without aborting.

---

### Edge Cases

- What happens when the bot fails to leave a specific channel (e.g., network error, already removed)? The job logs the error and continues with the remaining channels. The channel remains marked active and will be retried on the next run.
- What happens when a channel has no subscription list references but was created fewer than 30 days ago? It is not cleaned up — the 30-day grace period is measured from when the last reference was removed, not from channel creation.
- What happens when a channel is already inactive? It is excluded from cleanup consideration entirely.
- What happens when a subscription list is deleted, removing the last reference to a channel? The 30-day grace period starts from the deletion timestamp. The channel is not immediately cleaned up.
- What happens if the cleanup job overlaps with a user adding a new subscription list reference to a channel? The reference check should use a point-in-time query. If the reference exists at query time, the channel is not cleaned.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST run a channel cleanup job on a daily schedule at a fixed time (3:00 AM UTC).
- **FR-002**: System MUST identify all active source channels that have had no subscription list references for 30 or more consecutive days.
- **FR-003**: For each orphaned channel, the system MUST instruct the bot to leave the Telegram channel.
- **FR-004**: For each orphaned channel, the system MUST mark the source channel as inactive after the bot successfully leaves.
- **FR-005**: The cleanup job MUST NOT deactivate channels that still have at least one active subscription list reference.
- **FR-006**: The cleanup job MUST NOT deactivate channels whose last reference was removed fewer than 30 days ago.
- **FR-007**: The cleanup job MUST continue processing remaining channels if leaving one channel fails, rather than aborting the entire run.
- **FR-008**: The cleanup job MUST produce a structured log entry upon completion summarizing the number of channels cleaned up.
- **FR-009**: The cleanup job MUST log individual errors when failing to leave or deactivate a specific channel.

### Non-Functional Requirements

- **NFR-001**: The cleanup job MUST complete within 10 minutes for up to 1,000 orphaned channels.
- **NFR-002**: The cleanup job MUST NOT interfere with normal message forwarding operations while running.
- **NFR-003**: All log entries MUST use structured logging consistent with the existing logging infrastructure.

### Key Entities

- **Source Channel**: A Telegram channel the bot monitors. Has an active/inactive status. Becomes a cleanup candidate when no subscription lists reference it for 30+ days.
- **Subscription List Channel**: The join record linking a subscription list to a source channel. Its presence (or absence) determines whether a source channel is referenced.

### Assumptions

- The existing `SourceChannel.updatedAt` or the `SubscriptionListChannel` deletion timestamp can be used to determine when the last reference was removed. If neither is sufficient, a `lastReferencedAt` field may be added to `SourceChannel` during planning.
- The bot's ability to leave a channel is provided by an existing or new service method (e.g., `ListenerService.leaveChannel`).
- The worker application already has infrastructure for scheduling recurring jobs (via BullMQ repeatable jobs or similar).
- The 30-day threshold is a business constant that does not need to be user-configurable in this iteration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Orphaned channels (no references for 30+ days) are automatically deactivated and left within 24 hours of becoming eligible.
- **SC-002**: Channels with active references are never incorrectly deactivated — zero false positives.
- **SC-003**: The cleanup job completes successfully even when there are zero orphaned channels to process.
- **SC-004**: Individual channel failures do not prevent the remaining channels from being processed — the job exhibits partial-failure resilience.
- **SC-005**: Each cleanup run produces a summary log with the count of channels processed, enabling operational monitoring.
