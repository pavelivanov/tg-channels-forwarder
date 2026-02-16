# Data Model: Authentication (Telegram initData + JWT)

**Branch**: `003-telegram-jwt-auth` | **Date**: 2026-02-16

## Entities

### User (existing — no schema changes)

The existing User model already has all fields needed for authentication:

| Field       | Type     | Notes                          |
| ----------- | -------- | ------------------------------ |
| id          | UUID     | Primary key, used as JWT `sub` |
| telegramId  | BigInt   | Unique, lookup key from initData |
| firstName   | String   | Updated from initData on each auth |
| lastName    | String?  | Updated from initData on each auth |
| username    | String?  | Updated from initData on each auth |
| photoUrl    | String?  | Updated from initData if present |
| isPremium   | Boolean  | Updated from initData if present |
| maxLists    | Int      | Unchanged by auth flow         |
| createdAt   | DateTime | Set on first auth              |
| updatedAt   | DateTime | Auto-updated on each auth      |

**Upsert strategy**: `prisma.user.upsert({ where: { telegramId }, create: {...}, update: {...} })`. The `create` path sets all fields from initData. The `update` path overwrites firstName, lastName, username, photoUrl, isPremium.

### JWT Token (transient — not persisted)

| Field      | Type   | Notes                              |
| ---------- | ------ | ---------------------------------- |
| sub        | string | User UUID (primary key)            |
| telegramId | string | BigInt serialized as string        |
| iat        | number | Issued-at (auto-set by @nestjs/jwt) |
| exp        | number | Expiry (auto-set, iat + 3600s)     |

Not stored in database. Stateless verification via HMAC signature.

## Relationships

No new relationships. The auth flow reads/writes the existing User entity only.

## Indexes

No new indexes needed. The existing unique index on `User.telegramId` supports the upsert lookup.
