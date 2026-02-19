# Feature Specification: Destination Channel Name Input

**Feature Branch**: `015-destination-channel-name`
**Created**: 2026-02-19
**Status**: Draft
**Input**: User description: "Replace destination channel ID (integer) with channel name @name in mini-app form and if needed in API services"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter Destination by Channel Name (Priority: P1)

A user creating or editing a subscription list enters the destination channel as a human-readable `@username` (e.g., `@mychannel`) instead of a numeric Telegram channel ID. The system resolves the username to the internal channel ID behind the scenes, verifies the bot is an admin in that channel, and stores both the username and the resolved ID.

**Why this priority**: The numeric channel ID is difficult for users to find and error-prone to enter. Channel usernames are visible in Telegram and intuitive to type. This is the core UX improvement.

**Independent Test**: Can be tested by opening the subscription list form, entering a `@username`, submitting, and verifying the list is created with the correct destination channel.

**Acceptance Scenarios**:

1. **Given** a user is creating a new subscription list, **When** they enter `@mychannel` in the destination field and submit, **Then** the system resolves the username to a channel ID, verifies bot admin status, creates the list, and displays the saved entry with `@mychannel` shown.
2. **Given** a user is editing an existing subscription list, **When** they change the destination to `@anotherchannel` and save, **Then** the system resolves the new username, re-verifies bot admin status, and updates the list.
3. **Given** a user enters a destination username, **When** the bot is not an admin in that channel, **Then** the system displays a clear error message explaining the bot must be added as an admin first.

---

### User Story 2 - Validation and Error Feedback (Priority: P2)

A user receives immediate, clear feedback when the entered channel username is invalid, does not exist, or cannot be resolved.

**Why this priority**: Good error handling prevents user frustration and reduces support burden. Without it, users may repeatedly try invalid values with no guidance.

**Independent Test**: Can be tested by entering various invalid usernames and verifying appropriate error messages appear.

**Acceptance Scenarios**:

1. **Given** a user enters a username that doesn't exist (e.g., `@nonexistent_channel_xyz`), **When** they submit the form, **Then** the system displays an error: the channel was not found.
2. **Given** a user enters a value without the `@` prefix (e.g., `mychannel`), **When** they submit, **Then** the system accepts it and treats it as `@mychannel`.
3. **Given** a user enters an empty destination field, **When** they try to submit, **Then** the form prevents submission and highlights the required field.

---

### Edge Cases

- What happens when the channel exists but is private and the bot has no access? The system returns an error indicating the channel was not found or is inaccessible.
- What happens when the channel username is changed after the subscription list was created? The stored numeric channel ID continues to work for forwarding; the displayed username may become stale until the user edits the list.
- What happens when a user enters a channel ID (numeric) instead of a username? The system rejects it and prompts for a `@username` instead.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The mini-app form MUST accept a channel `@username` (e.g., `@mychannel`) as the destination field instead of a numeric channel ID.
- **FR-002**: The API MUST resolve a channel `@username` to the corresponding Telegram numeric channel ID using the Bot API before storing.
- **FR-003**: The API MUST verify that the bot is an administrator in the resolved channel before accepting the destination.
- **FR-004**: The system MUST store both the resolved numeric channel ID and the `@username` for display purposes.
- **FR-005**: The mini-app MUST display the `@username` (not the numeric ID) when loading an existing subscription list for editing.
- **FR-006**: The API MUST return a clear, user-friendly error when the channel username cannot be resolved (not found, private, or inaccessible).
- **FR-007**: The mini-app MUST accept usernames with or without the `@` prefix (both `mychannel` and `@mychannel` should work).
- **FR-008**: The worker/forwarder MUST continue to use the stored numeric channel ID for message delivery (no changes to forwarding logic).

### Key Entities

- **SubscriptionList**: Existing entity. The `destinationChannelId` (numeric) remains the source of truth for forwarding. The `destinationUsername` field stores the human-readable `@username` for display.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can set a destination channel by entering a `@username` and submitting the form in under 30 seconds.
- **SC-002**: When an invalid or non-existent username is entered, the user sees a descriptive error within 5 seconds.
- **SC-003**: All existing subscription lists continue to function correctly after the change (backward compatible).
- **SC-004**: The forwarding pipeline delivers messages to the correct destination channels without any changes to its behavior.

## Assumptions

- The Telegram Bot API's `getChat` method can resolve a `@username` to a channel ID if the bot has access to that channel.
- Channel usernames are unique on Telegram, so a `@username` unambiguously identifies a channel.
- The `destinationUsername` field already exists in the database schema (confirmed in current Prisma schema).
- Numeric channel IDs will no longer be accepted as direct input from users — the form exclusively uses `@username`.
