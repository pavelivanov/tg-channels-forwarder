# Data Model: Bot Admin Verification & Destination Validation

**Feature Branch**: `010-bot-admin-verification`
**Date**: 2026-02-17

## No New Database Entities

This feature does NOT introduce new database tables or Prisma schema changes. Bot admin verification is a runtime check against the Telegram Bot API — no persistent state is stored.

## Runtime Types

### BotVerificationResult (internal to BotService)

Not persisted. Used internally to represent the outcome of a `getChatMember` call.

| Field | Type | Description |
|-------|------|-------------|
| isAdmin | boolean | Whether the bot is an administrator or creator in the channel |

This is conceptually simple enough that `verifyBotAdmin` returns `boolean` directly rather than a wrapper object.

### Error Response Shape (API output)

When verification fails, the API returns:

| Field | Type | Value |
|-------|------|-------|
| statusCode | number | 400 |
| error | string | "Bad Request" |
| message | string | "Please add the bot as an administrator to your destination channel before creating a subscription list." |
| errorCode | string | "DESTINATION_BOT_NOT_ADMIN" |

When the Telegram API is temporarily unavailable:

| Field | Type | Value |
|-------|------|-------|
| statusCode | number | 503 |
| error | string | "Service Unavailable" |
| message | string | "Unable to verify bot admin status. Please try again later." |

## Existing Entities (Unchanged)

- **SubscriptionList**: Has `destinationChannelId: BigInt` — the field that triggers verification.
- **User**: Owner of subscription lists — unchanged.
- **SourceChannel**: Unrelated to destination verification — unchanged.
