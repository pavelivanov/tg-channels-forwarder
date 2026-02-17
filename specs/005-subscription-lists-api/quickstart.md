# Quickstart: Subscription List CRUD API

## Prerequisites

- PostgreSQL running (via `docker compose up -d`)
- Prisma migrations applied (`pnpm --filter @aggregator/api exec prisma migrate dev`)
- Seed data loaded (`pnpm --filter @aggregator/api exec prisma db seed`)
- API running (`pnpm --filter @aggregator/api run dev`)

## Setup

```bash
# Get a JWT (use the auth endpoint from feature 003)
TOKEN="<your-jwt-token>"

# Verify you have seeded source channels to reference
curl -s http://localhost:3000/channels \
  -H "Authorization: Bearer $TOKEN" | jq '.[].id'
```

Note the source channel IDs from the output -- you will need them for create and update requests.

## Test Scenarios

### 1. List subscription lists (empty initially)

```bash
curl -s http://localhost:3000/subscription-lists \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected**: `[]` (empty array).

### 2. Create a subscription list

```bash
curl -s -w "\n%{http_code}" -X POST http://localhost:3000/subscription-lists \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Tech Feed",
    "destinationChannelId": 1002000001,
    "destinationUsername": "mytechfeed",
    "sourceChannelIds": [
      "<source-channel-id-1>",
      "<source-channel-id-2>"
    ]
  }' | jq .
```

**Expected**: 201 with full list object including populated `sourceChannels` array.

### 3. List subscription lists (with data)

```bash
curl -s http://localhost:3000/subscription-lists \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected**: Array with one list, source channels populated with `id`, `telegramId`, `username`, `title`.

### 4. Update list name only (no source channel changes)

```bash
LIST_ID="<list-id-from-step-2>"

curl -s -X PATCH "http://localhost:3000/subscription-lists/$LIST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Renamed Feed"}' | jq .
```

**Expected**: 200 with updated name, same source channels as before.

### 5. Update source channels (full replacement)

```bash
curl -s -X PATCH "http://localhost:3000/subscription-lists/$LIST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceChannelIds": ["<different-source-channel-id>"]
  }' | jq .
```

**Expected**: 200 with new source channels array containing only the specified channel.

### 6. Delete a subscription list (soft delete)

```bash
curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  "http://localhost:3000/subscription-lists/$LIST_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**: `204` (no response body).

### 7. Verify deleted list is excluded from GET

```bash
curl -s http://localhost:3000/subscription-lists \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected**: `[]` (the soft-deleted list no longer appears).

### 8. Verify deleted list returns 404 on update

```bash
curl -s -X PATCH "http://localhost:3000/subscription-lists/$LIST_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Should Fail"}' | jq .
```

**Expected**: `{ "statusCode": 404, "error": "Not Found", "message": "Subscription list not found" }`.

---

## Error Scenarios

### 9. List limit exceeded

Create a list when the user has already reached their `maxLists` limit (default: 1).

```bash
# First, create a list (to hit the limit of 1)
curl -s -X POST http://localhost:3000/subscription-lists \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "First List",
    "destinationChannelId": 1002000001,
    "sourceChannelIds": ["<source-channel-id-1>"]
  }' | jq .

# Then try to create a second list
curl -s -X POST http://localhost:3000/subscription-lists \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Second List",
    "destinationChannelId": 1002000002,
    "sourceChannelIds": ["<source-channel-id-2>"]
  }' | jq .
```

**Expected**: 403 with `"message": "Subscription list limit reached (maximum: 1)"`.

### 10. Source channel limit exceeded

Attempt to add more than 30 total source channels across all active lists.

```bash
curl -s -X POST http://localhost:3000/subscription-lists \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Too Many Channels",
    "destinationChannelId": 1002000003,
    "sourceChannelIds": [
      "<31-channel-ids-here>"
    ]
  }' | jq .
```

**Expected**: 403 with `"message": "Source channel limit exceeded (maximum: 30, current: N, requested: M)"`.

### 11. Invalid source channel IDs

```bash
curl -s -X POST http://localhost:3000/subscription-lists \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Channels",
    "destinationChannelId": 1002000001,
    "sourceChannelIds": [
      "00000000-0000-0000-0000-000000000000"
    ]
  }' | jq .
```

**Expected**: 400 with `"message": "Invalid or inactive source channel IDs: 00000000-0000-0000-0000-000000000000"`.

### 12. Malformed UUID in sourceChannelIds

```bash
curl -s -X POST http://localhost:3000/subscription-lists \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Format",
    "destinationChannelId": 1002000001,
    "sourceChannelIds": ["not-a-uuid"]
  }' | jq .
```

**Expected**: 400 with validation error message about UUID format.

### 13. Missing required fields

```bash
curl -s -X POST http://localhost:3000/subscription-lists \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

**Expected**: 400 with validation errors for `name`, `destinationChannelId`, `sourceChannelIds`.

### 14. Cross-user access attempt

Use a JWT for a different user and try to update/delete another user's list.

```bash
OTHER_TOKEN="<jwt-for-different-user>"

curl -s -X PATCH "http://localhost:3000/subscription-lists/$LIST_ID" \
  -H "Authorization: Bearer $OTHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hijacked"}' | jq .
```

**Expected**: 404 with `"message": "Subscription list not found"` (non-owner cannot see or modify the list).

### 15. No auth token

```bash
curl -s http://localhost:3000/subscription-lists | jq .
```

**Expected**: 401 with `{ "statusCode": 401, "error": "Unauthorized", "message": "Unauthorized" }`.

---

## Running Tests

```bash
# Run subscription-lists tests only
pnpm --filter @aggregator/api exec vitest run test/subscription-lists.spec.ts

# Run all API tests
pnpm --filter @aggregator/api test

# Full monorepo verification
pnpm turbo run build test lint
```
