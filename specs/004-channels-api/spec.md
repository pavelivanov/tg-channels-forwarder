# Feature Specification: Source Channel Management API

**Feature Branch**: `004-channels-api`
**Created**: 2026-02-16
**Status**: Draft
**Input**: User description: "Source Channel Management API — browse available channels and request new channel subscriptions"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Active Channels (Priority: P1)

An authenticated user wants to see all currently active source channels so they can decide which channels to include in their subscription lists.

**Why this priority**: Browsing channels is the foundational read operation that every user needs. Without a channel list, users cannot discover or select channels for their subscriptions.

**Independent Test**: Can be fully tested by authenticating and requesting the channel list. Returns seeded active channels ordered alphabetically by title.

**Acceptance Scenarios**:

1. **Given** an authenticated user and several active channels in the system, **When** the user requests the channel list, **Then** the system returns all active channels ordered by title, each including id, telegramId, username, title, and subscribedAt.
2. **Given** an authenticated user and a mix of active and inactive channels, **When** the user requests the channel list, **Then** only active channels are returned.
3. **Given** an authenticated user and no active channels exist, **When** the user requests the channel list, **Then** the system returns an empty list.
4. **Given** an unauthenticated request, **When** the channel list is requested, **Then** the system returns a 401 unauthorized error.

---

### User Story 2 - Request a New Channel Subscription (Priority: P1)

An authenticated user wants to submit a channel username to request that the system start tracking it. If the channel is already active, the system returns it immediately. If not, the system creates a pending record for later processing by the userbot.

**Why this priority**: Adding new channels is a core write operation. Without it, the system can only serve pre-seeded channels and users cannot grow the channel catalog.

**Independent Test**: Can be tested by submitting a channel username and verifying either an existing active channel is returned or a new pending record is created.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** the user submits a valid username for a channel not yet in the system, **Then** the system creates a new channel record in a pending (inactive) state and returns it with a status indicator.
2. **Given** an authenticated user and an already active channel with the submitted username, **When** the user submits that username, **Then** the system returns the existing active channel immediately without creating a duplicate.
3. **Given** an authenticated user, **When** the user submits an invalid username (wrong format, too short, too long, or containing special characters), **Then** the system returns a 400 error with a clear message about the format requirements.
4. **Given** an authenticated user, **When** the user submits a username for a channel that exists but is inactive (pending), **Then** the system returns the existing pending record without creating a duplicate.

---

### User Story 3 - Consistent Error Responses (Priority: P2)

All error responses from the system follow a uniform structure so that client applications can reliably parse and display errors without special-casing different endpoints.

**Why this priority**: While not a user-facing feature itself, standardized errors improve developer experience and reduce client-side complexity. It supports all other user stories.

**Independent Test**: Can be tested by triggering various error conditions (validation errors, unauthorized access, not found) and verifying all responses share the same structure.

**Acceptance Scenarios**:

1. **Given** any request that triggers a validation error, **When** the error is returned, **Then** the response body contains statusCode, error, and message fields.
2. **Given** any request that triggers an authentication error, **When** the error is returned, **Then** the response body follows the same structure.
3. **Given** any request that triggers a server error, **When** the error is returned, **Then** the response body follows the same structure without leaking internal details.

---

### Edge Cases

- What happens when a user submits a username with leading/trailing whitespace? The system trims whitespace before validation.
- What happens when a user submits an empty string as a username? The system returns a 400 validation error.
- What happens when a user submits a username with an @ prefix? The system returns a 400 error (only the name without @ is accepted).
- What happens when two users simultaneously submit the same new username? The system handles the race condition gracefully — one creates the record, the other returns the existing pending record.
- What happens when a previously active channel becomes inactive and a user submits its username again? The system returns the existing inactive record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST return a list of all active channels ordered alphabetically by title when an authenticated user requests it.
- **FR-002**: Each channel in the list MUST include: id, telegramId, username, title, subscribedAt, and isActive.
- **FR-003**: System MUST accept a channel username submission from an authenticated user and validate its format (alphanumeric characters and underscores only, 5-32 characters in length).
- **FR-004**: System MUST return the existing active channel immediately when a submitted username matches an already-active channel (idempotent behavior).
- **FR-005**: System MUST create a new channel record in a pending (inactive) state when a submitted username does not match any existing channel, and return it with a status indicator.
- **FR-006**: System MUST return a 400 error with a descriptive message when the submitted username fails format validation.
- **FR-007**: All error responses across the system MUST follow a consistent structure containing statusCode, error type, and a human-readable message.
- **FR-008**: Channel list and channel submission endpoints MUST require authentication; unauthenticated requests MUST receive a 401 error.
- **FR-009**: System MUST return the existing record when a submitted username matches an already-existing inactive channel, without creating a duplicate.

### Key Entities

- **Source Channel**: Represents a Telegram channel tracked by the system. Key attributes: unique identifier, Telegram numeric ID, username handle, display title, active/inactive status, and timestamp of when it was added to the system.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can retrieve the full list of active channels in under 1 second.
- **SC-002**: Users can submit a new channel username and receive a response (created or existing) in under 2 seconds.
- **SC-003**: 100% of error responses across all endpoints conform to the standardized error structure.
- **SC-004**: Duplicate channel submissions (same username) never create duplicate records in the system.
- **SC-005**: All 5 specified test scenarios pass: active channels list, username validation, idempotent existing channel, new channel creation, and error shape consistency.

## Assumptions

- Telegram channel usernames follow the same format rules as Telegram user handles: 5-32 characters, alphanumeric plus underscores.
- The channel browsing endpoint does not require pagination for the initial implementation (the total number of channels is expected to be manageable). Pagination can be added as a future enhancement if the catalog grows significantly.
- The "pending" status for newly submitted channels is conveyed via the existing `isActive: false` field on the channel record. No separate status enum is needed at this stage.
- The userbot integration that actually subscribes to channels is out of scope for this feature — only the record creation and the future hook point are in scope.
- Username trimming (leading/trailing whitespace) is applied automatically before validation.
