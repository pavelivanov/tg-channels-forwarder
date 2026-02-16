# Quickstart: Source Channel Management API

## Prerequisites

- PostgreSQL running (via `docker compose up -d`)
- Prisma migrations applied (`pnpm --filter @aggregator/api exec prisma migrate dev`)
- Seed data loaded (`pnpm --filter @aggregator/api exec prisma db seed`)
- API running (`pnpm --filter @aggregator/api run dev`)

## Test Scenarios

### 1. Authenticate first

```bash
# Get a JWT (use the auth endpoint from feature 003)
# For testing, use the test helper or curl with valid initData
TOKEN="<your-jwt-token>"
```

### 2. List active channels

```bash
curl -s http://localhost:3000/channels \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected**: Array of active channels ordered by title. Seeded channels ("Dev Updates", "Tech News Channel") should appear.

### 3. Submit a new channel

```bash
curl -s -X POST http://localhost:3000/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "newchannel_test"}' | jq .
```

**Expected**: 201 with `{ id, telegramId: "0", username: "newchannel_test", title: "newchannel_test", isActive: false }`.

### 4. Submit same channel again (idempotent)

```bash
curl -s -X POST http://localhost:3000/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "newchannel_test"}' | jq .
```

**Expected**: 200 with the same channel record (not duplicated).

### 5. Submit existing active channel

```bash
curl -s -X POST http://localhost:3000/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "technews"}' | jq .
```

**Expected**: 200 with the existing active channel (if seeded with that username).

### 6. Invalid username format

```bash
curl -s -X POST http://localhost:3000/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "ab"}' | jq .
```

**Expected**: 400 with `{ statusCode: 400, error: "Bad Request", message: "..." }`.

### 7. No auth token

```bash
curl -s http://localhost:3000/channels | jq .
```

**Expected**: 401 with `{ statusCode: 401, error: "Unauthorized", message: "Unauthorized" }`.

## Running Tests

```bash
# Run channels tests only
pnpm --filter @aggregator/api exec vitest run test/channels.spec.ts

# Run all API tests
pnpm --filter @aggregator/api test

# Full monorepo verification
pnpm turbo run build test lint
```
