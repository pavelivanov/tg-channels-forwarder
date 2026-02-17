# Feature Specification: Redis Connection & Deduplication Service

**Feature Branch**: `006-redis-dedup-service`
**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "Implement the deduplication logic as a standalone service backed by Redis"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Detect and Prevent Duplicate Forwarding (Priority: P1)

When the system processes a message for forwarding to a destination channel, it checks whether a substantially similar message has already been forwarded to that same destination within the last 72 hours. If a duplicate is found, the message is skipped. If no duplicate exists, the message is forwarded and recorded.

**Why this priority**: Core purpose of the feature — without dedup, users receive repeated content across overlapping source channels.

**Independent Test**: Can be fully tested by sending the same normalized text to the same destination twice and verifying the second attempt is flagged as duplicate.

**Acceptance Scenarios**:

1. **Given** a message with text "Hello World!" targeting destination 12345, **When** the system checks for duplicates for the first time, **Then** it returns "not duplicate" (false).
2. **Given** the same message was previously forwarded to destination 12345, **When** the system checks the same text for destination 12345 again, **Then** it returns "duplicate" (true).
3. **Given** a message was forwarded to destination 12345, **When** the same text is checked for destination 67890, **Then** it returns "not duplicate" (false) — dedup is per-destination.
4. **Given** a message "HELLO world!" was forwarded to destination 12345, **When** "hello World" is checked for the same destination, **Then** it returns "duplicate" (true) — normalization handles case differences.

---

### User Story 2 - Skip Dedup for Empty Messages (Priority: P2)

Messages with empty or null text (e.g., media-only messages) always bypass deduplication and are treated as non-duplicate, ensuring they are always forwarded.

**Why this priority**: Prevents media-only messages from being incorrectly blocked. Important for user experience but secondary to core dedup.

**Independent Test**: Can be tested by checking isDuplicate with empty, null, or whitespace-only text and verifying it always returns false.

**Acceptance Scenarios**:

1. **Given** a message with empty text (""), **When** dedup is checked, **Then** it returns "not duplicate" (false).
2. **Given** a message with only whitespace ("   "), **When** dedup is checked, **Then** it returns "not duplicate" (false).
3. **Given** a message with only punctuation ("...!!!"), **When** dedup is checked after normalization produces empty result, **Then** it returns "not duplicate" (false).

---

### User Story 3 - Automatic Expiry of Dedup Records (Priority: P2)

Deduplication records automatically expire after 72 hours, allowing the same content to be forwarded again if it resurfaces after the expiry window.

**Why this priority**: Ensures the dedup store doesn't grow unbounded and allows legitimate re-forwarding of recurring content.

**Independent Test**: Can be tested by verifying that dedup records are stored with a 72-hour TTL.

**Acceptance Scenarios**:

1. **Given** a message was marked as forwarded, **When** the record is inspected, **Then** it has a TTL of 72 hours (259,200 seconds).
2. **Given** a message was forwarded more than 72 hours ago, **When** the same text is checked, **Then** it returns "not duplicate" (false).

---

### User Story 4 - API Health Check Includes Redis (Priority: P3)

The API health endpoint reports Redis connectivity status alongside existing checks (database, memory), allowing operators to monitor all critical dependencies from a single endpoint.

**Why this priority**: Operational visibility — important for production readiness but not core feature logic.

**Independent Test**: Can be tested by hitting the health endpoint and verifying Redis status appears in the response.

**Acceptance Scenarios**:

1. **Given** Redis is running, **When** the health endpoint is called, **Then** the response includes a "redis" indicator with status "up".
2. **Given** Redis is unreachable, **When** the health endpoint is called, **Then** the response includes a "redis" indicator with status "down" and the overall status reflects the degradation.

---

### Edge Cases

- What happens when the same message is checked concurrently by multiple workers? Redis SET operations are atomic, so the first writer wins and subsequent checks see the duplicate.
- What happens when Redis is temporarily unavailable during a dedup check? The service treats connectivity failures as "not duplicate" (fail-open) to avoid blocking message forwarding.
- What happens when text contains only unicode emoji or special characters? Normalization strips punctuation but preserves word characters; emoji-only text after normalization becomes empty and bypasses dedup.
- What happens when text is extremely long? Only the first 10 words (after normalization) are used for hashing, so long messages are compared by their opening content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `normalizeText` function that lowercases input, strips punctuation, collapses whitespace, and takes only the first 10 words.
- **FR-002**: System MUST provide a `computeHash` function that returns a SHA-256 hex digest of the normalized text.
- **FR-003**: System MUST provide an `isDuplicate` function that checks whether a dedup record exists for a given destination channel ID and text hash.
- **FR-004**: System MUST provide a `markAsForwarded` function that stores a dedup record with a 72-hour TTL (259,200 seconds).
- **FR-005**: The dedup key format MUST be `dedup:{destinationChannelId}:{hash}` to ensure per-destination uniqueness.
- **FR-006**: `isDuplicate` MUST return false for messages where text is empty or produces an empty string after normalization (callers MUST pass a string; null/undefined is not accepted).
- **FR-007**: `computeHash` MUST be deterministic — identical normalized input always produces identical output.
- **FR-008**: The API health endpoint MUST include a Redis connectivity check alongside existing database and memory checks.
- **FR-009**: Both the API application and the worker application MUST be able to connect to Redis using a shared connection configuration.
- **FR-010**: The system MUST fail-open when Redis is unavailable during dedup checks — `isDuplicate` returns false if Redis cannot be reached.

### Key Entities

- **Dedup Record**: A time-limited record keyed by destination channel and content hash. Represents a previously forwarded message for a specific destination. Expires automatically after 72 hours.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Duplicate text sent to the same destination within 72 hours is correctly detected 100% of the time when the data store is available.
- **SC-002**: Identical text sent to different destinations is never incorrectly flagged as duplicate.
- **SC-003**: Messages with no meaningful text content (empty, null, whitespace-only) are always forwarded without dedup blocking.
- **SC-004**: Dedup records expire automatically after 72 hours without manual cleanup.
- **SC-005**: The health endpoint reports connectivity status of all critical dependencies including the dedup data store.
- **SC-006**: Text normalization is consistent — the same logical content always produces the same fingerprint regardless of casing, punctuation, or extra whitespace.
