# Research: Telegram Mini App (Frontend)

**Feature Branch**: `013-telegram-mini-app` | **Date**: 2026-02-18

## R1: Telegram WebApp SDK Integration

**Decision**: Use `@twa-dev/sdk` (typed ESM wrapper around `window.Telegram.WebApp`)

**Rationale**: Provides TypeScript types, ESM compatibility, and React-friendly patterns. The raw `window.Telegram.WebApp` API is untyped and requires manual type declarations. `@twa-dev/sdk` re-exports all WebApp methods with full TypeScript support and works with Vite's ESM bundling.

**Alternatives considered**:
- Raw `window.Telegram.WebApp` — no types, requires manual `declare global`, works but developer experience is poor
- `@vkruglikov/react-telegram-web-app` — React component wrappers, but adds unnecessary abstraction layer and is less maintained

**Key integration points**:
- `WebApp.initData` — raw init data string to POST to `/auth/validate`
- `WebApp.initDataUnsafe` — parsed data for immediate UI display (name, photo) before auth completes
- `WebApp.ready()` — signal to Telegram that app is loaded (removes loading spinner)
- `WebApp.expand()` — expand to full height on load
- `WebApp.themeParams` — access to theme variables programmatically
- `WebApp.MainButton` — native Telegram bottom button for primary actions
- `WebApp.BackButton` — native back navigation button
- `WebApp.close()` — close the mini app

## R2: Authentication Flow (initData → JWT)

**Decision**: POST `WebApp.initData` string to `POST /auth/validate`, receive `{ token, user }`, store JWT in memory only

**Rationale**: The backend already validates initData using HMAC-SHA256 against the bot token. Storing JWT in memory (not localStorage/sessionStorage) prevents XSS token theft — session lives only as long as the app is open, which matches the Telegram Mini App lifecycle.

**Flow**:
1. App loads → `WebApp.initData` available immediately
2. POST to `/auth/validate` with `{ initData: WebApp.initData }`
3. Receive `{ token: string, user: UserProfile }`
4. Store token in React state/context (memory only)
5. Attach `Authorization: Bearer <token>` to all subsequent API calls
6. On 401 response → re-authenticate using same flow (token expired)

**Re-authentication**: Intercept 401 responses in the HTTP client, re-POST initData, update token in memory, retry the original request — transparent to the user.

## R3: Telegram Theme Variables (CSS)

**Decision**: Use CSS custom properties provided by Telegram WebApp SDK for all colors

**Rationale**: Telegram injects `--tg-theme-*` CSS variables into the WebApp iframe. Using these directly ensures the app matches the user's current Telegram theme (light, dark, or custom) without any theme detection logic.

**Available variables**:
- `--tg-theme-bg-color` — main background
- `--tg-theme-text-color` — primary text
- `--tg-theme-hint-color` — secondary/hint text
- `--tg-theme-link-color` — links and interactive text
- `--tg-theme-button-color` — primary button background
- `--tg-theme-button-text-color` — primary button text
- `--tg-theme-secondary-bg-color` — cards, inputs, secondary surfaces
- `--tg-theme-header-bg-color` — header background
- `--tg-theme-accent-text-color` — accent text
- `--tg-theme-section-bg-color` — section background
- `--tg-theme-section-header-text-color` — section headers
- `--tg-theme-subtitle-text-color` — subtitles
- `--tg-theme-destructive-text-color` — destructive actions (delete)

**Approach**: Define a minimal CSS reset that maps these variables to semantic tokens used throughout the app. No external CSS framework needed — Telegram's variables cover all UI needs.

## R4: Static File Serving via NestJS

**Decision**: Install `@nestjs/serve-static` and configure `ServeStaticModule` in the API's `AppModule`

**Rationale**: The spec requires serving the mini-app at `/app` path on the existing backend. `@nestjs/serve-static` is the NestJS-recommended way to serve static files. It supports SPA fallback (serving `index.html` for all unmatched routes under the prefix).

**Configuration**:
```typescript
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', '..', 'mini-app', 'dist'),
  serveRoot: '/app',
  serveStaticOptions: {
    index: false, // Let renderPath handle SPA fallback
  },
  renderPath: '/app*', // SPA fallback for client-side routing
})
```

**Build integration**: The mini-app's `dist/` folder is output by Vite. The API's Dockerfile will need to copy the mini-app build output. For development, the mini-app can run its own Vite dev server with proxy to the API.

## R5: Frontend Testing Stack

**Decision**: Vitest + jsdom + @testing-library/react

**Rationale**: Constitution mandates Vitest. `@testing-library/react` is the standard React testing library that encourages testing behavior over implementation. `jsdom` provides the browser environment for component rendering.

**Key testing patterns**:
- Mock `@twa-dev/sdk` with `vi.mock()` for WebApp context
- Mock `fetch`/HTTP client for API calls
- Use `renderHook` for custom hook testing (auth, API calls)
- Use `screen.getByRole`, `screen.getByText` for accessible queries
- Use `userEvent` for realistic user interaction simulation

## R6: React Router & SPA Navigation

**Decision**: React Router v7 with `createBrowserRouter` and `basename: '/app'`

**Rationale**: The app is served at `/app` path, so all client-side routes need that prefix. React Router v7's `basename` option handles this transparently. Two routes are needed: Home (`/app`) and Create/Edit List (`/app/lists/new`, `/app/lists/:id`).

**Route structure**:
```
/app           → Home (list of subscription lists)
/app/lists/new → Create new subscription list
/app/lists/:id → Edit existing subscription list
```

**Navigation**: Use `useNavigate()` for programmatic navigation after form submissions. Use `<Link>` for list item clicks. The Telegram `BackButton` integrates with router navigation for native-feeling back behavior.
