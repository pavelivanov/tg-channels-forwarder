# Feature Specification: Authentication (Telegram initData + JWT)

**Feature Branch**: `003-telegram-jwt-auth`
**Created**: 2026-02-16
**Status**: Draft
**Input**: User description: "Authentication via Telegram Mini App initData with JWT for API access"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authenticate via Telegram Mini App (Priority: P1)

A user opens the Telegram Mini App. The app sends the user's Telegram initData to the API. The system validates the initData signature, creates or updates the user record, and returns a JWT token along with the user's profile. The user can then use this token to access protected API endpoints.

**Why this priority**: Authentication is the foundation for all protected functionality. Without it, no other feature can securely identify users.

**Independent Test**: Can be fully tested by sending a valid initData payload to POST /auth/validate and verifying that a JWT and user profile are returned.

**Acceptance Scenarios**:

1. **Given** a user opens the Mini App for the first time, **When** the app sends valid initData to POST /auth/validate, **Then** the system creates a new user record and returns a JWT token with the user's profile.
2. **Given** a returning user opens the Mini App, **When** the app sends valid initData to POST /auth/validate, **Then** the system updates the existing user record (name, username changes) and returns a JWT token with the updated profile.
3. **Given** any user, **When** the app sends initData with an invalid or tampered HMAC signature, **Then** the system returns a 401 Unauthorized response.
4. **Given** any user, **When** the app sends initData with an expired auth_date (older than 5 minutes), **Then** the system returns a 401 Unauthorized response.

---

### User Story 2 - Access Protected Endpoints with JWT (Priority: P1)

An authenticated user makes requests to protected API endpoints by including their JWT in the Authorization header. The system validates the token and attaches the user identity to the request context so downstream handlers know who is making the request.

**Why this priority**: Token-based access control is inseparable from authentication — issuing tokens without enforcing them provides no security value.

**Independent Test**: Can be tested by obtaining a JWT from Story 1, then calling a protected endpoint with and without the token and verifying access control behavior.

**Acceptance Scenarios**:

1. **Given** a user has a valid JWT, **When** they send a request with `Authorization: Bearer <token>` to a protected endpoint, **Then** the system processes the request and the handler has access to the authenticated user's identity.
2. **Given** a user sends a request without an Authorization header, **When** they access a protected endpoint, **Then** the system returns a 401 Unauthorized response.
3. **Given** a user has an expired JWT (older than 1 hour), **When** they send a request with that token, **Then** the system returns a 401 Unauthorized response.
4. **Given** a user sends a request with a malformed or tampered JWT, **When** they access a protected endpoint, **Then** the system returns a 401 Unauthorized response.

---

### Edge Cases

- What happens when initData contains a user with no username (Telegram allows this)? System creates/updates the user with username as null.
- What happens when the bot token is missing or misconfigured? System fails to start with a clear configuration validation error.
- What happens when the JWT secret is too short or missing? System fails to start with a clear configuration validation error.
- What happens when initData is missing required fields (no user object)? System returns 401.
- What happens when the same user authenticates concurrently from multiple devices? Each authentication independently issues a valid JWT; all tokens remain valid until expiry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST validate Telegram initData by verifying the HMAC-SHA256 signature using the bot token, following Telegram's official validation algorithm.
- **FR-002**: System MUST reject initData where the auth_date is older than 5 minutes.
- **FR-003**: System MUST create a new user record when a previously unseen telegramId authenticates.
- **FR-004**: System MUST update existing user profile fields (firstName, lastName, username, photoUrl, isPremium) when a known telegramId authenticates with changed data.
- **FR-005**: System MUST return a JWT containing the user's internal ID and telegramId, with a 1-hour expiry.
- **FR-006**: System MUST return the user's profile alongside the JWT on successful authentication.
- **FR-007**: System MUST protect endpoints by validating the JWT from the Authorization Bearer header and attaching the authenticated user to the request context.
- **FR-008**: System MUST return 401 Unauthorized for invalid, expired, or missing tokens on protected endpoints.
- **FR-009**: System MUST validate required configuration (bot token, JWT secret, database URL) at startup and fail fast with clear error messages if any are missing.

### Key Entities

- **User** (existing): Represents a Telegram user. Identified by telegramId. Stores firstName, lastName, username. Created or updated during authentication.
- **JWT Token**: Short-lived credential (1 hour) carrying the user's internal ID and telegramId. Used for stateless authentication on subsequent requests.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can authenticate from the Telegram Mini App and receive a token in under 2 seconds.
- **SC-002**: 100% of requests with tampered initData or invalid tokens are rejected with 401.
- **SC-003**: Returning users see their updated profile information immediately after authenticating.
- **SC-004**: The system refuses to start if required configuration values are missing, preventing misconfigured deployments.

## Assumptions

- Telegram's initData format follows the documented Web App specification (query string with hash, auth_date, and user JSON).
- The bot token is a standard Telegram Bot API token obtained from @BotFather.
- The 5-minute auth_date expiry window is appropriate for normal Mini App launch latency.
- The existing User model in the Prisma schema has the necessary fields (telegramId, firstName, lastName, username).
- No refresh token mechanism is needed at this stage; users re-authenticate via initData when the JWT expires.

## Scope Boundaries

**In scope**: initData validation, user upsert, JWT issuance, JWT-based route protection, configuration validation.

**Out of scope**: Refresh tokens, role-based access control, rate limiting, session management, logout/token revocation.
