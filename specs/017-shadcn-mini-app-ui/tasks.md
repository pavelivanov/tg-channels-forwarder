# Tasks: Shadcn Mini App UI

**Input**: Design documents from `/specs/017-shadcn-mini-app-ui/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Constitution requires tests for all new source files. Existing tests must continue passing (NFR-003). Test for `utils.ts` is included (T010). shadcn UI components (`src/components/ui/`) are vendored/generated code — exempted from test requirement (see plan.md Complexity Tracking).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install Tailwind CSS v4, shadcn/ui, and configure the build toolchain

- [x] T001 Install Tailwind CSS v4 and Vite plugin as devDependencies in `apps/mini-app`: `pnpm add -D tailwindcss @tailwindcss/vite` (from `apps/mini-app` directory)
- [x] T002 Install shadcn runtime dependencies in `apps/mini-app`: `pnpm add class-variance-authority clsx tailwind-merge lucide-react tw-animate-css`
- [x] T003 Add `@/*` path alias to `apps/mini-app/tsconfig.json`: add `"paths": { "@/*": ["./src/*"] }` to `compilerOptions`
- [x] T004 Update `apps/mini-app/vite.config.ts`: add `tailwindcss()` to plugins array (import from `@tailwindcss/vite`), add `resolve.alias` mapping `"@"` to `path.resolve(__dirname, "./src")` (import `path` from `node:path`)
- [x] T005 Create `apps/mini-app/src/lib/utils.ts` with the `cn()` utility function: import `clsx` and `twMerge`, export `cn(...inputs: ClassValue[]) => twMerge(clsx(inputs))`
- [x] T006 Create `apps/mini-app/components.json` with shadcn configuration: `style: "new-york"`, `rsc: false`, `tsx: true`, `tailwind.css: "src/styles/global.css"`, `tailwind.config: ""`, `cssVariables: true`, `aliases.components: "@/components"`, `aliases.utils: "@/lib/utils"`, `aliases.ui: "@/components/ui"`, `aliases.lib: "@/lib"`, `aliases.hooks: "@/hooks"`, `iconLibrary: "lucide"`

**Checkpoint**: Build toolchain configured — `pnpm turbo run build --filter=@aggregator/mini-app` should still succeed (no component changes yet)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Replace `global.css` with Tailwind v4 + Telegram theme mapping, install all shadcn UI components, and test new utility code

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Replace `apps/mini-app/src/styles/global.css` with Tailwind v4 globals: add `@import "tailwindcss"` and `@import "tw-animate-css"`, define `:root` block mapping shadcn semantic tokens (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`) to Telegram `--tg-theme-*` variables with hex fallbacks (per plan.md Key Design Decision #1), add `@theme inline {}` block mapping all semantic tokens to Tailwind color utilities (`--color-background: var(--background)`, etc.), add `@layer base` block with `body { @apply bg-background text-foreground }` and base border/outline styles, preserve essential resets (box-sizing, font-family, input/button base styles) but remove all old `.error`, `.hint`, `.container` classes and old `:root` variable aliases
- [x] T008 Install shadcn UI components by running `npx shadcn@latest add button card input label checkbox badge separator skeleton` from `apps/mini-app/` directory — this creates `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `checkbox.tsx`, `badge.tsx`, `separator.tsx`, `skeleton.tsx`
- [x] T009 Verify shadcn components were generated correctly: confirm all 8 files exist in `apps/mini-app/src/components/ui/`, confirm they import from `@/lib/utils`, confirm `cn()` is used for class merging
- [x] T010 Write unit test for `cn()` in `apps/mini-app/test/utils.spec.ts`: test that `cn()` merges class names correctly (e.g., `cn("px-2", "py-1")` → `"px-2 py-1"`), test that conflicting Tailwind classes are resolved (e.g., `cn("px-2", "px-4")` → `"px-4"`), test that conditional classes work (e.g., `cn("base", false && "hidden")` → `"base"`)

**Checkpoint**: Foundation ready — `pnpm turbo run build --filter=@aggregator/mini-app` succeeds, Tailwind processes the new CSS, all shadcn components are available for import, `cn()` test passes

---

## Phase 3: User Story 1 — Polished Component Library Integration (Priority: P1) MVP

**Goal**: Migrate all existing components and pages from inline styles to shadcn/ui components and Tailwind utility classes. The app looks visually cohesive and respects Telegram themes.

**Independent Test**: Open the Mini App in Telegram (light + dark themes). All pages render with consistent shadcn-styled components. No inline `style={{}}` attributes remain (except layout-specific ones like flex direction).

### Implementation for User Story 1

- [x] T011 [P] [US1] Migrate `apps/mini-app/src/components/ErrorMessage.tsx`: remove `className="error"` usage, replace with Tailwind classes (`text-sm text-destructive`), remove all inline style objects, keep the component's `null`-when-empty behavior
- [x] T012 [P] [US1] Migrate `apps/mini-app/src/components/LoadingSpinner.tsx`: remove the injected `<style>` tag with `@keyframes pulse` (FR-011), replace the three-dot animation with either a shadcn `Skeleton` component or Tailwind's `animate-pulse` class, add `role="status"` and `aria-label="Loading"` for accessibility (FR-008), remove all inline style objects
- [x] T013 [P] [US1] Migrate `apps/mini-app/src/components/EmptyState.tsx`: replace inline styles with Tailwind classes, replace the `<button>` with shadcn `<Button>`, keep existing props and navigation behavior
- [x] T014 [US1] Migrate `apps/mini-app/src/components/SubscriptionListCard.tsx`: replace the outer `<div role="button">` with shadcn `<Card>` + `<CardContent>`, replace the badge `<span>` with shadcn `<Badge variant="...">`, add touch/press feedback via Tailwind `active:` modifier (e.g., `active:scale-[0.98]` or `active:opacity-80`) (FR-010), remove all module-level `const` style objects (containerStyle, badgeBase, etc.), preserve `onClick`, `onKeyDown`, `tabIndex`, and `role` accessibility attributes
- [x] T015 [US1] Migrate `apps/mini-app/src/components/TelegramGuard.tsx`: replace all inline style objects with Tailwind classes for centering (`flex items-center justify-center min-h-screen`), use the migrated `LoadingSpinner` and `ErrorMessage` components, remove all `React.CSSProperties` const declarations
- [x] T016 [US1] Migrate `apps/mini-app/src/pages/HomePage.tsx`: replace the header `<div>` with Tailwind-styled heading, replace the floating action button with shadcn `<Button>` positioned with Tailwind (`fixed bottom-4 left-4 right-4`), remove the `paddingBottom: 80` magic number (use `pb-20` via Tailwind), remove the dead `<div style={premiumLabelStyle} />` element, replace inline style objects (`headerStyle`, `sectionStyle`, `fabContainerStyle`, etc.) with Tailwind classes, use the migrated `SubscriptionListCard`, `LoadingSpinner`, `ErrorMessage`, and `EmptyState` components
- [x] T017 [P] [US1] Migrate `apps/mini-app/src/components/AddChannelForm.tsx`: replace `<input>` with shadcn `<Input>`, replace `<button>` with shadcn `<Button variant="secondary" size="sm">`, replace inline styles with Tailwind classes, change loading indicator from `'...'` text to `'Adding...'` or a small spinner, preserve `onKeyDown` Enter-to-submit behavior
- [x] T018 [P] [US1] Migrate `apps/mini-app/src/components/ChannelSelector.tsx`: replace `<input type="checkbox">` with shadcn `<Checkbox>` (Radix-based, styled) (FR-007), wrap each channel row in a flex container with shadcn `<Label>`, replace the `maxHeight: 240` inline style with Tailwind `max-h-60 overflow-y-auto`, replace the selection count hint with Tailwind-styled text, remove all inline style objects
- [x] T019 [US1] Migrate `apps/mini-app/src/pages/ListFormPage.tsx`: wrap each form section in shadcn `<Card>` + `<CardContent>`, replace `<input>` elements with shadcn `<Input>` + `<Label>`, replace all `<button>` elements with shadcn `<Button variant="...">` (primary for save, `variant="destructive"` for delete using `variant="ghost"` + destructive text), replace inline styles (`sectionStyle`, `labelStyle`, `inputStyle`, `buttonStyle`) with Tailwind classes, preserve `WebApp.showConfirm` for delete confirmation (FR-013), preserve back button behavior
- [x] T020 [US1] Update `apps/mini-app/src/main.tsx` if the CSS import path changed (verify `./styles/global.css` still resolves correctly after the global.css rewrite)
- [x] T021 [US1] Run existing tests: execute `pnpm turbo run test --filter=@aggregator/mini-app` and fix any test failures caused by changed DOM structure or missing CSS class selectors in `apps/mini-app/test/`

**Checkpoint**: All components and pages use shadcn/ui and Tailwind classes. Zero inline `style={{}}` on components (layout exceptions acceptable). App looks cohesive in Telegram light and dark themes.

---

## Phase 4: User Story 2 — Improved Form Experience (Priority: P2)

**Goal**: Add field-level validation feedback, styled checkboxes with clear states, and loading indicators on form actions.

**Independent Test**: Open "Create List" page, submit with empty name — see field-level error on the name input. Select channels with styled checkboxes. Add a channel by username and see inline success/error feedback.

### Implementation for User Story 2

- [x] T022 [US2] Add field-level validation to `apps/mini-app/src/pages/ListFormPage.tsx`: introduce per-field error state (e.g., `nameError` string), on save attempt with empty name set `nameError` and apply `border-destructive` class to the name `<Input>`, display error text below the input (`<p className="text-sm text-destructive">`), clear field error when user starts typing (FR-006)
- [x] T023 [US2] Enhance save button loading state in `apps/mini-app/src/pages/ListFormPage.tsx`: when saving, disable the `<Button>` and show a loading indicator (e.g., `<Loader2 className="animate-spin" />` icon from lucide-react next to "Saving..." text) instead of just text change
- [x] T024 [US2] Enhance `apps/mini-app/src/components/AddChannelForm.tsx` feedback: show inline error message below the input (using `text-sm text-destructive`) when add-channel fails, show brief success feedback when channel is added (e.g., input clears — already implemented, but add a subtle visual confirmation), improve the loading state from `'...'` to a disabled button with `'Adding...'` text

**Checkpoint**: Form fields show inline validation errors. Save button has a proper loading state with spinner. Channel add shows clear success/error feedback.

---

## Phase 5: User Story 3 — Enhanced List Browsing and Feedback (Priority: P3)

**Goal**: Polish the home page with icons in empty state, skeleton loading, and card touch feedback.

**Independent Test**: Open home page with no lists — see an icon in the empty state. Navigate with lists — see styled cards with touch feedback. During loading — see skeleton placeholders.

### Implementation for User Story 3

- [x] T025 [P] [US3] Add icon to `apps/mini-app/src/components/EmptyState.tsx`: import an appropriate icon from `lucide-react` (e.g., `ListPlus` or `Inbox`), render it above the text message with muted foreground color and appropriate size (FR-009)
- [x] T026 [P] [US3] Add skeleton loading to `apps/mini-app/src/pages/HomePage.tsx`: when `isLoading` is true, render 2–3 shadcn `<Skeleton>` elements shaped like subscription list cards (matching card height and layout) instead of the `<LoadingSpinner>`, preserve the `LoadingSpinner` as fallback for non-card loading states (e.g., `TelegramGuard`)
- [x] T027 [US3] Verify touch feedback on `SubscriptionListCard` works on mobile: confirm the `active:` Tailwind modifier applied in T014 provides visible feedback within 100ms on touch devices (FR-010), adjust if needed (consider `transition-transform duration-100` for smooth scaling)

**Checkpoint**: Empty state has an icon. Loading shows skeleton cards. Cards have visible touch feedback.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Build verification, test fixes, bundle size validation, cleanup

- [x] T028 [P] Verify `pnpm turbo run build` passes for all packages (not just mini-app)
- [x] T029 [P] Verify `pnpm turbo run lint` passes for `apps/mini-app` — fix any ESLint errors in modified files
- [x] T030 Run `pnpm turbo run test` across all packages and fix any remaining test failures in `apps/mini-app/test/`
- [x] T031 Measure production bundle size: run `pnpm turbo run build --filter=@aggregator/mini-app`, compare output JS+CSS gzipped size against pre-migration baseline, verify increase is under 50 kB (NFR-001)
- [x] T032 Remove dead code: delete any remaining unused inline style `const` declarations, unused CSS classes from old `global.css`, and the empty `premiumLabelStyle` div from `HomePage.tsx` (if not already removed in T016)
- [x] T033 Run quickstart.md scenarios TS1–TS3 (Tailwind setup, light theme, dark theme) and TS10 (responsive layout at 320px, 375px, 428px widths) manually to validate visual correctness (SC-004); verify WCAG AA contrast on the inactive badge (SC-005) and key text/background combinations in both light and dark Telegram themes (NFR-002)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001–T006 complete)
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T007–T010 complete) — the new CSS, shadcn components, and tested utils must exist before migration
- **User Story 2 (Phase 4)**: Depends on Phase 3 (US1 complete) — form improvements build on the migrated components
- **User Story 3 (Phase 5)**: Depends on Phase 3 (US1 complete) — home page enhancements build on migrated components. Can run in parallel with US2 (different files)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational phase — no dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 — uses the migrated form components from `ListFormPage.tsx` and `AddChannelForm.tsx`
- **User Story 3 (P3)**: Depends on US1 — uses the migrated `EmptyState.tsx`, `HomePage.tsx`, and `SubscriptionListCard.tsx`. Can run in parallel with US2 since they modify different files

### Within Each Phase

- Phase 1: T001 → T002 → T003/T004 (parallel) → T005 → T006
- Phase 2: T007 → T008 → T009 → T010
- Phase 3: T011/T012/T013 (parallel, different files) → T014 → T015 → T016 → T017/T018 (parallel) → T019 → T020 → T021
- Phase 4: T022 → T023 → T024
- Phase 5: T025/T026 (parallel, different files) → T027
- Phase 6: T028/T029 (parallel) → T030 → T031 → T032 → T033

### Parallel Opportunities

- T003 and T004 can run in parallel (different files: tsconfig.json vs vite.config.ts)
- T011, T012, T013 can run in parallel (different component files, no cross-dependencies)
- T017 and T018 can run in parallel (different component files)
- T025 and T026 can run in parallel (different files: EmptyState.tsx vs HomePage.tsx)
- T028 and T029 can run in parallel (build vs lint)
- US2 and US3 can run in parallel after US1 completes (different files)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install deps, configure toolchain)
2. Complete Phase 2: Foundational (new CSS, install shadcn components, test utils)
3. Complete Phase 3: User Story 1 (migrate all components to shadcn)
4. **STOP and VALIDATE**: Open app in Telegram, verify light/dark themes, run tests
5. This is a fully functional, visually cohesive app without the form UX and polish enhancements

### Incremental Delivery

1. Setup + Foundational → Build works with new toolchain
2. Add US1 → All components migrated to shadcn (MVP!)
3. Add US2 → Form UX improved with field-level validation
4. Add US3 → Home page polished with icons, skeletons, touch feedback
5. Polish → Build/lint/test verification, bundle size check, responsive + WCAG validation

---

## Notes

- All tasks modify files within `apps/mini-app/` — no other packages affected
- shadcn components in `src/components/ui/` are generated by the CLI and may need minor edits to match Telegram theme patterns
- shadcn UI components are vendored/generated code — exempted from per-file test requirement (justified in plan.md Complexity Tracking)
- The `global.css` rewrite (T007) is the most critical task — it defines the entire theme integration
- Most Phase 3 tasks modify different files and can be parallelized
- No Prisma schema changes, no API changes, no worker changes
- The `components.json` (T006) is required for the `npx shadcn@latest add` command (T008) to know where to place components
