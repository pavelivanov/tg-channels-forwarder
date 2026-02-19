# Quickstart: MTProto Seed Channels

## Prerequisites

- PostgreSQL running (via Docker Compose)
- Valid `.env` with `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`, and `DATABASE_URL`
- Prisma client generated (`pnpm --filter @aggregator/api exec prisma generate`)

## Test Scenarios

### TS1: Basic seed with known public channels

```bash
cd apps/api
pnpm seed:channels @durov,@telegram
```

**Expected**: Both channels resolved and upserted. Summary shows 2 added/updated, 0 skipped.

### TS2: Idempotent re-run

```bash
pnpm seed:channels @durov,@telegram
pnpm seed:channels @durov,@telegram
```

**Expected**: Second run updates existing records. No duplicates. Summary shows 2 updated.

### TS3: Invalid channel in list

```bash
pnpm seed:channels @durov,@nonexistent_channel_xyz_999,@telegram
```

**Expected**: Warning for `nonexistent_channel_xyz_999`, other two channels seeded. Summary shows 2 added/updated, 1 skipped.

### TS4: Join flag

```bash
pnpm seed:channels --join @somepublicchannel
```

**Expected**: Channel resolved, userbot joins the channel, record upserted with `isActive: true`.

### TS5: Missing env vars

```bash
# Unset TELEGRAM_SESSION temporarily
TELEGRAM_SESSION= pnpm seed:channels @durov
```

**Expected**: Clear error message about missing/invalid session configuration. Exit code 1.

### TS6: Empty input

```bash
pnpm seed:channels
```

**Expected**: Usage message printed. Exit code 1.
