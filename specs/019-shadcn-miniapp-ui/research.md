# Research: Shadcn Mini App UI/UX

## R1: Component Library + CSS Framework

**Decision**: shadcn/ui with Tailwind CSS v4 (new-york style)

**Rationale**: shadcn/ui installs components directly into the project (not a dependency), giving full control over styling. Tailwind CSS v4 uses CSS-first configuration with `@theme` blocks, eliminating the need for a `tailwind.config.js` file. The new-york style matches Telegram's cleaner aesthetic.

**Alternatives considered**:
- Radix UI primitives only: Too low-level, requires writing all styles from scratch
- Ant Design / MUI: Too heavy for a mobile Mini App, opinionated design language conflicts with Telegram's native feel
- Plain Tailwind without shadcn: Would need to build all component patterns manually

## R2: Tailwind CSS v4 Setup with Vite 6

**Decision**: Use `@tailwindcss/vite` plugin (not PostCSS) + single `@import "tailwindcss"` entry

**Rationale**: Tailwind v4 has a dedicated Vite plugin that's faster and simpler than the PostCSS approach. The CSS-first config uses `@theme inline { }` blocks in CSS instead of a JS config file. Content scanning is automatic.

**Key dependencies**:
- `tailwindcss` (v4)
- `@tailwindcss/vite` (Vite plugin)
- `class-variance-authority` (component variants)
- `clsx` + `tailwind-merge` (className merging via `cn()` utility)
- `lucide-react` (icons for new-york style)
- `tw-animate-css` (animations for components)

## R3: Telegram Theme Integration

**Decision**: Pure CSS variable aliasing — map `--tg-theme-*` vars to shadcn semantic tokens via `var()` with fallbacks

**Rationale**: The Telegram SDK sets `--tg-theme-*` CSS variables synchronously on `document.documentElement` before React mounts. Using `var(--tg-theme-bg-color, #ffffff)` provides zero-FOUC theme integration. No JavaScript color conversion or ThemeProvider needed.

**Architecture** (two-layer mapping):
```
Telegram runtime → --tg-theme-* (hex)
                        ↓ (var() aliasing in :root)
                   shadcn tokens (--background, --primary, etc.)
                        ↓ (@theme inline)
                   Tailwind utilities (bg-background, text-primary, etc.)
```

**Key mapping**:
| shadcn token | Telegram source |
|---|---|
| `--background` | `--tg-theme-bg-color` |
| `--foreground` | `--tg-theme-text-color` |
| `--card` | `--tg-theme-section-bg-color` |
| `--primary` | `--tg-theme-button-color` |
| `--primary-foreground` | `--tg-theme-button-text-color` |
| `--secondary` | `--tg-theme-secondary-bg-color` |
| `--muted-foreground` | `--tg-theme-hint-color` |
| `--destructive` | `--tg-theme-destructive-text-color` |
| `--border` | `--tg-theme-hint-color` |
| `--ring` | `--tg-theme-accent-text-color` |

**No dark mode class toggling needed**: Telegram provides different hex values for light/dark — the same `var()` references resolve to the correct colors automatically.

## R4: Dark Mode Strategy

**Decision**: No `.dark` class or `@custom-variant dark` needed. Remove shadcn's default dark mode setup.

**Rationale**: Traditional shadcn uses class-based dark mode (`.dark` on `<html>`). But Telegram handles this by providing different values in the same `--tg-theme-*` variables. The CSS `var()` aliasing approach means the UI automatically matches Telegram's theme with zero JavaScript.

**Alternatives considered**:
- ThemeProvider with `.dark` class: Unnecessary complexity; would need to sync with Telegram's colorScheme, creating two sources of truth
- `prefers-color-scheme` media query: Telegram controls theme independently of OS preference

## R5: shadcn Components Needed

**Decision**: Install 10 components covering all spec requirements

| Component | CLI name | Radix dependency | Covers |
|---|---|---|---|
| Button | `button` | None | FR-011, FR-013 |
| Card | `card` | None | FR-004 |
| Badge | `badge` | None | FR-004 |
| Input | `input` | None | FR-007 |
| Label | `label` | `@radix-ui/react-label` | FR-007 |
| Skeleton | `skeleton` | None | FR-005 |
| Sonner | `sonner` | `sonner` | FR-009, FR-010 |
| AlertDialog | `alert-dialog` | `@radix-ui/react-alert-dialog` | FR-012 |
| Checkbox | `checkbox` | `@radix-ui/react-checkbox` | Channel selector |
| Separator | `separator` | `@radix-ui/react-separator` | Visual dividers |

**Install command**: `npx shadcn@latest add button card badge input label skeleton sonner alert-dialog checkbox separator`

## R6: Path Alias Setup

**Decision**: Add `@/*` path alias mapping to `./src/*`

**Rationale**: shadcn/ui requires path aliases for component imports. Need changes in both tsconfig.json (`paths`) and vite.config.ts (`resolve.alias`).

## R7: Existing Test Infrastructure

**Decision**: Tests exist and infrastructure is ready — update tests after component migration

**Findings**:
- 6 test files exist: api-client, telegram, auth, home, add-channel, list-form
- @testing-library/react v16.3.0 already installed
- Vitest v3.1.4 configured (test section in vite.config.ts is commented out — needs enabling)
- jsdom environment available
- Comprehensive mocking for @twa-dev/sdk
- Tests use `render()`, `screen`, `userEvent`, `waitFor()` patterns

## R8: Migration Strategy

**Decision**: Replace inline styles file-by-file, converting React.CSSProperties to Tailwind classes and swapping custom components for shadcn equivalents

**Order**:
1. Setup foundation (Tailwind, shadcn, theme CSS, path aliases)
2. Migrate shared components (LoadingSpinner → Skeleton, ErrorMessage, EmptyState)
3. Migrate HomePage (SubscriptionListCard → Card + Badge)
4. Migrate ListFormPage (inputs → Input + Label, channel selector → Checkbox, delete → AlertDialog)
5. Add toast infrastructure (Sonner) and wire into form actions
6. Update tests

## R9: Bundle Size Considerations

**Decision**: Acceptable trade-off for UX quality

**Estimates**:
- Tailwind CSS v4 (purged): ~10-15KB gzip
- Radix primitives (3 packages): ~15-20KB gzip
- lucide-react (tree-shakeable): ~2-5KB per icon used
- sonner: ~5KB gzip
- Total addition: ~40-50KB gzip (acceptable for a Telegram Mini App)

Current mini-app bundle: ~102KB gzip (JS) + ~0.75KB gzip (CSS). Addition is proportionate.
