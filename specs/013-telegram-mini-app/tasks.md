# Tasks: Telegram Mini App (Frontend)

**Input**: Design documents from `/specs/013-telegram-mini-app/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — spec requests 4 test scenarios (auth flow, channel limit validation, add channel flow, CRUD state).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Transform the placeholder mini-app into a Vite + React + TypeScript project with all dependencies, configs, and shared infrastructure.

- [x] T001 Rewrite apps/mini-app/package.json — add dependencies: `react`, `react-dom`, `react-router-dom`, `@twa-dev/sdk`; add devDependencies: `@types/react`, `@types/react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@aggregator/eslint-config`, `@aggregator/tsconfig`, `eslint`, `@types/node`; update scripts: `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"`, `"test": "vitest run"`, `"lint": "eslint src/"`. Set `"type": "module"`. **IMPORTANT**: All dependency versions MUST be pinned to exact versions (no `^` or `~` prefixes) per Constitution Principle I. Use `pnpm add --save-exact` or manually remove range prefixes.
- [x] T002 Create apps/mini-app/tsconfig.json — extend `@aggregator/tsconfig/tsconfig.base.json`, set `compilerOptions`: `{ "jsx": "react-jsx", "noEmit": true, "baseUrl": "." }`, include `["src", "test"]`.
- [x] T003 Create apps/mini-app/vite.config.ts — configure `@vitejs/plugin-react`, set `base: '/app'`, add `server.proxy` for `/auth`, `/channels`, `/subscription-lists`, `/health` paths to `http://localhost:3000`, set `build.outDir: 'dist'`, set `test` config with `environment: 'jsdom'`, `setupFiles: './test/setup.ts'`, and `globals: true`.
- [x] T004 [P] Rewrite apps/mini-app/index.html — add `<div id="root"></div>`, add `<script type="module" src="/src/main.tsx"></script>`, add `<script src="https://telegram.org/js/telegram-web-app.js"></script>` in head.
- [x] T005 [P] Create apps/mini-app/eslint.config.js — import and extend `@aggregator/eslint-config`, add React-specific rules if needed (or use a minimal flat config that extends the shared config).
- [x] T006 [P] Create apps/mini-app/test/setup.ts — import `@testing-library/jest-dom`, mock `@twa-dev/sdk` globally with `vi.mock()` providing default `WebApp.initData`, `WebApp.ready`, `WebApp.expand`, `WebApp.close`, `WebApp.BackButton`, `WebApp.MainButton`, and `WebApp.themeParams` stubs.
- [x] T007 Run `pnpm install` from repo root to install all new dependencies, then verify `pnpm turbo run build --filter=@aggregator/mini-app` succeeds (even if build is just Vite producing an empty app).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the shared types, API client with auth retry, Telegram SDK helpers, global CSS, and auth context that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T008 Create apps/mini-app/src/types/index.ts — define and export all TypeScript interfaces from data-model.md: `AuthResponse`, `UserProfile`, `SourceChannel`, `SubscriptionList`, `ApiError`, `AuthState`, `ListFormState`, `AddChannelState`.
- [x] T009 Create apps/mini-app/src/lib/telegram.ts — export helper functions: `getTelegramInitData(): string | undefined` (reads `WebApp.initData`, returns undefined if empty/outside Telegram), `isTelegramEnvironment(): boolean`, `telegramReady()` (calls `WebApp.ready()` + `WebApp.expand()`), `showBackButton(onClick: () => void)` / `hideBackButton()` wrappers for `WebApp.BackButton`.
- [x] T010 Create apps/mini-app/src/lib/api-client.ts — export `createApiClient(getToken, setToken, getInitData)` factory that returns `{ get, post, patch, del }` methods. Each method: attaches `Authorization: Bearer <token>` header, on 401 response re-authenticates by POSTing initData to `/auth/validate`, updates token, retries original request once. Base URL derived from `import.meta.env.VITE_API_URL || ''`. All methods parse JSON response and throw typed `ApiError` on non-ok status.
- [x] T011 Create apps/mini-app/src/context/AuthContext.tsx — create `AuthContext` and `AuthProvider` component. On mount: check `isTelegramEnvironment()` (if false, set error state). If in Telegram: call `telegramReady()`, POST `initData` to `/auth/validate` via api-client, store `{ token, user }` in state. Export `useAuth()` hook that returns `AuthState` + `logout` method. Provide `getToken`/`setToken`/`getInitData` callbacks to api-client for 401 retry.
- [x] T011a [P] Write tests for api-client in apps/mini-app/test/api-client.spec.ts — test cases: (1) attaches Authorization header to requests, (2) on 401 response re-authenticates by POSTing initData and retries original request, (3) does not retry more than once on repeated 401, (4) throws typed ApiError on non-ok non-401 response, (5) uses VITE_API_URL as base URL when set. Mock `fetch` globally.
- [x] T011b [P] Write tests for telegram helpers in apps/mini-app/test/telegram.spec.ts — test cases: (1) `getTelegramInitData()` returns initData string when in Telegram, (2) `getTelegramInitData()` returns undefined when initData is empty, (3) `isTelegramEnvironment()` returns true when WebApp.initData is non-empty, (4) `isTelegramEnvironment()` returns false when WebApp.initData is empty, (5) `telegramReady()` calls WebApp.ready() and WebApp.expand(). Mock `@twa-dev/sdk`.
- [x] T012 Create apps/mini-app/src/styles/global.css — CSS reset using Telegram theme variables: set `body` background to `var(--tg-theme-bg-color)`, color to `var(--tg-theme-text-color)`, font-family to `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`. Style inputs with `var(--tg-theme-secondary-bg-color)` background and `var(--tg-theme-text-color)` text. Style buttons with `var(--tg-theme-button-color)` background and `var(--tg-theme-button-text-color)` text. Add `.error` class using `var(--tg-theme-destructive-text-color)`. Add `.hint` class using `var(--tg-theme-hint-color)`. Add fallback values for development outside Telegram.
- [x] T013 Create apps/mini-app/src/components/ErrorMessage.tsx — component that accepts `message: string | null` prop and renders an inline error using `var(--tg-theme-destructive-text-color)`. Returns null when message is null/empty.
- [x] T014 Create apps/mini-app/src/components/LoadingSpinner.tsx — simple loading indicator component using Telegram theme colors.
- [x] T015 Create apps/mini-app/src/components/TelegramGuard.tsx — component that wraps children and checks `isTelegramEnvironment()`. If outside Telegram, renders a full-screen message: "This app must be opened inside Telegram." If inside, renders children.
- [x] T016 Create apps/mini-app/src/hooks/useApi.ts — hook that consumes `useAuth()` to get token/initData, creates and memoizes the api-client instance, returns `{ get, post, patch, del }` methods.
- [x] T017 Create apps/mini-app/src/router.tsx — configure React Router with `createBrowserRouter` and `basename: '/app'`. Routes: `/` → `HomePage`, `/lists/new` → `ListFormPage`, `/lists/:id` → `ListFormPage`. Wrap all routes with `AuthProvider` and `TelegramGuard` via a layout route.
- [x] T018 Create apps/mini-app/src/App.tsx — root component that renders the `RouterProvider` from router.tsx.
- [x] T019 Rewrite apps/mini-app/src/main.tsx — import `global.css`, render `<App />` into `document.getElementById('root')` with `createRoot`.

