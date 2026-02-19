# Feature Specification: Shadcn Mini App UI

**Feature Branch**: `017-shadcn-mini-app-ui`
**Created**: 2026-02-19
**Status**: Draft
**Input**: User description: "update mini-app UI/UX use shadcn"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Polished Component Library Integration (Priority: P1) MVP

A user opens the Telegram Mini App and sees a visually cohesive, modern interface that feels native to the Telegram environment. All UI elements — buttons, inputs, cards, badges, labels — use consistent styling from a component library instead of ad-hoc inline styles. The app respects the user's current Telegram theme (light or dark) and transitions smoothly between themes.

**Why this priority**: The current app uses scattered inline `React.CSSProperties` objects and a single `global.css` file with no component library. This makes the UI inconsistent, hard to maintain, and visually basic. Replacing the inline styles with a proper component system is the foundation for all other UI improvements.

**Independent Test**: Open the Mini App inside Telegram in both light and dark themes. All pages (home, create list, edit list) render with consistent spacing, typography, and color tokens derived from the Telegram theme. No inline `style={{}}` attributes remain on page/component elements (except layout-specific overrides like flex direction).

**Acceptance Scenarios**:

1. **Given** the Mini App is opened in Telegram with a light theme, **When** the user views the home page, **Then** all cards, buttons, headings, and text use consistent visual styling from the component library and match the Telegram light theme colors.
2. **Given** the Mini App is opened in Telegram with a dark theme, **When** the user views any page, **Then** all UI elements adapt to the dark theme without hardcoded colors bleeding through.
3. **Given** the user switches Telegram themes while the app is open, **When** the theme change completes, **Then** all component colors update seamlessly without a page reload.
4. **Given** a developer opens the source code, **When** they inspect any page or component, **Then** styling is done via utility classes (not inline style objects), and reusable components are used for buttons, inputs, cards, and badges.

---

### User Story 2 - Improved Form Experience (Priority: P2)

A user creating or editing a subscription list has a clear, guided form experience. Each form field has a visible label, helpful description text where needed, and inline validation feedback (e.g., a red border and error message on the specific invalid field). The channel selector feels polished with proper checkboxes and a clear selection count. The "add channel by username" flow provides clear feedback on success and errors.

**Why this priority**: Forms are the primary interaction in the app (creating/editing subscription lists). Poor form UX directly impacts task completion rates. This builds on the component library from US1 to deliver a better form experience using proper Form, Input, Label, Checkbox, and error display components.

**Independent Test**: Navigate to the "Create List" page, attempt to submit with an empty name, and verify a field-level error appears on the name input (not just a global error at the bottom). Select and deselect channels using styled checkboxes. Add a channel by username and verify the success/error feedback is clear and inline.

**Acceptance Scenarios**:

1. **Given** the user is on the "Create List" page, **When** they attempt to save without entering a name, **Then** the name input shows a visible error indicator (red border, error text below the field) — not just a generic error at the bottom of the page.
2. **Given** the user is selecting channels, **When** they check/uncheck channels, **Then** the checkboxes use styled components with clear checked/unchecked states and the selection count updates in real time.
3. **Given** the user adds a channel by username, **When** the operation succeeds, **Then** the input clears and the new channel appears in the selector. **When** the operation fails, **Then** an inline error message appears near the add-channel input with the specific error reason.
4. **Given** the user is editing an existing list, **When** they change the name and save, **Then** the save button shows a loading state (spinner or visual indicator) during the API call.

---

### User Story 3 - Enhanced List Browsing and Feedback (Priority: P3)

A user browsing their subscription lists on the home page sees well-styled cards with clear visual hierarchy — list name, channel count, active/inactive status. Empty states include an illustration or icon to guide the user. Loading states use proper skeleton indicators. Touch feedback on cards makes the app feel responsive.

**Why this priority**: The home page is the first thing users see. While it works functionally, the current minimal styling (no icons, no touch feedback on cards, text-only empty state) makes the app feel unfinished. This story adds visual polish that improves perceived quality.

**Independent Test**: Open the home page with zero subscription lists and verify a visually engaging empty state with an icon or illustration appears. Then create a list and return to the home page to see it displayed as a styled card with proper touch/press feedback when tapped.

