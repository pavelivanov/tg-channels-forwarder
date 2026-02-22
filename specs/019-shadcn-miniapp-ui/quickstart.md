# Quickstart: Shadcn Mini App UI/UX

## Prerequisites

- Node.js 20 LTS, pnpm 10
- Docker Compose running (PostgreSQL, Redis) for API dev server
- Telegram Bot token configured in `.env`

## Setup

```bash
# Install dependencies (from repo root)
pnpm install

# Start API dev server (serves mini-app in dev via proxy)
cd apps/api && pnpm dev

# Start mini-app dev server (in separate terminal)
cd apps/mini-app && pnpm dev
```

## Verification Scenarios

### 1. Foundation Setup

After installing Tailwind CSS v4 and shadcn/ui:

```bash
cd apps/mini-app && pnpm build
```

- Build succeeds with no errors
- `dist/` contains CSS with Tailwind utility classes
- No `tailwind.config.js` file exists (CSS-first config)

### 2. Theme Integration

Open mini-app in Telegram (or via ngrok tunnel):

- **Light mode**: Background is white/light, text is dark, buttons match Telegram's blue
- **Dark mode**: Switch Telegram to dark theme — mini-app instantly reflects dark colors without page reload
- **No FOUC**: Theme colors render correctly on first paint (no flash of wrong colors)

### 3. Home Page (User Story 1)

Open the mini-app home page:

- Subscription lists render as styled cards with rounded corners and consistent spacing
- Each card shows: list name, destination channel, source channel count, active/inactive badge
- Loading state shows card-shaped skeleton placeholders (not a spinner)
- Empty state shows an icon and "Create your first list" button

### 4. List Form Page (User Story 2)

Navigate to create/edit a subscription list:

- Form fields have labels above them and proper spacing
- Submit with empty required fields → inline error below each invalid field
- Channel selector shows checkboxes with search/filter input
- Delete button triggers a styled AlertDialog (not browser `confirm()`)
- Successful create/edit shows a toast notification and navigates back

### 5. Feedback & Loading (User Story 3)

Perform operations and observe feedback:

- Submit button shows a spinner icon and is disabled while request is in progress
- Successful operations show green/neutral toast via Sonner
- Failed operations show destructive-colored toast with error message
- Delete confirmation shows toast "List deleted" on success

### 6. Tests

```bash
cd apps/mini-app && pnpm test
```

- All existing tests pass after component migration
- Tests verify rendering of shadcn components (Card, Badge, Button, etc.)
- Tests verify skeleton loading states and toast notifications

### 7. Build & Lint

```bash
# From repo root
pnpm turbo run build test lint --filter=@aggregator/mini-app
```

- TypeScript strict mode passes
- ESLint passes
- Vitest tests pass
- Build produces valid dist/ output
