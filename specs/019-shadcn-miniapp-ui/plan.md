# Implementation Plan: Shadcn Mini App UI/UX

**Branch**: `019-shadcn-miniapp-ui` | **Date**: 2026-02-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-shadcn-miniapp-ui/spec.md`

## Summary

Replace the mini-app's inline styles and custom CSS with shadcn/ui components backed by Tailwind CSS v4. Telegram's `--tg-theme-*` CSS variables are aliased to shadcn semantic tokens via `var()` with fallbacks, giving automatic light/dark theme integration with zero JavaScript. The migration is file-by-file: install the foundation (Tailwind v4, shadcn CLI, path aliases), then convert each page and shared component to use shadcn equivalents (Card, Badge, Input, Checkbox, Skeleton, AlertDialog, Sonner).

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, React 19, Node.js 20 LTS
**Primary Dependencies**: React 19, React Router 7, Vite 6, shadcn/ui (new-york style), Tailwind CSS v4, `@twa-dev/sdk`
**Storage**: N/A (frontend-only; backend unchanged)
**Testing**: Vitest + @testing-library/react (existing, test section commented out in vite.config.ts — needs enabling)
**Target Platform**: Telegram Mini App (mobile WebView)
**Project Type**: Frontend SPA within monorepo (`apps/mini-app`)
**Performance Goals**: <50KB gzip added bundle size, <200ms visual feedback for all actions
**Constraints**: Must work within Telegram WebView; no `.dark` class toggling; theme driven by `--tg-theme-*` CSS variables
**Scale/Scope**: 2 pages (HomePage, ListFormPage), 7 shared components, 10 shadcn components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode & Code Quality | PASS | `strict: true` inherited from tsconfig base; no `any` types; shadcn components are TypeScript-native |
| II. Vitest Testing Standards | PASS | Tests will be updated using existing Vitest + @testing-library/react setup; test section in vite.config.ts to be enabled |
| III. Observability & Logging | N/A | Frontend-only change; no server-side logging changes |
| IV. Performance Requirements | PASS | Estimated ~40-50KB gzip addition on ~102KB existing; Tailwind v4 tree-shakes aggressively |
| V. Technology Stack & Monorepo | PASS | Stays within `apps/mini-app`; no new workspace packages; Turborepo build/test/lint scripts unchanged |
| VI. Docker-First Deployment | PASS | mini-app builds to `dist/` served by API's ServeStaticModule; no Dockerfile changes needed |
| VII. Data Architecture | N/A | No data model changes |

**Post-design re-check**: All gates pass. No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/019-shadcn-miniapp-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output (complete)
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
apps/mini-app/
├── components.json              # NEW — shadcn/ui configuration
├── package.json                 # MODIFIED — new dependencies
├── tsconfig.json                # MODIFIED — add paths alias
├── vite.config.ts               # MODIFIED — Tailwind plugin + path alias
└── src/
    ├── main.tsx                 # UNCHANGED — existing `import './styles/global.css'` path stays the same
    ├── styles/
    │   └── global.css           # REPLACED — Tailwind + shadcn tokens + Telegram theme mapping
    ├── lib/
    │   └── utils.ts             # NEW — cn() utility (clsx + tailwind-merge)
    ├── components/
    │   ├── ui/                  # NEW — shadcn/ui components (10 files)
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── badge.tsx
    │   │   ├── input.tsx
    │   │   ├── label.tsx
    │   │   ├── skeleton.tsx
    │   │   ├── alert-dialog.tsx
    │   │   ├── checkbox.tsx
    │   │   ├── separator.tsx
    │   │   └── sonner.tsx
    │   ├── AddChannelForm.tsx   # MODIFIED — use Input, Button, Sonner
    │   ├── ChannelSelector.tsx  # MODIFIED — use Checkbox, Input (search filter)
    │   ├── EmptyState.tsx       # MODIFIED — use Button, Tailwind classes
    │   ├── ErrorMessage.tsx     # MODIFIED — Tailwind classes
    │   ├── LoadingSpinner.tsx   # REPLACED → Skeleton-based loading
    │   ├── SubscriptionListCard.tsx  # MODIFIED — use Card, Badge
    │   └── TelegramGuard.tsx    # MINOR — Tailwind classes only
    ├── pages/
    │   ├── HomePage.tsx         # MODIFIED — Skeleton loading, updated layout
    │   └── ListFormPage.tsx     # MODIFIED — Input, Label, AlertDialog, Sonner, validation
    └── App.tsx                  # MODIFIED — add Toaster provider
```

**Structure Decision**: All changes stay within `apps/mini-app`. shadcn components install into `src/components/ui/`. No new workspace packages. The `cn()` utility goes in the existing `src/lib/` directory.

## Key Technical Decisions

### Tailwind CSS v4 Setup (from R2)
- Use `@tailwindcss/vite` plugin (not PostCSS) for faster builds
- CSS-first configuration via `@theme inline { }` blocks in global.css
- Single `@import "tailwindcss"` entry point
- No `tailwind.config.js` file needed

### Telegram Theme Integration (from R3, R4)
- Two-layer CSS variable mapping: `--tg-theme-*` → shadcn tokens → Tailwind utilities
- `var()` aliasing with fallbacks in `:root` — zero FOUC
- No `.dark` class, no `@custom-variant dark`, no ThemeProvider
- Telegram provides different hex values for light/dark automatically

### shadcn Components (from R5)
- 10 components: button, card, badge, input, label, skeleton, sonner, alert-dialog, checkbox, separator
- new-york style (cleaner, matches Telegram aesthetic)
- Components installed directly into `src/components/ui/` (not a dependency)

### Path Aliases (from R6)
- `@/*` → `./src/*` in both tsconfig.json (paths) and vite.config.ts (resolve.alias)

### Migration Strategy (from R8)
1. Foundation setup (Tailwind, shadcn, theme CSS, path aliases)
2. Shared components (LoadingSpinner → Skeleton, ErrorMessage, EmptyState)
3. HomePage (SubscriptionListCard → Card + Badge)
4. ListFormPage (inputs → Input + Label, channel selector → Checkbox, delete → AlertDialog)
5. Toast infrastructure (Sonner) wired into form actions
6. Test updates

## Complexity Tracking

No constitution violations to justify. All changes are within a single existing app (`apps/mini-app`), using well-established libraries (shadcn/ui, Tailwind CSS v4), with no new workspace packages or architectural patterns.