**Acceptance Scenarios**:

1. **Given** the user has no subscription lists, **When** they open the home page, **Then** they see an empty state with a descriptive icon/illustration, a message, and a clear call-to-action button.
2. **Given** the user has subscription lists, **When** they view the home page, **Then** each list is displayed as a card with the list name, channel count, and a styled active/inactive badge with sufficient color contrast.
3. **Given** the user taps on a subscription list card, **When** they press down, **Then** the card shows visible touch/press feedback (opacity change, scale, or highlight).
4. **Given** the app is loading data, **When** the home page is fetching subscription lists, **Then** skeleton placeholders or a centered spinner with accessible labeling appears instead of a blank screen.

---

### Edge Cases

- What happens when the Telegram theme uses extreme colors (e.g., very dark background with very dark text)? The component library should rely on Telegram's CSS variables for theming, inheriting whatever the user's Telegram client provides, with sensible fallbacks.
- What happens on very small screens (e.g., 320px wide)? The layout should remain usable with no horizontal overflow or clipped content.
- What happens when the user has many channels (50+) in the channel selector? The selector should scroll smoothly without layout breakage.
- What happens when the component library's default theme conflicts with Telegram's theme? Telegram theme variables must take precedence — the component library's default color palette should be overridden to map to Telegram's CSS variables.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Mini App MUST use a component library for all interactive UI elements (buttons, inputs, checkboxes, cards, badges, labels, separators)
- **FR-002**: The Mini App MUST use utility-class-based styling instead of inline `React.CSSProperties` style objects for all visual styling
- **FR-003**: All component library color tokens MUST map to Telegram's `--tg-theme-*` CSS variables so the app inherits the user's Telegram theme automatically
- **FR-004**: The Mini App MUST provide a reusable Button component with at least three visual variants: primary (solid), secondary/outline, and destructive (for delete actions)
- **FR-005**: The Mini App MUST provide a reusable Card component used for subscription list items and form sections
- **FR-006**: Form inputs MUST have associated labels and support inline error display (error message and visual indicator directly on the invalid field)
- **FR-007**: The channel selector MUST use styled checkboxes (not browser-default checkboxes) with clear checked/unchecked visual states
- **FR-008**: Loading states MUST use a spinner or skeleton component with an accessible label (e.g., `role="status"`, `aria-label`)
- **FR-009**: The empty state on the home page MUST include a visual element (icon or illustration) in addition to the text message and call-to-action button
- **FR-010**: Subscription list cards MUST provide touch/press feedback when tapped (visual response within 100ms of touch)
- **FR-011**: The app MUST remove all injected `<style>` tags from component render functions (specifically the `@keyframes` in the loading spinner) and define animations in stylesheets
- **FR-012**: The Mini App MUST retain all existing functionality — no features removed, all API interactions preserved, routing unchanged
- **FR-013**: The delete confirmation MUST continue to use Telegram's native `WebApp.showConfirm` dialog (not a custom modal)
- **FR-014**: The Mini App MUST preserve the existing `basename: '/app'` routing and work correctly when served both by the NestJS static file server and the Vite dev server

### Non-Functional Requirements

- **NFR-001**: The production bundle size increase from adding the component library and utility CSS framework MUST NOT exceed 50 KB gzipped over the current bundle
- **NFR-002**: All text-on-background color combinations MUST meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text) when using Telegram's default light and dark themes
- **NFR-003**: Existing unit tests MUST continue to pass after the UI migration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero inline `style={{}}` attributes remain on page-level and reusable component elements (layout wrappers like flex containers are acceptable exceptions)
- **SC-002**: All 6 existing components and 2 pages are migrated to use the component library — no visual regressions when compared side-by-side in Telegram light and dark themes
- **SC-003**: Users can complete the "create a subscription list" flow (name it, select channels, save) with field-level validation feedback visible within 100ms of an invalid submission attempt
- **SC-004**: The app renders correctly on screen widths from 320px to 428px (common mobile phone range for Telegram Mini Apps)
- **SC-005**: The inactive badge on subscription list cards passes WCAG AA contrast requirements in both Telegram light and dark themes
- **SC-006**: All existing tests pass without modification or with only import/selector updates to account for the new component markup
