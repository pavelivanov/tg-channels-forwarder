# Feature Specification: Telegram Mini App (Frontend)

**Feature Branch**: `013-telegram-mini-app`
**Created**: 2026-02-18
**Status**: Draft
**Input**: User description: "Telegram Mini App — Users can manage their subscriptions through a Telegram WebApp"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authentication and Home Screen (Priority: P1)

A user opens the Mini App inside Telegram. The app automatically extracts their Telegram identity, authenticates them against the backend, and displays the Home screen showing all of their subscription lists. Each list displays its name, destination channel name, source channel count, and active/inactive status. If the user has no lists yet, they see an empty state with a prompt to create their first list.

**Why this priority**: Without authentication and the home screen, no other functionality is accessible. This is the entry point for all user interactions and the minimum viable product.

**Independent Test**: Can be tested by opening the Mini App in Telegram, verifying automatic authentication completes, and confirming the user's subscription lists (or empty state) render correctly.

**Acceptance Scenarios**:

1. **Given** a user opens the Mini App inside Telegram, **When** the app loads, **Then** authentication happens automatically using Telegram identity data, a session token is obtained, and the Home screen is displayed within 3 seconds.
2. **Given** an authenticated user with 2 subscription lists, **When** the Home screen loads, **Then** both lists are shown with name, destination channel name, source channel count, and active/inactive badge.
3. **Given** an authenticated user with no subscription lists, **When** the Home screen loads, **Then** an empty state message is shown with a prompt to create a list.
4. **Given** a user who is not inside the Telegram app (direct URL access), **When** the app loads, **Then** a clear error message is displayed explaining the app must be opened inside Telegram.
5. **Given** the backend is unreachable during authentication, **When** the app attempts to authenticate, **Then** a network error message is displayed with a retry option.

---

### User Story 2 - Create and Edit Subscription Lists (Priority: P2)

A user creates a new subscription list by tapping "Create List" on the Home screen. They fill in a list name, specify a destination channel (numeric ID and username), and select source channels from the available channels. They can also add new source channels by entering a @username. Users can edit existing lists to change the name, destination, or source channel selection. The form enforces a 30-channel limit per list and displays the current count.

**Why this priority**: List management is the core value proposition. Once users can authenticate and view lists, they need the ability to create and modify them.

**Independent Test**: Can be tested by creating a new subscription list with source channels, verifying it appears on the Home screen, then editing its name and channels, verifying changes persist.

**Acceptance Scenarios**:

1. **Given** an authenticated user on the Home screen, **When** they tap "Create List", **Then** a form is displayed with fields for list name, destination channel ID, destination username, and source channel selection.
2. **Given** a user on the Create List form, **When** they fill in all required fields and select source channels and submit, **Then** the list is created and they are returned to the Home screen where the new list appears.
3. **Given** available source channels exist, **When** the user opens the source channel selector, **Then** all available channels are displayed as a multi-select list.
4. **Given** a user has selected 30 source channels, **When** they attempt to select another channel, **Then** the selection is prevented and the channel limit indicator shows "30/30".
5. **Given** a user on the Create List form, **When** they tap "Add Channel" and enter a valid @username, **Then** the channel is registered in the system and automatically added to their selection.
6. **Given** a user taps "Add Channel" and enters a @username where the bot is not an admin, **When** the request fails, **Then** an inline error message explains the failure reason (e.g., "Bot is not an admin in this channel").
7. **Given** an authenticated user on the Home screen, **When** they tap an existing list, **Then** the Edit form is displayed pre-filled with the list's current name, destination, and selected source channels.
8. **Given** a user on the Edit form makes changes and submits, **When** the update succeeds, **Then** they return to the Home screen and the list reflects the changes.
9. **Given** a user who has reached the maximum number of lists, **When** they view the Home screen, **Then** the "Create List" button is disabled and shows a "Premium" label.

---

### User Story 3 - Delete Subscription Lists (Priority: P3)

A user can delete a subscription list they no longer need. Deletion requires confirmation to prevent accidental removal.

**Why this priority**: Deletion is a secondary action — users typically create and edit more often than they delete. However, it is necessary for complete lifecycle management.

**Independent Test**: Can be tested by deleting an existing list, confirming the confirmation dialog works, and verifying the list disappears from the Home screen.

**Acceptance Scenarios**:

1. **Given** a user is viewing or editing a subscription list, **When** they tap "Delete", **Then** a confirmation prompt is shown asking them to confirm deletion.
2. **Given** a user confirms deletion, **When** the deletion succeeds, **Then** the list is removed and the user returns to the Home screen where the list no longer appears.
3. **Given** a user is prompted to confirm deletion, **When** they cancel, **Then** the list is not deleted and they remain on the current screen.

---

### User Story 4 - Native Telegram Appearance (Priority: P4)

The Mini App visually integrates with Telegram by adopting the user's current Telegram theme (light, dark, or custom). Colors, fonts, and spacing match the native Telegram look and feel, making the app feel like a built-in part of Telegram rather than an external web page.

**Why this priority**: Visual integration enhances trust and usability but is not blocking for core functionality.

**Independent Test**: Can be tested by opening the app in Telegram with different theme settings (light and dark mode) and verifying the UI adapts to each theme.

