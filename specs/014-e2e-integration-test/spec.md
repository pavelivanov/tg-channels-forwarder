# Feature Specification: End-to-End Integration Test

**Feature Branch**: `014-e2e-integration-test`
**Created**: 2026-02-18
**Status**: Draft
**Input**: User description: "End-to-End Integration Test — verify the complete message flow from source channel to destination channel."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Forward Pipeline Integration Test (Priority: P1)

A developer wants to verify that the core forwarding pipeline works end-to-end: when a message job is placed on the queue, it passes through dedup checking, rate limiting, and the bot API to arrive at the correct destination channel. This is the foundational confidence test for the entire system.

**Why this priority**: The forward pipeline is the core value proposition of the system. If a message placed on the queue does not arrive at the destination, nothing else matters. This must work before any other scenario can be validated.

**Independent Test**: Can be fully tested by pushing a single ForwardJob onto the BullMQ queue and asserting the bot API was called with the correct destination and message content. Delivers confidence that the core pipeline is functional.

**Acceptance Scenarios**:

1. **Given** a user exists with an active subscription list containing one source channel and one destination channel, **When** a ForwardJob for that source channel is pushed to the queue, **Then** the message sender calls the bot API to send the message to the destination channel.
2. **Given** the same message (identical normalized text) has already been forwarded to a destination, **When** the same ForwardJob is pushed to the queue again, **Then** the dedup service detects the duplicate and the message is NOT forwarded a second time.
3. **Given** a different message (different text content) is pushed after the duplicate, **When** the ForwardJob is processed, **Then** the new message IS forwarded to the destination channel.
4. **Given** the bot API call fails on the first attempt, **When** the job is retried (up to the configured max attempts), **Then** the retry mechanism re-processes the job. If all retries fail, the job is written to the dead letter queue.

---

### User Story 2 - Multi-Destination Forwarding Test (Priority: P2)

A developer wants to verify that when a single source channel message matches multiple subscription lists with different destination channels, the message is forwarded to ALL matching destinations independently.

**Why this priority**: Multi-destination is a key differentiator — users expect one source channel to feed multiple curated lists. This test builds on the P1 pipeline and verifies the fan-out logic.

**Independent Test**: Can be tested by creating two subscription lists that share the same source channel but point to different destination channels, pushing one ForwardJob, and asserting the bot API is called twice (once per destination).

**Acceptance Scenarios**:

1. **Given** two active subscription lists both containing the same source channel but targeting different destination channels, **When** a ForwardJob for that source channel is pushed to the queue, **Then** the message is forwarded to both destination channels.
2. **Given** the message has already been forwarded to destination A but not destination B, **When** the same ForwardJob is processed, **Then** the message is skipped for destination A (dedup) but forwarded to destination B.

---

### User Story 3 - Manual Testing Documentation (Priority: P3)

A developer or QA engineer wants a step-by-step guide to manually verify the full message flow using real Telegram channels, so they can validate the system in a production-like environment before deploying.

**Why this priority**: Automated tests use mocks for the bot API. Manual testing with real Telegram channels provides the final layer of confidence that the system works with actual Telegram infrastructure.

**Independent Test**: Can be validated by following the documented steps with real Telegram bot credentials and channels, and observing messages appear in the destination channel.

**Acceptance Scenarios**:

1. **Given** the manual testing guide exists, **When** a developer follows the documented steps with valid bot credentials and test channels, **Then** they can observe a message forwarded from a source channel to a destination channel via Telegram.
2. **Given** the manual testing guide exists, **When** a developer follows the dedup verification steps, **Then** they can confirm that sending the same message twice results in only one forwarded message.

---

### Edge Cases

- What happens when the source channel has no matching subscription lists (no active lists reference it)? The forwarder should log "no destinations" and skip without error.
- What happens when Redis is unavailable during dedup check? The system fails open (assumes message is not a duplicate) and forwards the message.
- What happens when the destination channel ID is invalid or the bot lacks permission? The bot API call fails, the job retries up to max attempts, then lands in the dead letter queue.
- What happens when a media message (photo/video) is forwarded? The message sender dispatches to the correct media-specific send method based on mediaType.
- What happens when an album (mediaGroup) is forwarded? The message sender calls sendMediaGroup with the grouped items, only the first item retains the caption.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The integration test suite MUST verify that a ForwardJob placed on the BullMQ queue is processed and results in a bot API call to the correct destination channel.
- **FR-002**: The integration test suite MUST verify that duplicate messages (same normalized text, same destination) are detected by the dedup service and not forwarded twice.
- **FR-003**: The integration test suite MUST verify that a new (non-duplicate) message IS forwarded after a duplicate is rejected.
- **FR-004**: The integration test suite MUST verify that a single source channel message is forwarded to multiple destination channels when matched by multiple subscription lists.
- **FR-005**: The integration test suite MUST verify per-destination dedup independence — a message already forwarded to destination A can still be forwarded to destination B.
- **FR-006**: The integration test suite MUST set up test data (user, source channels, subscription lists) via direct database operations or test fixtures, not through the HTTP API layer.
- **FR-007**: The integration test suite MUST use a mock or spy for the bot API (grammY) so that no real Telegram API calls are made during automated testing.
- **FR-008**: The integration test suite MUST use a real Redis instance for dedup checks to validate the actual dedup logic (hash computation, key storage, TTL).
- **FR-009**: The integration test suite MUST use a real BullMQ queue backed by Redis to validate the actual queue processing pipeline.
- **FR-010**: A manual testing guide MUST document step-by-step instructions for verifying the forwarding flow with real Telegram channels, including prerequisites, setup, execution, and expected observations.

### Key Entities

- **ForwardJob**: The message payload placed on the queue — contains messageId, sourceChannelId, text/caption, media metadata, timestamp, and correlationId.
- **SubscriptionList**: Links source channels to a destination channel. Must be active to trigger forwarding.
- **SourceChannel**: A Telegram channel being monitored. Referenced by sourceChannelId in ForwardJob.
- **DedupEntry**: A Redis key (`dedup:{destId}:{hash}`) with 72-hour TTL that tracks already-forwarded messages.
- **Dead Letter Queue (DLQ)**: A secondary queue that captures jobs that have exhausted all retry attempts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All automated integration tests pass consistently (100% pass rate on repeated runs) without relying on external Telegram API calls.
- **SC-002**: The forward pipeline test verifies end-to-end flow (queue → dedup → send) in under 10 seconds per test case.
- **SC-003**: The dedup test proves that identical messages are not forwarded twice, with zero false negatives (every duplicate is caught).
- **SC-004**: The multi-destination test confirms that N matching subscription lists result in exactly N bot API calls (one per destination).
- **SC-005**: The manual testing guide enables a developer unfamiliar with the project to complete a full manual verification within 30 minutes, with no steps requiring prior project knowledge beyond what is documented.

## Assumptions

- The test environment has access to a running Redis instance (via Docker Compose, already provisioned in the monorepo).
- The test environment has access to a running PostgreSQL instance (via Docker Compose, already provisioned).
- The grammY bot API will be mocked/spied in automated tests — no real Telegram bot token is needed for CI.
- The manual testing guide assumes the developer has a Telegram bot token and test channels already created.
- BullMQ queue processing in tests will use the real Worker with a real Redis-backed queue, not an in-memory mock.
