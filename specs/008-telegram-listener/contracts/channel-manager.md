# Contract: ChannelManager

**Location**: `apps/worker/src/listener/channel-manager.ts`

## Overview

Handles channel join/leave operations via MTProto with rate limiting. Used by the ChannelOpsConsumer to process commands from the API.

## Constructor

```typescript
constructor(
  getClient: () => TelegramClient,
  prisma: PrismaClient,
  logger: pino.Logger,
)
```

## Public Methods

### `joinChannel(channelId: string, username: string): Promise<ChannelInfo>`

Joins a channel via the userbot account and updates the database.

1. Check rate limiter: if >= 5 joins in the last hour → throw RateLimitError (FR-010)
2. Apply random delay 2–5 seconds before joining (FR-010)
3. Call `client.invoke(new Api.channels.JoinChannel({ channel: username }))` (FR-008)
4. Extract `telegramId` and `title` from response `updates.chats[0]`
5. Update `SourceChannel` record: set `telegramId`, `title`, `isActive: true` (FR-014)
6. Record timestamp in rate limiter
7. Log `channel_joined` at info level (FR-013)
8. Return `{ telegramId, title }`

**Error handling**:
- `FloodWaitError`: wait `error.seconds` then retry (FR-011)
- Any other error: delete the pending `SourceChannel` record, log `channel_join_failed`, re-throw (FR-014)

### `leaveChannel(telegramId: number): Promise<void>`

Leaves a channel via the userbot account.

1. Call `client.invoke(new Api.channels.LeaveChannel({ channel: telegramId }))` (FR-009)
2. Log `channel_left` at info level

## Types

```typescript
interface ChannelInfo {
  telegramId: number;
  title: string;
}

class RateLimitError extends Error {
  constructor(remainingSeconds: number) {
    super(`Rate limited. Try again in ${remainingSeconds}s`);
  }
}
```

## Rate Limiter (Internal)

```typescript
private joinTimestamps: number[] = [];
private readonly maxPerHour = JOIN_RATE_LIMIT_PER_HOUR; // 5

private checkRateLimit(): void {
  const oneHourAgo = Date.now() - 3600_000;
  this.joinTimestamps = this.joinTimestamps.filter(t => t > oneHourAgo);
  if (this.joinTimestamps.length >= this.maxPerHour) {
    const oldestRelevant = this.joinTimestamps[0];
    const remainingMs = oldestRelevant + 3600_000 - Date.now();
    throw new RateLimitError(Math.ceil(remainingMs / 1000));
  }
}
```

## Constants (from `@aggregator/shared`)

| Constant | Value |
|----------|-------|
| JOIN_RATE_LIMIT_PER_HOUR | 5 |
| JOIN_DELAY_MIN_MS | 2000 |
| JOIN_DELAY_MAX_MS | 5000 |
