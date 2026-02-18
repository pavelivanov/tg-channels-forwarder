# Data Model: Telegram Mini App (Frontend)

**Feature Branch**: `013-telegram-mini-app` | **Date**: 2026-02-18

This document describes the frontend state model — the data structures used in the React application. These are **not** database entities; they are TypeScript interfaces representing API responses and client-side state.

## API Response Types

### AuthResponse

Returned by `POST /auth/validate`.

| Field | Type | Description |
|-------|------|-------------|
| token | string | JWT access token |
| user | UserProfile | Authenticated user profile |

### UserProfile

Nested in AuthResponse.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Internal user ID (UUID) |
| telegramId | string | Telegram user ID |
| firstName | string | User's first name |
| lastName | string \| null | User's last name |
| username | string \| null | Telegram @username |
| photoUrl | string \| null | Profile photo URL |
| isPremium | boolean | Telegram Premium status |

### SourceChannel

Returned by `GET /channels` and `POST /channels`.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Channel UUID |
| telegramId | string | Telegram channel numeric ID |
| username | string | Channel @username |
| title | string \| null | Channel display title |
| isActive | boolean | Whether channel is active |

### SubscriptionList

Returned by `GET /subscription-lists`, `POST /subscription-lists`, `PATCH /subscription-lists/:id`.

| Field | Type | Description |
|-------|------|-------------|
| id | string | List UUID |
| name | string | User-defined list name |
| destinationChannelId | number | Destination Telegram channel ID |
| destinationUsername | string \| null | Destination channel @username |
| isActive | boolean | Whether list is currently forwarding |
| sourceChannels | SourceChannel[] | Array of source channels in this list |

### ApiError

Standard error response from the API.

| Field | Type | Description |
|-------|------|-------------|
| statusCode | number | HTTP status code |
| message | string \| string[] | Error message(s) |
| error | string | Error type name |

## Client-Side State

### AuthState

Managed by AuthContext/provider. Stored in memory only (not persisted).

| Field | Type | Description |
|-------|------|-------------|
| token | string \| null | Current JWT token |
| user | UserProfile \| null | Current user profile |
| isAuthenticated | boolean | Whether auth is complete |
| isLoading | boolean | Auth in progress |
| error | string \| null | Auth error message |

### ListFormState

Local state for the Create/Edit subscription list form.

| Field | Type | Description |
|-------|------|-------------|
| name | string | List name input value |
| destinationChannelId | string | Destination channel ID input (string for input binding, parsed to number on submit) |
| destinationUsername | string | Destination @username input |
| selectedChannelIds | Set\<string\> | UUIDs of selected source channels |
| isSubmitting | boolean | Form submission in progress |
| errors | Record\<string, string\> | Field-level validation errors |

### AddChannelState

Local state for the "Add Channel" inline form.

| Field | Type | Description |
|-------|------|-------------|
| username | string | Channel @username input |
| isAdding | boolean | Registration in progress |
| error | string \| null | Registration error message |

## State Management Approach

No external state library. Use React Context for auth state (app-wide) and local `useState`/`useReducer` for form state (component-scoped).

**Data fetching**: Custom hooks wrapping `fetch` with auth token injection and 401 retry logic. No query caching library needed — the app has simple CRUD flows with navigation-based refetching.

## Validation Rules (Client-Side)

| Field | Rule | Source |
|-------|------|--------|
| List name | Required, non-empty | FR-006 |
| Destination channel ID | Required, positive integer | FR-006 |
| Source channels | At least 1 selected, max 30 | FR-008 |
| Channel @username | 5-32 chars, alphanumeric + underscore | Telegram format |