**Checkpoint**: Foundation ready — app boots, authenticates, and renders an empty router shell. No screens yet.

---

## Phase 3: User Story 1 — Authentication and Home Screen (Priority: P1) 🎯 MVP

**Goal**: Users open the Mini App, authenticate automatically, and see their subscription lists (or empty state).

**Independent Test**: Open the Mini App → auth completes → Home screen displays lists or empty state.

### Tests for User Story 1

- [x] T020 [P] [US1] Write auth flow tests in apps/mini-app/test/auth.spec.tsx — test cases: (1) successful auth stores token and user in context, (2) renders loading state during auth, (3) shows error when backend unreachable (mock fetch rejection), (4) shows "must open in Telegram" when initData is empty, (5) re-authenticates on 401 response — mock fetch to return 401 first, then 200 on retry. Use `renderHook` with `AuthProvider` wrapper, mock `@twa-dev/sdk` and `fetch`.
- [x] T021 [P] [US1] Write Home screen tests in apps/mini-app/test/home.spec.tsx — test cases: (1) renders subscription list cards with name, destination, source count, and active badge, (2) renders empty state with "Create your first list" prompt when no lists, (3) shows loading spinner while fetching lists, (4) shows error message when fetch fails. Mock `useApi` to return controlled responses.

### Implementation for User Story 1

