# Data Model: Redis Connection & Deduplication Service

**Feature Branch**: `006-redis-dedup-service`
**Date**: 2026-02-17

## Overview

This feature introduces no PostgreSQL schema changes. All data is stored in Redis as ephemeral key-value pairs with TTL.

## Redis Key Schema

### Dedup Record

**Key pattern**: `dedup:{destinationChannelId}:{hash}`

| Component | Type | Description |
|-----------|------|-------------|
| `dedup` | string literal | Key namespace prefix |
| `destinationChannelId` | number | Telegram channel ID of the destination |
| `hash` | string (64 chars) | SHA-256 hex digest of normalized message text |

**Value**: `"1"` (presence-only; the value is not meaningful)

**TTL**: 259,200 seconds (72 hours)

**Examples**:
```
dedup:12345:a1b2c3d4e5f6...   → "1"  (TTL: 259200)
dedup:67890:f6e5d4c3b2a1...   → "1"  (TTL: 259200)
```

## Pure Data Transformations

### normalizeText(text: string): string

**Input**: Raw message text (may contain mixed case, punctuation, extra whitespace)

**Pipeline**:
1. Lowercase the entire string
2. Remove all non-word characters except spaces (preserve Unicode letters and digits via `\p{L}` and `\p{N}`)
3. Collapse multiple whitespace characters into a single space
4. Trim leading/trailing whitespace
5. Split by space, take first 10 words
6. Join with single space

**Output**: Normalized string (may be empty if input had no word characters)

**Examples**:
| Input | Output |
|-------|--------|
| `"Hello World!"` | `"hello world"` |
| `"HELLO   world!!!"` | `"hello world"` |
| `""` | `""` |
| `"...!!!"` | `""` |
| `"one two three four five six seven eight nine ten eleven"` | `"one two three four five six seven eight nine ten"` |
| `"Привет мир!"` | `"привет мир"` |

### computeHash(text: string): string

**Input**: Normalized text string
**Output**: 64-character lowercase hex string (SHA-256 digest)
**Property**: Deterministic — same input always produces same output

## Relationships

```
SubscriptionList.destinationChannelId ──→ Dedup Record key component
Message text ──→ normalizeText() ──→ computeHash() ──→ Dedup Record key component
```

No foreign key relationships exist — Redis keys are ephemeral and independent of PostgreSQL data.
