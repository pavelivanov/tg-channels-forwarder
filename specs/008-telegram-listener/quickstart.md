# Quickstart: Telegram Listener Service

**Feature**: 008-telegram-listener

## Prerequisites

- Worker app running (`apps/worker`)
- Redis running (for BullMQ queues)
- PostgreSQL running (for SourceChannel records)
- Valid Telegram session string (pre-generated via interactive login)
- Environment variables set: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`, `DATABASE_URL`, `REDIS_URL`

## Integration Scenario 1: Message Listening

**Goal**: Verify the listener receives messages from subscribed channels and enqueues ForwardJobs.

```typescript
// 1. Worker starts and ListenerService.start() is called
// 2. ListenerService queries active SourceChannels from DB
// 3. Registers NewMessage handler for those channel telegramIds
// 4. When a message arrives in a subscribed channel:

// Message flow:
// Telegram → GramJS NewMessage event
//   → ListenerService.handleNewMessage()
//     → messageExtractor.extractForwardJob(message)
//     → queueProducer.enqueueMessage(forwardJob)
//       → BullMQ 'message-forward' queue

// Verify: Check BullMQ queue for new ForwardJob with correct payload
```

## Integration Scenario 2: Album Grouping

**Goal**: Verify albums are collected and emitted as a single job.

```typescript
// 1. Three messages arrive with same groupedId within ~100ms
// 2. Each message goes through extractForwardJob()
// 3. AlbumGrouper.addMessage() called for each:
//    - First message: creates group, starts 300ms timer
//    - Second message: adds to group, resets timer
//    - Third message: adds to group, resets timer
// 4. 300ms after the third message, timer fires
// 5. AlbumGrouper.flush() combines into single ForwardJob:
//    {
//      messageId: firstMessage.id,
//      sourceChannelId: channelId,
//      mediaGroupId: "group123",
//      mediaGroup: [job1, job2, job3],
//      timestamp: firstMessage.date,
//    }
// 6. Combined job enqueued via QueueProducer

// Verify: Single ForwardJob in queue with mediaGroup array of length 3
```

## Integration Scenario 3: Channel Join via API

**Goal**: Verify POST /channels triggers actual Telegram join.

```typescript
// 1. API: POST /channels { username: "testchannel" }
//    → ChannelsService.findOrCreate("testchannel")
//    → Creates SourceChannel record (isActive: false, telegramId: placeholder)
//    → Enqueues { operation: "join", channelId: uuid, username: "testchannel" }
//      on channel-ops queue
//    → Returns 201 with pending channel

// 2. Worker: ChannelOpsConsumer picks up job
//    → ChannelManager.joinChannel(uuid, "testchannel")
//      → Rate limit check (< 5/hour)
//      → Random 2-5s delay
//      → client.invoke(Api.channels.JoinChannel({ channel: "testchannel" }))
//      → Extract telegramId + title from response
//      → Update SourceChannel: telegramId, title, isActive: true
//      → Return { telegramId, title }

// 3. ListenerService event handler now receives messages from the new channel

// Verify: SourceChannel.isActive = true, telegramId is real, messages received
```

## Integration Scenario 4: Rate Limiting

**Goal**: Verify 6th join within an hour is rejected.

```typescript
// 1. Join channels 1-5 successfully (each with 2-5s delay)
// 2. Attempt 6th join
//    → ChannelManager.checkRateLimit() finds 5 timestamps within last hour
//    → Throws RateLimitError with remainingSeconds
//    → Job fails, SourceChannel record deleted
//    → Error propagated back through BullMQ job.failedReason

// Verify: 5 successful joins, 6th rejected with rate limit error
```

## Integration Scenario 5: Auto-Reconnect

**Goal**: Verify reconnection after disconnection.

```typescript
// 1. ListenerService running, connected
// 2. Connection drops (network issue)
// 3. GramJS auto-reconnect kicks in (connectionRetries: 10)
//    → Logs "userbot_disconnected" at warn level
// 4. Reconnection succeeds
//    → Logs "userbot_reconnected" at info level
//    → Reload active channels from DB
//    → Re-register event handler
// 5. Messages resume flowing

// Verify: Log entries for disconnect/reconnect, messages resume
```

## Quick Smoke Test

```bash
# 1. Set environment variables
export TELEGRAM_API_ID=12345
export TELEGRAM_API_HASH=abc123
export TELEGRAM_SESSION="your-session-string"
export DATABASE_URL="postgresql://..."
export REDIS_URL="redis://localhost:6379"

# 2. Start worker
cd apps/worker && pnpm dev

# 3. Expected logs:
# INFO: Worker starting
# INFO: Listener connecting to Telegram
# INFO: Loaded N active channels
# INFO: Listener started
# INFO: Health server listening on port 3001

# 4. Send a message to a subscribed channel
# Expected log:
# DEBUG: message_received { channelId: ..., messageId: ... }
# INFO: Job enqueued { messageId: ..., sourceChannelId: ... }
```

## Test Patterns

### Unit Testing ListenerService

```typescript
// Mock GramJS client
const mockClient = {
  connect: vi.fn(),
  getMe: vi.fn(),
  addEventHandler: vi.fn(),
  disconnect: vi.fn(),
};

// Mock Prisma
const mockPrisma = {
  sourceChannel: {
    findMany: vi.fn().mockResolvedValue([
      { telegramId: BigInt(123), isActive: true },
    ]),
  },
};

// Test: start() registers event handler with correct channel filter
```

### Unit Testing AlbumGrouper

```typescript
// Use vi.useFakeTimers() for deterministic timer testing
// Add messages with same mediaGroupId
// Advance timer by 300ms
// Assert onFlush called with combined job
```

### Unit Testing ChannelManager Rate Limiter

```typescript
// Join 5 channels → all succeed
// Join 6th → throws RateLimitError
// Advance time by 1 hour
// Join again → succeeds (old timestamps expired)
```
