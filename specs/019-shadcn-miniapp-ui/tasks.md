# Tasks: Shadcn Mini App UI/UX

**Input**: Design documents from `/specs/019-shadcn-miniapp-ui/`
**Prerequisites**: plan.md (required), spec.md (required), research.md

**Tests**: Tests will be updated in the Polish phase since existing tests need migration (not TDD for a UI reskin).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install Tailwind CSS v4, shadcn/ui, configure path aliases, and establish the theming foundation

- [x] T001 Install Tailwind CSS v4 dependencies (`tailwindcss`, `@tailwindcss/vite`) and utility dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `lucide-react`) in `apps/mini-app/package.json`
- [x] T002 Add `@tailwindcss/vite` plugin to `apps/mini-app/vite.config.ts` and add `@/*` path alias via `resolve.alias`
- [x] T003 Add `@/*` path alias to `apps/mini-app/tsconfig.json` via `compilerOptions.paths`
- [x] T004 Create `apps/mini-app/src/lib/utils.ts` with the `cn()` utility function (clsx + tailwind-merge)
- [x] T005 Replace `apps/mini-app/src/styles/global.css` with Tailwind v4 CSS entry: `@import "tailwindcss"`, `@import "tw-animate-css"`, `@theme inline { }` block mapping shadcn semantic tokens (--background, --foreground, --primary, --card, --muted, --destructive, --border, --ring, --radius, etc.) to Telegram `--tg-theme-*` variables via `var()` with fallbacks, plus base body styles. Remove all old global element rules (button, input, .error, .hint, .container)
- [x] T006 Initialize shadcn/ui by creating `apps/mini-app/components.json` with new-york style, tailwindcss v4, `@/lib/utils` alias, `@/components/ui` component path, and `@/styles/global.css` as the CSS file
- [x] T007 Install shadcn/ui components by running `npx shadcn@latest add button card badge input label skeleton sonner alert-dialog checkbox separator` from `apps/mini-app/`