- [x] T022 [US1] Create apps/mini-app/src/hooks/useSubscriptionLists.ts — hook that fetches `GET /subscription-lists` via `useApi`, returns `{ lists, isLoading, error, refetch }`. Called on mount.
- [x] T023 [P] [US1] Create apps/mini-app/src/components/SubscriptionListCard.tsx — displays a single subscription list: name (bold), destination channel username, source channel count (e.g., "5 channels"), and active/inactive badge. Clickable — navigates to `/lists/:id` on tap.
- [x] T024 [P] [US1] Create apps/mini-app/src/components/EmptyState.tsx — displays "No subscription lists yet" message with a "Create your first list" call-to-action that navigates to `/lists/new`.
- [x] T025 [US1] Create apps/mini-app/src/pages/HomePage.tsx — uses `useSubscriptionLists()` hook. Shows `LoadingSpinner` while loading. On error, shows `ErrorMessage`. When loaded: if lists empty → `EmptyState`, else → list of `SubscriptionListCard`. Has a "Create List" floating button at the bottom that navigates to `/lists/new`. The button is disabled with "Premium" label when the user has reached their list limit. Store `hasReachedListLimit` as a `useRef<boolean>(false)` so it persists across re-renders and navigation within the SPA session; set it to `true` when ListFormPage reports a 403 via a callback or navigation state, and reset to `false` when a list is successfully deleted (freeing up a slot).

**Checkpoint**: MVP complete — user authenticates and sees their lists. All US1 tests pass.

---

## Phase 4: User Story 2 — Create and Edit Subscription Lists (Priority: P2)

**Goal**: Users can create new subscription lists and edit existing ones, including source channel selection and adding new channels.

**Independent Test**: Create a list with source channels → verify it appears on Home. Edit it → verify changes persist.

### Tests for User Story 2

- [x] T026 [P] [US2] Write list form tests in apps/mini-app/test/list-form.spec.tsx — test cases: (1) Create form renders empty fields, (2) Edit form pre-fills with existing list data, (3) channel count shows "N/30" and prevents selection beyond 30, (4) form submission calls POST /subscription-lists with correct payload, (5) edit submission calls PATCH /subscription-lists/:id, (6) shows validation errors from backend inline, (7) shows "Maximum list limit reached" on 403, (8) navigates to Home on successful submit. Mock `useApi`, `useChannels`, and `useNavigate`.
- [x] T027 [P] [US2] Write add channel tests in apps/mini-app/test/add-channel.spec.tsx — test cases: (1) successful add shows new channel in selector and auto-selects it, (2) shows inline error when bot is not admin (mock 422), (3) shows inline error for invalid username format, (4) clears error when retrying. Mock `useApi`.

### Implementation for User Story 2

- [x] T028 [US2] Create apps/mini-app/src/hooks/useChannels.ts — hook that fetches `GET /channels` via `useApi`, returns `{ channels, isLoading, error, addChannel }`. The `addChannel(username: string)` method calls `POST /channels`, on success adds the returned channel to the local channels list and returns it, on error throws with the API error message.
- [x] T029 [US2] Create apps/mini-app/src/components/ChannelSelector.tsx — multi-select component that receives `channels: SourceChannel[]`, `selectedIds: Set<string>`, `onToggle: (id: string) => void`, `maxChannels: number` (default 30). Renders a scrollable list of channels with checkboxes. Shows count indicator "N/30". Disables unchecked channels when at max. Each channel shows username and title.
- [x] T030 [US2] Create apps/mini-app/src/components/AddChannelForm.tsx — inline form with a text input for @username and submit button. On submit: strips `@` prefix, validates format (5-32 alphanumeric + underscore), calls `addChannel` from parent callback. Shows `LoadingSpinner` during request. Shows `ErrorMessage` on failure. On success: clears input, calls `onChannelAdded(channel)` callback.
- [x] T031 [US2] Create apps/mini-app/src/pages/ListFormPage.tsx — shared Create/Edit page. Reads `:id` from route params — if present, fetches existing list and pre-fills form (edit mode); if absent, starts with empty form (create mode). Fields: list name (text input), destination channel ID (number input), destination username (text input), `ChannelSelector` for source channels, `AddChannelForm`. Shows "Back" via Telegram `BackButton`. On submit: validates client-side (name required, destination required, at least 1 channel), then calls POST (create) or PATCH (edit) via `useApi`. On success: navigates to `/`. On 403: shows "Maximum list limit reached" error. On other errors: shows inline messages near relevant fields. Integrates `useChannels` hook for fetching and adding channels.

