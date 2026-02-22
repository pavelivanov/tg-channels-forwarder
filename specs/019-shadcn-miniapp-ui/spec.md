# Feature Specification: Shadcn Mini App UI/UX

**Feature Branch**: `019-shadcn-miniapp-ui`
**Created**: 2026-02-22
**Status**: Draft
**Input**: User description: "use shadcn update mini-app UI/UX"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Subscription Lists with Polished UI (Priority: P1)

A user opens the Telegram Mini App and sees their subscription lists presented in a clean, visually consistent interface. Each list card shows the list name, destination channel, source channel count, and an active/inactive status badge. The overall look and feel matches Telegram's native design language while using consistent component styling (rounded cards, proper spacing, typography hierarchy).

**Why this priority**: This is the first screen users see. A polished list view establishes visual quality and sets expectations for the rest of the app. It also covers the foundational setup (component library, theme integration, global styles) that all other stories depend on.

**Independent Test**: Open the Mini App in Telegram. The home screen renders subscription list cards with consistent styling, proper spacing, readable typography, and smooth theme integration (light/dark mode matching Telegram's current theme).

**Acceptance Scenarios**:

1. **Given** the user has subscription lists, **When** they open the Mini App, **Then** they see a list of styled cards with name, destination, channel count, and status badge
2. **Given** the user has no subscription lists, **When** they open the Mini App, **Then** they see a styled empty state with an icon and a prominent "Create your first list" button
3. **Given** Telegram is in dark mode, **When** the user opens the Mini App, **Then** all components render with appropriate dark-mode colors without any flash or mismatch
4. **Given** the app is loading data, **When** the user waits, **Then** they see skeleton placeholders instead of a generic spinner

---

### User Story 2 - Create and Edit Lists with Improved Form UX (Priority: P2)

A user creates or edits a subscription list using a well-designed form. Form fields have clear labels, helpful placeholders, and inline validation feedback. The channel selector uses checkboxes with a search/filter capability. Success and error states are communicated through toast notifications rather than page redirects or inline-only messages.

**Why this priority**: The form is the primary interaction point. Better form UX (validation, feedback, channel selection) directly impacts task completion rates and user satisfaction.

**Independent Test**: Create a new subscription list by filling out the form. All fields show validation errors inline when invalid. On successful creation, a toast notification confirms success and the user is navigated back to the list view.

**Acceptance Scenarios**:

1. **Given** the user is on the create list page, **When** they submit with empty required fields, **Then** each invalid field shows an inline error message below it
2. **Given** the user fills all fields correctly, **When** they submit the form, **Then** a success toast appears and they are navigated to the home page
3. **Given** the user is editing a list, **When** they tap Delete, **Then** a styled confirmation dialog appears before proceeding
4. **Given** the user has many source channels, **When** they open the channel selector, **Then** they can filter channels by typing a search term
5. **Given** the user adds a new channel inline, **When** the addition succeeds, **Then** the channel appears in the selector with a brief success indication

---

### User Story 3 - Responsive Feedback and Loading States (Priority: P3)

The app provides clear feedback for all user actions. Loading states use skeleton components instead of generic spinners. Error states show descriptive messages with retry options. Toast notifications confirm successful operations (create, edit, delete). The submit button shows a loading spinner while the form is being submitted.

**Why this priority**: Feedback quality determines perceived app reliability. Users need to know what happened after every action, especially in a mobile context with potentially slow connections.

**Independent Test**: Perform create, edit, and delete operations. Each operation shows appropriate loading state during processing and a toast notification on completion or failure.

**Acceptance Scenarios**:

1. **Given** data is loading on the home page, **When** the user waits, **Then** they see card-shaped skeleton placeholders
2. **Given** an API call fails, **When** the error occurs, **Then** a destructive toast notification shows the error message
3. **Given** the user submits a form, **When** the request is in progress, **Then** the submit button shows a spinner and is disabled
4. **Given** the user deletes a list, **When** deletion succeeds, **Then** a toast confirms "List deleted" and the list disappears from the home page

---

### Edge Cases

- What happens when the network is slow or offline? The app shows loading states and displays error toasts with retry guidance when requests fail.
- What happens when the user rapidly taps the submit button? The button is disabled immediately on first tap to prevent duplicate submissions.
- What happens when the Telegram theme changes while the app is open? The UI reactively updates to match the new theme.
- What happens when the channel list is very long (50+ channels)? The channel selector remains performant and provides search filtering.
- What happens when the user has reached the maximum number of subscription lists? The create button remains visible but the form shows an appropriate message on submission.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST use a component library for consistent, reusable UI elements (buttons, inputs, cards, badges, dialogs, toasts)
- **FR-002**: The app MUST use a utility-first CSS framework for styling instead of inline styles
- **FR-003**: The app MUST integrate with Telegram's theme variables so light/dark mode adapts automatically without JavaScript detection
- **FR-004**: The home page MUST display subscription lists as styled cards with name, destination, channel count, and active/inactive badge
- **FR-005**: The home page MUST show skeleton loading placeholders while data is loading
- **FR-006**: The home page MUST show a styled empty state with an icon and call-to-action when no lists exist
- **FR-007**: Form fields MUST display inline validation errors below each invalid field
- **FR-008**: The channel selector MUST support filtering channels by search text
- **FR-009**: Successful operations (create, save, delete) MUST show a brief toast notification confirming the action
- **FR-010**: Failed operations MUST show a toast notification with the error message
- **FR-011**: Submit buttons MUST show a loading indicator and be disabled while the request is in progress
- **FR-012**: The delete confirmation MUST use a styled dialog rather than a browser-native prompt
- **FR-013**: All interactive elements MUST have visible focus states for accessibility

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify the status of each subscription list (active/inactive) within 2 seconds of opening the app
- **SC-002**: Users receive visual feedback (toast, spinner, or skeleton) for 100% of user-initiated actions within 200ms
- **SC-003**: The app correctly renders in both light and dark Telegram themes without any color mismatches
- **SC-004**: Users can create a new subscription list in under 60 seconds, including channel selection
- **SC-005**: 100% of form validation errors are shown inline next to the relevant field before submission is attempted
- **SC-006**: The channel selector remains usable (no jank, smooth scrolling) with 100+ channels loaded

## Assumptions

- The existing API endpoints and data models remain unchanged; this is a frontend-only change
- The Telegram Mini App SDK (`@twa-dev/sdk`) continues to be used for theme detection and native dialogs
- The app targets mobile-only usage (within Telegram client); desktop responsiveness is not required
- No new pages or routes are added; this is a visual/UX upgrade of the existing two screens (home, list form)
- The existing authentication flow and context remain unchanged
