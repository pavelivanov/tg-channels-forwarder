# Research: Shadcn Mini App UI

**Branch**: `017-shadcn-mini-app-ui` | **Date**: 2026-02-19

## R1: Component Library Choice — shadcn/ui

**Decision**: Use shadcn/ui (latest, v2.9+) as the component library.

**Rationale**: shadcn/ui copies component source into the project (`src/components/ui/`) rather than installing an opaque npm package. This gives full control over customization — critical for mapping to Telegram's runtime CSS variables. Components are built on Radix UI primitives (accessible, unstyled) with Tailwind CSS utility classes.

**Alternatives considered**:
- **MUI / Chakra UI**: Heavy runtime, large bundle, opaque theming systems that conflict with Telegram's CSS variable injection. Rejected for bundle size and theming friction.
- **Radix UI (bare)**: Accessible primitives but requires building all styling from scratch. More work, same foundation shadcn already provides.
- **Custom components**: Maximum control but requires designing and testing every component. Unnecessary when shadcn provides a well-tested baseline we can customize.

## R2: CSS Framework — Tailwind CSS v4

**Decision**: Use Tailwind CSS v4 with the `@tailwindcss/vite` plugin.

**Rationale**: Tailwind v4 is CSS-first — no `tailwind.config.js` needed. Theme customization happens via `@theme {}` blocks in CSS, which maps perfectly to our need to reference Telegram's runtime CSS variables. The Vite plugin replaces the PostCSS setup entirely — no `postcss.config.js`, no `autoprefixer` (built in via Lightning CSS).

**Alternatives considered**:
- **Tailwind CSS v3**: Requires `tailwind.config.js`, PostCSS setup, and `autoprefixer`. More configuration files, same end result. v4 is simpler.
- **CSS Modules**: Good encapsulation but no design system, no utility classes, requires writing all styles manually.
- **Vanilla CSS (current approach)**: The inline `React.CSSProperties` approach is what we're migrating away from.

## R3: Telegram Theme Integration Strategy

**Decision**: Override shadcn's `:root` CSS variables to reference Telegram's `--tg-theme-*` variables with oklch fallbacks. No `.dark` class toggle — Telegram handles light/dark by changing its variable values at runtime.

**Rationale**: Telegram's WebApp SDK injects CSS variables on `:root` and updates them when the user switches themes. shadcn's theming system uses `:root` CSS variables that map to Tailwind utilities via `@theme inline {}`. By pointing shadcn's variables at Telegram's variables, all components inherit the Telegram theme automatically with zero JavaScript.

**Mapping**:

| shadcn token | Telegram variable | Purpose |
|---|---|---|
| `--background` | `--tg-theme-bg-color` | Page background |
| `--foreground` | `--tg-theme-text-color` | Primary text |
| `--card` | `--tg-theme-section-bg-color` | Card/section background |
| `--card-foreground` | `--tg-theme-text-color` | Card text |
| `--primary` | `--tg-theme-button-color` | Primary button/accent |
| `--primary-foreground` | `--tg-theme-button-text-color` | Primary button text |
| `--secondary` | `--tg-theme-secondary-bg-color` | Secondary surfaces |
| `--secondary-foreground` | `--tg-theme-text-color` | Secondary text |
| `--muted` | `--tg-theme-secondary-bg-color` | Muted surfaces |
| `--muted-foreground` | `--tg-theme-hint-color` | Hint/placeholder text |
| `--accent` | `--tg-theme-button-color` | Accent highlights |
| `--accent-foreground` | `--tg-theme-button-text-color` | Accent text |
| `--destructive` | `--tg-theme-destructive_text_color` | Delete/error actions |
| `--border` | `--tg-theme-hint-color` (with opacity) | Borders |
| `--input` | `--tg-theme-hint-color` (with opacity) | Input borders |
| `--ring` | `--tg-theme-button-color` | Focus rings |

**Dark mode**: No `.dark` class needed. Telegram updates `--tg-theme-*` values directly when the theme changes. The `@custom-variant dark` block from shadcn's default globals.css should be removed or kept as a no-op fallback.

## R4: Path Alias Configuration

**Decision**: Add `@/*` path alias to both `tsconfig.json` and `vite.config.ts` for the mini-app.

**Rationale**: shadcn/ui generates imports like `import { Button } from "@/components/ui/button"`. The current mini-app has `"baseUrl": "."` in tsconfig but no `paths` mapping. Both TypeScript and Vite need to resolve `@/` to `./src/`.

**Changes needed**:
- `tsconfig.json`: Add `"paths": { "@/*": ["./src/*"] }`
- `vite.config.ts`: Add `resolve.alias` mapping `@` → `path.resolve(__dirname, "./src")`

## R5: Required Dependencies

**Decision**: Install the following packages.

| Package | Type | Size (gzipped) | Purpose |
|---|---|---|---|
| `tailwindcss` | dev | Build-time only | CSS framework |
| `@tailwindcss/vite` | dev | Build-time only | Vite plugin (replaces PostCSS) |
| `class-variance-authority` | prod | ~2 kB | Component variant logic |
| `clsx` | prod | ~0.5 kB | Conditional class names |
| `tailwind-merge` | prod | ~7 kB | Resolve Tailwind class conflicts |
| `lucide-react` | prod | Tree-shakeable | Icons (only imported icons bundled) |
| `tw-animate-css` | prod | Pure CSS | Animation utilities |

**Total JS runtime increase**: ~8–12 kB gzipped (well under the 50 kB NFR-001 limit).

**Not needed**: `autoprefixer` (built into Tailwind v4), `postcss` (replaced by `@tailwindcss/vite`), `postcss-import` (built into Tailwind v4).

## R6: shadcn Components to Install

**Decision**: Install these 8 components via `npx shadcn@latest add`:

| Component | Used for | Radix dependency |
|---|---|---|
| `button` | All buttons (primary, secondary, destructive, ghost) | `@radix-ui/react-slot` |
| `card` | Subscription list cards, form sections | None (pure div) |
| `input` | Text inputs (list name, channel username) | None (native input) |
| `label` | Form field labels | `@radix-ui/react-label` |
| `checkbox` | Channel selector checkboxes | `@radix-ui/react-checkbox` |
| `badge` | Active/inactive status badges | None (pure span) |
| `separator` | Visual dividers between sections | `@radix-ui/react-separator` |
| `skeleton` | Loading state placeholders | None (pure div) |

Each component is copied into `src/components/ui/` as editable source code.

## R7: Bundle Size Validation Approach

**Decision**: Measure before and after with `vite build` output and `pnpm exec vite-bundle-visualizer` (or manual gzip comparison).

**Rationale**: NFR-001 requires the increase to be under 50 kB gzipped. The estimated JS increase (~10 kB) plus CSS (Tailwind tree-shakes aggressively, likely ~5–10 kB) should total well under 50 kB. Verification happens during Phase 5 (Polish).

## R8: Existing Test Compatibility

**Decision**: Tests will need minor updates to account for changed DOM structure (shadcn components render different HTML than the current inline-styled divs). The `@testing-library/react` queries (getByRole, getByText, getByLabelText) should mostly work unchanged since they query by semantics, not implementation.

**Potential breaking changes**:
- CSS class names change from none (inline styles) to Tailwind classes — tests querying by class name will break (but none currently do)
- Component wrappers change (e.g., Card wraps content in additional divs) — tests querying by DOM structure may need updates
- The `global.css` import path may change

**Mitigation**: Run existing tests after each migration phase and fix as needed.