**Checkpoint**: `pnpm turbo run build --filter=@aggregator/mini-app` succeeds. Tailwind classes are present in built CSS. shadcn components exist in `apps/mini-app/src/components/ui/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create shared UI primitives and the toast provider that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Add Sonner `<Toaster />` provider to `apps/mini-app/src/App.tsx` — import from `@/components/ui/sonner`, render alongside `<RouterProvider>`, configure with `toastOptions` that use shadcn theme tokens
- [x] T009 [P] Replace `apps/mini-app/src/components/LoadingSpinner.tsx` with a skeleton-based loading component: remove the inline `<style>` keyframe injection, export a `LoadingSpinner` that renders 3 card-shaped `<Skeleton>` placeholders using the shadcn Skeleton component and Tailwind classes
- [x] T010 [P] Rewrite `apps/mini-app/src/components/ErrorMessage.tsx` to use Tailwind classes (`text-destructive text-sm mt-1`) instead of the global `.error` CSS class
- [x] T011 [P] Rewrite `apps/mini-app/src/components/EmptyState.tsx` to use Tailwind layout classes (`flex flex-col items-center justify-center gap-4 py-16 text-center`) and shadcn `<Button>` instead of a bare `<button>` element with inline styles
- [x] T012 Rewrite `apps/mini-app/src/components/TelegramGuard.tsx` to use Tailwind classes (`flex flex-col items-center justify-center min-h-screen p-8 text-center gap-4`) instead of the inline `guardStyle` object

**Checkpoint**: Foundation ready. `<Toaster>` is mounted. Shared components render with Tailwind classes. No inline style objects remain in LoadingSpinner, ErrorMessage, EmptyState, or TelegramGuard.

---

## Phase 3: User Story 1 — View Subscription Lists with Polished UI (Priority: P1) 🎯 MVP

**Goal**: Home page displays subscription lists as styled cards with badges, skeleton loading, and styled empty state

**Independent Test**: Open mini-app → see styled cards with name, destination, channel count, active/inactive badge. Loading shows skeleton placeholders. Empty state shows icon + CTA button. Light/dark theme matches Telegram.

### Implementation for User Story 1

- [x] T013 [US1] Rewrite `apps/mini-app/src/components/SubscriptionListCard.tsx`: replace all inline style objects (`cardStyle`, `headerStyle`, `nameStyle`, `badgeBase`, `badgeStyle`, `detailStyle`) with Tailwind classes; use shadcn `<Card>`, `<CardContent>` for the container; use shadcn `<Badge>` with `variant` prop for active/inactive status; keep `useNavigate` click and keyboard handling
- [x] T014 [US1] Rewrite `apps/mini-app/src/pages/HomePage.tsx`: replace inline style objects (`headerStyle`, `fabStyle`, `premiumLabelStyle`) and `className="container"` with Tailwind classes; replace the `paddingBottom: 80` hack with `pb-20`; replace the FAB `<button>` with shadcn `<Button>` using `className="fixed bottom-6 left-4 right-4"`; remove the unused `premiumLabelStyle` div; use the updated `LoadingSpinner` (skeleton cards) for loading state

**Checkpoint**: Home page renders with shadcn Card + Badge components. Skeleton loading works. Empty state styled. No inline style objects remain in SubscriptionListCard or HomePage.

---

## Phase 4: User Story 2 — Create and Edit Lists with Improved Form UX (Priority: P2)

**Goal**: Form fields use shadcn Input/Label with inline validation, channel selector uses Checkbox with search filter, delete uses AlertDialog, success/error shown via toast

**Independent Test**: Navigate to create list → form shows shadcn-styled inputs with labels. Submit empty → inline errors below fields. Fill and submit → success toast + navigate home. Edit → delete button → AlertDialog confirmation. Channel selector has search filter and checkboxes.

### Implementation for User Story 2

- [x] T015 [US2] Rewrite `apps/mini-app/src/components/ChannelSelector.tsx`: replace inline style objects (`listStyle`, `itemStyle`, `countStyle`) with Tailwind classes; replace native `<input type="checkbox">` with shadcn `<Checkbox>` + `<Label>`; add a search/filter `<Input>` at the top that filters channels by title/username; replace `className="hint"` with `text-muted-foreground text-sm`
- [x] T016 [US2] Rewrite `apps/mini-app/src/components/AddChannelForm.tsx`: replace inline style objects (`formStyle`, `inputStyle`, `addBtnStyle`) with Tailwind flex layout; use shadcn `<Input>` and `<Button size="sm">` for the username input and add button; keep validation logic and error display; after a channel is successfully added, call `toast.success()` with the channel name to provide brief success indication (spec US2-AS5)
- [x] T017 [US2] Rewrite `apps/mini-app/src/pages/ListFormPage.tsx`: replace all inline style objects (`sectionStyle`, `labelStyle`, inline `style` props on h2/button) and `className="container"` with Tailwind classes (`space-y-6`, `font-semibold text-sm text-muted-foreground`); use shadcn `<Input>` + `<Label>` for Name and Destination fields; add inline validation errors below each field using `text-destructive text-sm`; replace `WebApp.showConfirm` delete dialog with shadcn `<AlertDialog>` + `<AlertDialogTrigger>` + `<AlertDialogAction>`; replace the inline-styled delete button with shadcn `<Button variant="outline" className="border-destructive text-destructive">`; add `toast()` calls (from `sonner`) for success/error feedback on create, save, and delete operations (including max-list-limit errors from the API); disable submit button and show a `<Loader2>` spinner icon while `isSubmitting` is true

**Checkpoint**: Form page uses shadcn components throughout. Delete shows AlertDialog. Submit shows loading spinner on button. Success/error operations trigger toast notifications. Channel selector has search filter and shadcn checkboxes.

---

## Phase 5: User Story 3 — Responsive Feedback and Loading States (Priority: P3)

**Goal**: Consistent visual feedback across all interactions — skeleton loading, toast notifications, button loading states

**Independent Test**: All create/edit/delete operations show toast on success and on error. Home page shows skeleton cards during load. API errors show destructive toast. Submit buttons show spinner + disabled state.

### Implementation for User Story 3

- [x] T018 [US3] Verify and refine skeleton loading in `apps/mini-app/src/pages/HomePage.tsx`: ensure skeleton cards match the visual dimensions of real `SubscriptionListCard` components (same border-radius, height, spacing); add a subtle shimmer animation via Tailwind
- [x] T019 [US3] Verify and refine toast notifications across `apps/mini-app/src/pages/ListFormPage.tsx`: ensure error toasts use `toast.error()` for destructive styling, success toasts use `toast.success()`, and messages are user-friendly (e.g., "List created", "List saved", "List deleted", "Failed to save list")
- [x] T020 [US3] Add error toast handling to `apps/mini-app/src/pages/HomePage.tsx`: when `useSubscriptionLists()` returns an error, show a `toast.error()` notification in addition to the inline error message; add a retry mechanism via a "Try again" button in the error state

**Checkpoint**: All user-initiated actions produce visual feedback within 200ms. Skeleton dimensions match real cards. Toast messages are descriptive and use correct severity styling.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Update tests, clean up, validate full build

- [x] T021 Enable the commented-out `test` section in `apps/mini-app/vite.config.ts` (lines 19-22): uncomment `environment: 'jsdom'` and `setupFiles: './test/setup.ts'`
- [x] T022 [P] Create `apps/mini-app/test/lib/utils.spec.ts`: test `cn()` utility merges class names correctly, handles conditional classes, and resolves Tailwind conflicts (e.g., `cn('px-2', 'px-4')` → `'px-4'`)
- [x] T023 [P] Update test files in `apps/mini-app/test/` to work with shadcn components: update component queries to use `getByRole('button')`, `getByRole('checkbox')`, `getByLabelText()` instead of tag selectors; verify specific scenarios — skeleton rendering on loading state, Badge variant for active/inactive, toast calls on form submit success/error (mock `sonner`'s `toast` export), AlertDialog renders on delete click, Button disabled + spinner while submitting
- [x] T024 [P] Remove all unused CSS from `apps/mini-app/src/styles/global.css`: verify no remaining references to old global classes (`.container`, `.error`, `.hint`) or bare element styles (`button { }`, `input { }`) in any component; the file should contain only the Tailwind import, theme block, and minimal base styles
- [x] T025 Run full build and lint validation: `pnpm turbo run build test lint --filter=@aggregator/mini-app` — all must pass with zero errors
- [x] T026 Run `apps/mini-app/` quickstart.md verification scenarios manually: theme integration (light/dark), skeleton loading, form validation, toast notifications, AlertDialog delete confirmation, and verify all interactive elements (buttons, inputs, checkboxes, cards) have visible focus rings via keyboard navigation (FR-013)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion; can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Phase 3 and Phase 4 completion (refines their output)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2. No dependencies on other stories.
- **User Story 2 (P2)**: Can start after Phase 2. Independent of US1 (different pages/components).
- **User Story 3 (P3)**: Depends on US1 and US2 being complete — it refines and validates their loading/feedback implementations.

### Within Each User Story

- Components before pages (pages import components)
- Shared components (Phase 2) before story-specific components
- Story complete before moving to next priority

### Parallel Opportunities

- T009, T010, T011 can run in parallel (different files, no dependencies)
- T013 and T015/T016 can run in parallel (different components, different stories)
- T022, T023, T024 can run in parallel in the Polish phase

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch these in parallel (all touch different files):
Task T009: "Replace LoadingSpinner with skeleton component"
Task T010: "Rewrite ErrorMessage with Tailwind classes"
Task T011: "Rewrite EmptyState with Tailwind + shadcn Button"
```

## Parallel Example: User Story 1 + User Story 2

```bash
# After Phase 2, these can run in parallel:
Task T013: "Rewrite SubscriptionListCard with Card + Badge"  (US1)
Task T015: "Rewrite ChannelSelector with Checkbox + search"  (US2)
Task T016: "Rewrite AddChannelForm with Input + Button"      (US2)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T007)
2. Complete Phase 2: Foundational (T008–T012)
3. Complete Phase 3: User Story 1 (T013–T014)
4. **STOP and VALIDATE**: Open mini-app, verify styled cards, skeleton loading, empty state, theme integration
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Verify cross-cutting feedback quality
5. Polish → Tests pass, lint clean, quickstart validated

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No data-model.md or contracts/ — this is a frontend-only UI migration
- All inline style objects (`const xStyle: React.CSSProperties = { ... }`) must be eliminated
- Three global CSS classes (`.container`, `.error`, `.hint`) and bare element styles (`button {}`, `input {}`) are replaced by Tailwind utilities and shadcn components
- The `LoadingSpinner` inline `<style>` injection must be removed entirely
- `WebApp.showConfirm` (native Telegram dialog) is replaced by shadcn AlertDialog
- Commit after each task or logical group