**Checkpoint**: Users can create and edit subscription lists with full channel management. All US2 tests pass.

---

## Phase 5: User Story 3 — Delete Subscription Lists (Priority: P3)

**Goal**: Users can delete subscription lists with a confirmation step.

**Independent Test**: Delete a list from the Edit form → confirm → verify it's gone from Home.

### Implementation for User Story 3

- [x] T032 [US3] Add delete functionality to apps/mini-app/src/pages/ListFormPage.tsx — in edit mode, add a "Delete" button styled with `var(--tg-theme-destructive-text-color)`. On tap, show a confirmation dialog (use `WebApp.showConfirm` from @twa-dev/sdk if available, otherwise a simple custom modal). On confirm: call `DELETE /subscription-lists/:id` via `useApi`, on success navigate to Home. On cancel: dismiss dialog, stay on form.
- [x] T033 [US3] Update apps/mini-app/src/hooks/useSubscriptionLists.ts — add `deleteList(id: string)` method that calls `DELETE /subscription-lists/:id` via `useApi` and removes the list from local state.

**Checkpoint**: Full CRUD lifecycle complete. Users can create, view, edit, and delete subscription lists.

---

## Phase 6: User Story 4 — Native Telegram Appearance (Priority: P4)

**Goal**: The app visually integrates with Telegram by using theme variables for all styling.

**Independent Test**: Open app in light and dark Telegram themes → verify visual adaptation.

### Implementation for User Story 4

- [x] T034 [US4] Polish apps/mini-app/src/styles/global.css — ensure comprehensive theme coverage: section headers use `var(--tg-theme-section-header-text-color)`, subtitles use `var(--tg-theme-subtitle-text-color)`, links use `var(--tg-theme-link-color)`, card backgrounds use `var(--tg-theme-section-bg-color)`, input focus outlines use `var(--tg-theme-accent-text-color)`. Add smooth transitions for theme changes. Ensure all components (cards, buttons, inputs, badges) use only Telegram theme variables — no hardcoded colors.
- [x] T035 [US4] Review and update all components in apps/mini-app/src/components/ and apps/mini-app/src/pages/ — verify every component uses Telegram theme CSS variables for colors, backgrounds, borders. Replace any hardcoded color values. Verify active/inactive badge uses appropriate theme colors (accent for active, hint for inactive). Verify the premium label uses hint color.

**Checkpoint**: App visually matches native Telegram in both light and dark themes.

---

## Phase 7: API Static Serving & Build Integration

**Purpose**: Configure the NestJS API to serve the built mini-app and update the Dockerfile.

- [x] T036 Install `@nestjs/serve-static` in apps/api — run `pnpm --filter @aggregator/api add @nestjs/serve-static`.
- [x] T037 Update apps/api/src/app.module.ts — import `ServeStaticModule` from `@nestjs/serve-static` and `join` from `node:path`. Add `ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', '..', 'mini-app', 'dist'), serveRoot: '/app', serveStaticOptions: { index: false }, renderPath: '/app*' })` to the imports array.
- [x] T038 Update apps/mini-app/Dockerfile — rewrite as multi-stage: (1) builder stage uses `node:22-alpine`, copies repo, installs deps with pnpm, runs `pnpm --filter @aggregator/mini-app build`; (2) runner stage uses `nginx:alpine`, copies `dist/` to nginx html dir with appropriate config for SPA fallback (try_files $uri /index.html). Add `HEALTHCHECK CMD wget -q --spider http://localhost:80/ || exit 1`.
- [x] T038a Update apps/api/Dockerfile — add a build stage that builds the mini-app (`pnpm --filter @aggregator/mini-app build`) and copy `apps/mini-app/dist/` into the API image at the path matching ServeStaticModule's `rootPath` (relative to the API's compiled output). This ensures the API container can serve the mini-app at `/app` in production without a separate nginx container.

**Checkpoint**: API serves the mini-app at `/app`. Docker build produces a working image.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verify full build, test suite, and lint pass across the monorepo.

