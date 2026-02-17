# Feature Specification: Bot Admin Verification & Destination Validation

**Feature Branch**: `010-bot-admin-verification`
**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "Bot Admin Verification & Destination Validation — Verify the bot has admin access to destination channels before activating subscription lists."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prevent list creation without bot admin access (Priority: P1)

A user attempts to create a subscription list targeting a destination channel. Before the list is created, the system verifies that the forwarding bot has administrator privileges in that destination channel. If the bot is not an admin, the request is rejected with a clear, actionable error message telling the user what to do.

**Why this priority**: This is the core protection — without it, users can create lists that will silently fail when forwarding begins because the bot cannot send messages to the destination channel.

**Independent Test**: Can be fully tested by attempting to create a subscription list with a destination channel where the bot is/is not an admin. Delivers immediate value by preventing broken subscription lists.

**Acceptance Scenarios**:

1. **Given** the bot is an administrator in destination channel D, **When** a user creates a subscription list targeting channel D, **Then** the list is created successfully.
2. **Given** the bot is NOT an administrator in destination channel D, **When** a user creates a subscription list targeting channel D, **Then** the request is rejected with error code `DESTINATION_BOT_NOT_ADMIN` and the message: "Please add the bot as an administrator to your destination channel before creating a subscription list."
3. **Given** the bot is a regular member (not admin) in destination channel D, **When** a user creates a subscription list targeting channel D, **Then** the request is rejected with the same error as scenario 2.

---

### User Story 2 - Prevent list update to unverified destination (Priority: P1)

A user attempts to update an existing subscription list to change its destination channel. The system verifies bot admin access to the new destination before allowing the update.

**Why this priority**: Same protection as US1, but for the update path. Without it, a user could bypass verification by creating a list with a valid destination and then changing it.

**Independent Test**: Can be tested by updating a subscription list's destination to a channel where the bot is/is not an admin.

**Acceptance Scenarios**:

1. **Given** a subscription list exists targeting channel A and the bot is an admin in channel B, **When** the user updates the list's destination to channel B, **Then** the update succeeds.
2. **Given** a subscription list exists targeting channel A and the bot is NOT an admin in channel C, **When** the user updates the list's destination to channel C, **Then** the request is rejected with error code `DESTINATION_BOT_NOT_ADMIN`.
3. **Given** a subscription list exists and the user updates fields other than the destination channel, **When** the update is submitted, **Then** the bot admin verification is NOT triggered (no unnecessary external calls).

---

### User Story 3 - Handle unreachable destination gracefully (Priority: P2)

The destination channel may not exist, may have been deleted, or the bot may have been banned from it. In these cases, the verification should fail gracefully with a clear error rather than crashing or timing out.

**Why this priority**: Important for robustness but secondary to the core verification logic.

**Independent Test**: Can be tested by providing an invalid or non-existent channel ID and verifying the system returns a meaningful error.

**Acceptance Scenarios**:

1. **Given** the destination channel ID does not exist or is invalid, **When** the user creates a subscription list targeting it, **Then** the request is rejected with error code `DESTINATION_BOT_NOT_ADMIN` and an appropriate message.
2. **Given** the bot has been banned from the destination channel, **When** the user creates a subscription list targeting it, **Then** the request is rejected with the same error code.
3. **Given** the external messaging service is temporarily unavailable, **When** the user creates a subscription list, **Then** the request fails with an appropriate error indicating a temporary issue, and the user can retry.

---

### Edge Cases

- What happens when the bot's admin status is revoked after a list is already created? Out of scope — handled by forwarding error handling in the forwarder service.
- What happens when the channel ID is 0 or negative? The system treats it the same as an invalid channel.
- What happens when the bot is the channel creator (owner)? It is treated as having admin access.
- What happens when multiple list operations happen concurrently for the same destination? Each request independently verifies admin status (no caching in this initial implementation).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST verify bot administrator status in the destination channel before creating a subscription list.
- **FR-002**: System MUST verify bot administrator status in the destination channel before updating a subscription list's destination channel.
- **FR-003**: System MUST NOT trigger bot admin verification when updating subscription list fields other than the destination channel (name, isActive, etc.).
- **FR-004**: System MUST return error code `DESTINATION_BOT_NOT_ADMIN` with message "Please add the bot as an administrator to your destination channel before creating a subscription list." when the bot is not an admin.
- **FR-005**: System MUST accept the bot's status as valid if it is either an administrator or the channel creator/owner.
- **FR-006**: System MUST handle unreachable or non-existent destination channels by returning the `DESTINATION_BOT_NOT_ADMIN` error (fail closed — deny access if verification cannot be completed).
- **FR-007**: System MUST handle temporary external service failures by returning an appropriate error that allows the user to retry.
- **FR-008**: Verification MUST complete within 10 seconds; if the external check exceeds this timeout, the system returns a temporary error.

### Non-Functional Requirements

- **NFR-001**: Bot admin verification MUST NOT add more than 2 seconds of latency to subscription list creation/update under normal conditions.
- **NFR-002**: Verification failures MUST be logged for operational monitoring.

### Key Entities

- **Bot Verification Result**: Represents the outcome of checking bot admin status for a given channel — either confirmed admin, not admin, or verification failed (with reason).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of subscription list creation attempts targeting channels where the bot is not an admin are rejected with a clear, actionable error message.
- **SC-002**: 100% of subscription list creation attempts targeting channels where the bot is an admin succeed without additional user action.
- **SC-003**: Users receive a verification response within 2 seconds under normal operating conditions.
- **SC-004**: Invalid or non-existent channel IDs are handled gracefully — no unhandled errors or timeouts visible to the user.
- **SC-005**: All 4 specified test cases pass: admin returns true, non-admin returns false, list creation rejected on failure, list update rejected on failure.

## Scope

### In Scope

- Bot admin verification on subscription list creation (POST)
- Bot admin verification on subscription list destination update (PATCH)
- Error handling for unreachable/invalid channels
- Structured error responses with actionable messages

### Out of Scope

- Periodic re-verification of existing subscription lists
- Caching of bot admin status
- Automatic removal of lists when bot loses admin access
- Verification of source channel access (handled by the listener service)

## Assumptions

- The bot token used for verification is the same token used by the forwarder service for sending messages.
- The bot token is already available in the system's configuration (needs to be added to API config).
- The external messaging service's "get chat member" endpoint is reliable and responds within 2 seconds under normal conditions.
- Admin status check is a lightweight, non-rate-limited operation on the messaging platform.

## Dependencies

- Existing subscription list CRUD endpoints (Feature 005)
- Bot token configuration (Feature 009 added `BOT_TOKEN` to worker config; needs to be added to API config as well)
