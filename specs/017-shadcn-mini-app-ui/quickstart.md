# Quickstart: Shadcn Mini App UI

## Prerequisites

- Node.js 22+, pnpm 10+
- Mini App dev server working (`cd apps/mini-app && pnpm dev`)
- Access to Telegram client for theme testing (or browser dev tools to simulate CSS variables)

## Test Scenarios

### TS1: Tailwind + shadcn setup works

```bash
cd apps/mini-app
pnpm dev
```

Open `http://localhost:5173/app` in a browser. The page should render with Tailwind-styled components. Inspect elements in DevTools — they should have Tailwind utility classes (e.g., `bg-background`, `text-foreground`) instead of inline `style` attributes.

**Expected**: Page loads without errors. No inline styles on buttons, cards, or inputs. Browser console has no CSS errors.

### TS2: Telegram theme integration (light)

Open the Mini App inside Telegram on a device with a light theme (or simulate by setting `--tg-theme-bg-color: #ffffff` and `--tg-theme-text-color: #000000` on `:root` in DevTools).

**Expected**: Background is white, text is black, buttons use the Telegram accent color, cards use the section background color. All colors match the Telegram client's theme.

### TS3: Telegram theme integration (dark)

Open the Mini App inside Telegram on a device with a dark theme (or simulate by setting `--tg-theme-bg-color: #1c1c1e` and `--tg-theme-text-color: #ffffff` on `:root` in DevTools).

**Expected**: Background is dark, text is white, all components adapt. No white/light backgrounds bleeding through.

### TS4: Create list form UX

1. Open the "Create List" page
2. Leave the name field empty and tap "Save"
3. Enter a name, select some channels, tap "Save"

**Expected**: Step 2 shows a field-level error on the name input (red border + error text below the field). Step 3 saves successfully with a loading indicator on the button during the API call.

### TS5: Channel selector styled checkboxes

1. Open the "Create List" page
2. Check/uncheck channels in the selector

**Expected**: Checkboxes are styled (not browser-default), show clear checked/unchecked states. Selection count updates.

### TS6: Empty state with icon

1. Ensure the user has no subscription lists
2. Open the home page

**Expected**: An empty state with an icon/illustration, descriptive text, and a "Create" button is displayed.

### TS7: Card touch feedback

1. Open the home page with at least one subscription list
2. Tap on a subscription list card

**Expected**: The card shows visible press feedback (opacity change, scale, or highlight) within 100ms of touch.

### TS8: Existing tests pass

```bash
cd apps/mini-app
pnpm test
```

**Expected**: All existing tests pass. Some may need import path or selector updates, but no test logic should change.

### TS9: Build succeeds

```bash
pnpm turbo run build --filter=@aggregator/mini-app
```

**Expected**: Build completes without errors. Check output size — the increase should be under 50 kB gzipped compared to the pre-migration build.

### TS10: Responsive layout (320px–428px)

Open the app in browser DevTools with viewport widths of 320px, 375px, and 428px.

**Expected**: No horizontal overflow, no clipped content, all interactive elements are tappable. Cards, buttons, and inputs fill the available width appropriately.