**Acceptance Scenarios**:

1. **Given** a user has Telegram set to dark mode, **When** they open the Mini App, **Then** the app uses dark background, light text, and accent colors matching Telegram's dark theme.
2. **Given** a user has Telegram set to light mode, **When** they open the Mini App, **Then** the app uses light background, dark text, and accent colors matching Telegram's light theme.
3. **Given** any Telegram theme, **When** the app is displayed, **Then** buttons, inputs, and interactive elements use Telegram's accent and hint colors for a native appearance.

---

### Edge Cases

- What happens when the user's network connection drops mid-operation (e.g., while saving a list)? The app displays an error message and preserves the user's input so they can retry without re-entering data.
- What happens when the user opens the app outside of Telegram (direct URL)? A clear message explains the app must be opened via Telegram.
- What happens when a channel added via @username already exists in the system? The existing channel is returned and added to the selection without error.
- What happens when the backend returns a validation error during list creation (e.g., duplicate name, invalid destination)? The specific error is displayed inline near the relevant form field.
- What happens when the user's session token expires while using the app? The app detects the 401 response and re-authenticates automatically using the Telegram identity data, without disrupting the user's workflow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST automatically authenticate the user on load using Telegram identity data, without requiring manual login.
- **FR-002**: The session token MUST be stored only in application memory (not in persistent browser storage) for security.
- **FR-003**: The Home screen MUST display all of the authenticated user's subscription lists, each showing: list name, destination channel name, source channel count, and active/inactive status.
- **FR-004**: The Home screen MUST show an empty state with a creation prompt when the user has no subscription lists.
- **FR-005**: The "Create List" button MUST be disabled with a "Premium" label when the user has reached their maximum list limit.
- **FR-006**: The Create/Edit form MUST include fields for: list name (text), destination channel ID (numeric), destination username (text), and source channel multi-select.
- **FR-007**: The source channel selector MUST display all channels available in the system, fetched from the backend.
- **FR-008**: The Create/Edit form MUST display a channel count indicator showing "N/30" and prevent selection beyond 30 source channels.
- **FR-009**: The "Add Channel" feature MUST allow the user to enter a @username, register it via the backend, and add the resulting channel to the current selection.
- **FR-010**: The "Add Channel" feature MUST display the specific backend error message inline if registration fails (e.g., bot not admin, channel not found).
- **FR-011**: Users MUST be able to edit an existing subscription list, with the form pre-populated with current values.
- **FR-012**: Users MUST be able to delete a subscription list, with a confirmation step before the action is executed.
- **FR-013**: The app MUST display meaningful error messages for network failures, validation errors, and backend errors using inline messages (not browser alerts).
- **FR-014**: The app MUST be served as static files at the `/app` path on the existing backend server.
- **FR-015**: The app MUST adapt its visual appearance to the user's current Telegram theme (light, dark, or custom) using Telegram-provided theme variables.
- **FR-016**: The app MUST gracefully handle being opened outside of Telegram by displaying an informative message.
- **FR-017**: The app MUST automatically re-authenticate when the session token expires (detected via 401 response) without losing the user's current work.

### Key Entities

- **Subscription List**: A named grouping that routes messages from selected source channels to a single destination channel. Has a name, destination channel, collection of source channels, and active/inactive status. Belongs to one user. Limited to a configurable maximum per user.
- **Source Channel**: A Telegram channel that can be added as a message source. Has a Telegram ID, username, and active status. Shared across all users (global resource).
- **Session**: An in-memory authentication context containing the user's identity and access token. Created on app load, refreshed on expiry. Never persisted to browser storage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open the Mini App and see their subscription lists within 3 seconds of tapping the app link in Telegram.
- **SC-002**: Users can create a new subscription list with source channels in under 60 seconds.
- **SC-003**: Users can add a new source channel by @username and have it appear in their selection within 5 seconds.
- **SC-004**: 100% of error scenarios (network failure, validation error, bot not admin, list limit reached) display a user-readable message without blank screens or unhandled exceptions.
- **SC-005**: The app appearance is visually indistinguishable from a native Telegram screen when using default light and dark themes.
- **SC-006**: The authentication flow completes without any user interaction (zero-click sign-in).

## Assumptions

- The existing backend endpoints (auth/validate, channels, subscription-lists) are stable and complete as specified in the current API.
- The maximum number of subscription lists per user is provided by the backend (currently 1 for non-premium users, reflected via error response when exceeded).
- The destination channel ID is entered manually by the user (the system does not provide a channel picker for destinations since the bot must already be an admin there).
- The app is a single-page application with client-side navigation between Home and Create/Edit screens (no full page reloads).
- Channel usernames follow Telegram's format constraints (5-32 alphanumeric characters plus underscores).
- The backend validates bot admin status for destination channels during list creation/update, and the frontend displays the resulting error if validation fails.

## Out of Scope

- Push notifications or real-time updates (lists refresh on navigation, not via websockets).
- User settings or profile management screen.
- Internationalization/localization (English only for initial release).
- Offline mode or service worker caching.
- Premium/payment integration (the "Premium" label is a visual indicator only; no purchase flow).
- Analytics or telemetry integration.