- [x] T039 Run `pnpm turbo run build` and fix any build errors across all packages
- [x] T040 Run `pnpm turbo run test` and verify all tests pass (mini-app + existing API + worker + shared)
- [x] T041 Run `pnpm turbo run lint` and fix any lint issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion (project must be initialized)
- **User Story 1 (Phase 3)**: Depends on Foundational — this is the MVP
- **User Story 2 (Phase 4)**: Depends on US1 (needs HomePage for navigation, auth context)
- **User Story 3 (Phase 5)**: Depends on US2 (needs ListFormPage for delete button placement)
- **User Story 4 (Phase 6)**: Can start after Foundational but best done after all components exist (US1-US3)
- **API Static Serving (Phase 7)**: Independent of user stories — can run in parallel with US2+
- **Polish (Phase 8)**: Depends on all phases being complete

### Within Each Phase

#### Phase 1 (Setup)
- T001 → T002 → T003 sequential (package.json → tsconfig → vite config)
- T004, T005, T006 parallel (different files, no deps on T001-T003 content)
- T007 depends on all of T001-T006

#### Phase 2 (Foundational)
- T008 first (types used by everything)
- T009, T012, T013, T014 parallel after T008 (different files)
- T010 after T008 (uses types)
- T011 after T009, T010 (uses telegram helpers + api-client)
- T015 after T009 (uses telegram.ts)
- T016 after T010, T011 (uses api-client + auth context)
- T017 after T015, T018 (needs TelegramGuard and App)
- T018 after T017 (needs router)
- T019 after T018 (needs App)

#### Phase 3 (US1)
- T020, T021 parallel (different test files)
- T022 first impl task (hook needed by HomePage)
- T023, T024 parallel (different components)
- T025 after T022, T023, T024 (composes them)

#### Phase 4 (US2)
- T026, T027 parallel (different test files)
- T028 first impl task (channels hook)
- T029 after T028 (uses channels data)
- T030 after T028 (uses addChannel)
- T031 after T028, T029, T030 (composes all)

#### Phase 5 (US3)
- T032 after T031 (modifies ListFormPage)
- T033 can parallel with T032 (different file)

### Parallel Opportunities

```
Phase 1:
  T001 → T002 → T003 (sequential: dep chain)
  T004 || T005 || T006 (parallel: different files)
  T007 (after all above)

Phase 2:
  T008 (first)
  T009 || T012 || T013 || T014 (parallel after T008)
  T010 (after T008)
  T011 (after T009, T010)
  T015 (after T009)
  T016 (after T010, T011)
  T017 → T018 → T019 (sequential: router → App → main)

Phase 3 (US1):
  T020 || T021 (parallel test files)
  T022 (hook)
  T023 || T024 (parallel components)
  T025 (page, after T022-T024)

Phase 4 (US2):
  T026 || T027 (parallel test files)
  T028 (hook)
  T029 || T030 (parallel components, after T028)
  T031 (page, after T028-T030)

Phase 5 (US3):
  T032 || T033 (parallel: different files)

Phase 7:
  T036 → T037 (sequential: install then configure)
  T038 (parallel with T036-T037: different app)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T019)
3. Complete Phase 3: US1 — Auth + Home Screen (T020-T025)
4. **STOP and VALIDATE**: App authenticates and shows subscription lists
5. This is a deployable MVP

### Incremental Delivery

1. Setup + Foundational → React app boots, authenticates, renders shell
2. US1 (Home Screen) → MVP deployed, users can view their lists
3. US2 (Create/Edit) → Core CRUD functionality
4. US3 (Delete) → Complete lifecycle management
5. US4 (Theme Polish) → Native Telegram appearance
6. API Static Serving → Production deployment path
7. Polish → Full monorepo verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- The spec explicitly requests tests for: auth flow, channel limit validation, add channel flow, CRUD state
- Additional lib-level tests (api-client.spec.ts, telegram.spec.ts) added per Constitution Principle II (new source files MUST have corresponding test files)
- Constitution Principle III (pino logging) is EXEMPT for this frontend SPA — pino is server-only. ESLint `no-console` rule enforced instead
- All components use Telegram CSS theme variables — no external CSS framework (Tailwind, etc.)
- JWT stored in memory only — never localStorage/sessionStorage (FR-002)
- The api-client handles 401 retry transparently (FR-017)
- `@twa-dev/sdk` provides typed access to `window.Telegram.WebApp` API
- Existing backend endpoints are consumed as-is — only API-side change is adding ServeStaticModule
- The mini-app Dockerfile is independent of the API Dockerfile
- Phase 7 (API serving) can run in parallel with user story work since it's a separate app
