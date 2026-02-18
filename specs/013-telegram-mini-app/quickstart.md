# Quickstart: Telegram Mini App (Frontend)

**Feature Branch**: `013-telegram-mini-app` | **Date**: 2026-02-18

## Prerequisites

- Node.js 20 LTS
- pnpm (workspace manager)
- Running API backend (`apps/api`) with PostgreSQL and Redis
- Telegram Bot with a Mini App URL configured (BotFather → Bot Settings → Menu Button)

## Development Setup

### 1. Install dependencies

```bash
cd apps/mini-app
pnpm install
```

### 2. Start development server

```bash
pnpm dev
```

The Vite dev server starts at `http://localhost:5173/app`. During development, API calls are proxied to `http://localhost:3000` via Vite's proxy config.

### 3. Build for production

```bash
pnpm build
```

Output goes to `apps/mini-app/dist/`. The API serves these static files at `/app`.

## Integration Scenarios

### Scenario 1: First-time user opens the Mini App

1. User taps the Mini App link in Telegram
2. Telegram opens the WebApp iframe at `<API_URL>/app`
3. App loads, calls `WebApp.ready()` and `WebApp.expand()`
4. App reads `WebApp.initData` and POSTs to `/auth/validate`
5. Backend validates HMAC, creates/finds user, returns JWT + profile
6. App stores token in memory, fetches `GET /subscription-lists`
7. Home screen shows empty state: "No subscription lists yet. Create your first list!"
8. Total time: < 3 seconds

### Scenario 2: User creates a subscription list

1. User taps "Create List" on Home screen
2. App navigates to `/app/lists/new`
3. App fetches `GET /channels` to populate source channel selector
4. User fills in: name, destination channel ID/username, selects source channels
5. Channel count indicator shows "3/30"
6. User taps submit → `POST /subscription-lists`
7. On success: navigate to Home, new list appears
8. On 403 (limit reached): show error "Maximum list limit reached"

### Scenario 3: User adds a new source channel

1. User is on Create/Edit form
2. Taps "Add Channel" → text input appears
3. Types `@newchannel` and submits → `POST /channels { username: "newchannel" }`
4. On success: channel appears in the selector, auto-selected
5. On error (bot not admin): inline error "Bot is not an admin in this channel"

### Scenario 4: User edits a subscription list

1. User taps a list on Home screen
2. App navigates to `/app/lists/:id`
3. Form loads pre-filled with current values
4. User changes name and adds a source channel
5. Submit → `PATCH /subscription-lists/:id` with changed fields
6. On success: navigate to Home, list reflects changes

### Scenario 5: User deletes a subscription list

1. User taps a list on Home screen → Edit form opens
2. User taps "Delete" button
3. Confirmation dialog: "Delete this list? This cannot be undone."
4. User confirms → `DELETE /subscription-lists/:id`
5. On success: navigate to Home, list is gone

### Scenario 6: Session token expires

1. User has the app open for a long time
2. API call returns 401
3. HTTP client interceptor catches 401
4. Re-POSTs `WebApp.initData` to `/auth/validate`
5. Gets new token, retries the original request
6. User sees no interruption

### Scenario 7: Network error during operation

1. User submits a form
2. Network request fails (timeout, disconnection)
3. Error message appears inline: "Connection error. Please try again."
4. Form inputs are preserved — user can retry without re-entering data

### Scenario 8: App opened outside Telegram

1. User navigates to `<API_URL>/app` directly in a browser
2. `WebApp.initData` is empty/undefined
3. App shows error screen: "This app must be opened inside Telegram"
4. No API calls are made

## Verification Checklist

- [ ] Mini App loads inside Telegram within 3 seconds
- [ ] Authentication completes without user interaction
- [ ] Home screen shows subscription lists with correct data
- [ ] Empty state shown when no lists exist
- [ ] Create form enforces 30-channel limit
- [ ] Add Channel shows inline error on failure
- [ ] Edit form pre-fills with current values
- [ ] Delete requires confirmation
- [ ] Theme matches Telegram dark/light mode
- [ ] Opening outside Telegram shows clear error
- [ ] 401 responses trigger automatic re-authentication
