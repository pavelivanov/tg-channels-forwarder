# Contract: Dedup Service

**Feature Branch**: `006-redis-dedup-service`
**Date**: 2026-02-17

## Overview

This feature has no REST API endpoints. It provides internal service contracts consumed by the worker process and a health check indicator for the API.

## Internal Service Contract: DedupService

**Location**: `apps/worker/src/dedup/dedup.service.ts`
**Consumer**: Worker message forwarding pipeline

### Methods

#### `isDuplicate(destinationChannelId: number, text: string): Promise<boolean>`

Checks whether a message with the same normalized text has already been forwarded to the given destination within the TTL window.

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| destinationChannelId | number | yes | Telegram channel ID of the destination |
| text | string | yes | Raw message text (will be normalized internally) |

**Returns**: `Promise<boolean>`
- `true` — a matching dedup record exists (duplicate)
- `false` — no matching record (not duplicate), OR text is empty/null after normalization, OR Redis is unreachable (fail-open)

**Behavior**:
1. If `text` normalizes to empty string → return `false` immediately
2. Compute hash of normalized text
3. Check Redis for key `dedup:{destinationChannelId}:{hash}`
4. If key exists → return `true`
5. If key does not exist → return `false`
6. If Redis error → log at `warn` level, return `false`

---

#### `markAsForwarded(destinationChannelId: number, text: string): Promise<void>`

Records that a message has been forwarded to a destination, preventing duplicate forwarding within the TTL window.

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| destinationChannelId | number | yes | Telegram channel ID of the destination |
| text | string | yes | Raw message text (will be normalized internally) |

**Returns**: `Promise<void>`

**Behavior**:
1. If `text` normalizes to empty string → return immediately (no-op)
2. Compute hash of normalized text
3. Set Redis key `dedup:{destinationChannelId}:{hash}` with value `"1"` and TTL of 259,200 seconds (72 hours)
4. If Redis error → log at `warn` level, do not throw

---

## Internal Service Contract: Pure Functions (packages/shared)

**Location**: `packages/shared/src/dedup/index.ts`

### `normalizeText(text: string): string`

Normalizes message text for deduplication fingerprinting.

**Parameters**: `text` — raw message text
**Returns**: Normalized string (may be empty)
**Side effects**: None (pure function)

### `computeHash(text: string): string`

Computes SHA-256 hex digest of input text.

**Parameters**: `text` — normalized text
**Returns**: 64-character lowercase hex string
**Side effects**: None (pure function)

---

## Health Check Contract

**Endpoint**: `GET /health` (existing, extended)

### Response (Redis healthy)

```json
{
  "status": "ok",
  "info": {
    "memory_heap": { "status": "up" },
    "database": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "memory_heap": { "status": "up" },
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

### Response (Redis unhealthy)

```json
{
  "status": "error",
  "info": {
    "memory_heap": { "status": "up" },
    "database": { "status": "up" }
  },
  "error": {
    "redis": { "status": "down", "message": "Connection refused" }
  },
  "details": {
    "memory_heap": { "status": "up" },
    "database": { "status": "up" },
    "redis": { "status": "down", "message": "Connection refused" }
  }
}
```

**HTTP Status**: `200` when all healthy, `503` when any indicator is down.
