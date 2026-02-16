# Data Model: Source Channel Management API

## Schema Changes

### Modified: SourceChannel

The existing `SourceChannel` model requires **one change**: add a unique index on `username` to support idempotent channel creation by username.

**Current schema** (from `apps/api/prisma/schema.prisma`):

```prisma
model SourceChannel {
  id           String   @id @default(uuid()) @db.Uuid
  telegramId   BigInt   @unique
  username     String?
  title        String
  isActive     Boolean  @default(true)
  subscribedAt DateTime @default(now())
  updatedAt    DateTime @updatedAt

  subscriptionListChannels SubscriptionListChannel[]
}
```

**Required change**:

```prisma
model SourceChannel {
  id           String   @id @default(uuid()) @db.Uuid
  telegramId   BigInt   @unique
  username     String?  @unique          # ADD unique constraint
  title        String
  isActive     Boolean  @default(true)
  subscribedAt DateTime @default(now())
  updatedAt    DateTime @updatedAt

  subscriptionListChannels SubscriptionListChannel[]
}
```

**Migration**: `prisma migrate dev --name add-unique-username-source-channel`

### Why the Unique Index?

- Prevents duplicate channel records when two users submit the same username concurrently
- PostgreSQL allows multiple `NULL` values in a unique column — channels without usernames are unaffected
- Enables efficient lookups: `WHERE username = $1` uses the index directly

## No New Models

All functionality operates on the existing `SourceChannel` model. No new tables or entities required.

## Field Usage by Endpoint

| Field | GET /channels | POST /channels (response) | POST /channels (create) |
|-------|:---:|:---:|:---:|
| id | returned | returned | auto-generated (uuid) |
| telegramId | returned | returned | set to `-BigInt(Date.now())` (unique negative placeholder for pending) |
| username | returned | returned | from request body |
| title | returned | returned | set to username (placeholder) |
| isActive | filter (= true) | returned | set to false (pending) |
| subscribedAt | returned | returned | auto (now()) |
| updatedAt | — | — | auto |

## Validation Rules

| Field | Rule | Source |
|-------|------|--------|
| username (input) | `^[a-zA-Z0-9_]{5,32}$` | FR-003, Telegram format spec |
| username (input) | Trimmed before validation | Edge case: whitespace handling |
| username (input) | Must not start with `@` | Edge case: @ prefix handling |
