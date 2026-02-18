# Manual Testing Guide

This guide walks through manually verifying the message forwarding pipeline with real Telegram channels. Follow these steps to confirm that messages flow from a source channel to a destination channel via the worker's forwarding pipeline.

## Prerequisites

Before starting, ensure you have:

1. **Telegram Bot Token** — Create a bot via [@BotFather](https://t.me/BotFather) and copy the token
2. **Telegram API credentials** — Obtain `api_id` and `api_hash` from [my.telegram.org](https://my.telegram.org)
3. **GramJS Session String** — A valid session string for the userbot (MTProto client). Generate one using the GramJS StringSession helper
4. **Two Telegram channels**:
   - **Source channel** — The channel whose messages will be forwarded. The userbot must be a member
   - **Destination channel** — The channel that receives forwarded messages. The bot must be added as an **administrator** with permission to post messages
5. **Docker** and **Node.js 20+** installed locally
6. **pnpm** package manager installed (`npm install -g pnpm`)

## 1. Environment Setup

Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd tg-channels-forwarder
pnpm install
```

Start infrastructure services:

```bash
docker compose up -d postgres redis
```

Wait for services to be healthy:

```bash
docker compose ps
# Both postgres and redis should show "healthy"
```

Copy and configure environment variables:

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aggregator?schema=public
REDIS_URL=redis://localhost:6379
BOT_TOKEN=<your-bot-token>
TELEGRAM_API_ID=<your-api-id>
TELEGRAM_API_HASH=<your-api-hash>
TELEGRAM_SESSION=<your-gramjs-session-string>
WORKER_HEALTH_PORT=3001
```

Run database migrations:

```bash
cd apps/api
pnpm exec prisma migrate deploy
pnpm exec prisma generate
cd ../..
```

Build all packages:

```bash
pnpm turbo run build
```

## 2. Database Setup

You need to create test data: a user, a source channel, and a subscription list linking them.

### Option A: Using Prisma Studio (GUI)

```bash
cd apps/api
pnpm exec prisma studio
```

This opens a web UI at `http://localhost:5555`. Create records in this order:

1. **User** — Set `telegramId` to your Telegram user ID, `firstName` to your name
2. **SourceChannel** — Set `telegramId` to the source channel's numeric ID (negative number, e.g., `-1001234567890`), `title` to the channel name, `isActive` to `true`
3. **SubscriptionList** — Set `userId` to the user you created, `name` to "Test List", `destinationChannelId` to the destination channel's numeric ID, `isActive` to `true`
4. **SubscriptionListChannel** — Link the subscription list to the source channel

### Option B: Using psql

```bash
docker compose exec postgres psql -U postgres -d aggregator
```

```sql
-- Insert user (replace with your Telegram ID)
INSERT INTO "User" ("id", "telegramId", "firstName", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 123456789, 'TestUser', NOW(), NOW());

-- Insert source channel (replace with real channel ID)
INSERT INTO "SourceChannel" ("id", "telegramId", "title", "isActive", "subscribedAt", "updatedAt")
VALUES (gen_random_uuid(), -1001234567890, 'My Source Channel', true, NOW(), NOW());

-- Insert subscription list (use IDs from above inserts)
INSERT INTO "SubscriptionList" ("id", "userId", "name", "destinationChannelId", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), '<user-id>', 'Test List', -1009876543210, true, NOW(), NOW());

-- Link them (use IDs from above)
INSERT INTO "SubscriptionListChannel" ("id", "subscriptionListId", "sourceChannelId")
VALUES (gen_random_uuid(), '<list-id>', '<channel-id>');
```

### Finding Channel IDs

To find a channel's numeric ID:

1. Forward a message from the channel to [@userinfobot](https://t.me/userinfobot) or [@RawDataBot](https://t.me/RawDataBot)
2. The bot replies with the channel's numeric ID (starts with `-100`)
3. Use this ID for both `SourceChannel.telegramId` and `SubscriptionList.destinationChannelId`

## 3. Start Services

Start the API and worker:

```bash
# Terminal 1: Start the API
cd apps/api
node dist/main.js

# Terminal 2: Start the worker
cd apps/worker
node dist/main.js
```

Or use Docker Compose for the full stack:

```bash
docker compose up
```

Watch the worker logs for startup confirmation:

```
{"level":"info","msg":"worker_started"}
{"level":"info","msg":"listener_connected"}
```

## 4. Test: Forward a Message

1. Open Telegram and navigate to your **source channel**
2. Post a text message: `Hello, this is a forwarding test!`
3. Within 5 seconds, check the **destination channel**
4. The same message should appear in the destination channel

**Expected worker log output:**

```
{"level":"info","msg":"job_received","data":{"messageId":...,"sourceChannelId":...}}
{"level":"info","msg":"message_forwarded","sourceChannelId":...,"destinationChannelId":...}
{"level":"info","msg":"job_completed"}
```

## 5. Test: Dedup Verification

1. Post the **exact same message** in the source channel again: `Hello, this is a forwarding test!`
2. Check the destination channel — the message should **NOT** appear a second time
3. The worker logs should show the dedup skip:

```
{"level":"info","msg":"message_deduplicated","sourceChannelId":...,"destinationChannelId":...}
```

**Why it works**: The dedup service computes a SHA256 hash of the normalized text and stores it in Redis with a 72-hour TTL. The second identical message matches the existing hash and is skipped.

## 6. Test: New Message Forwarding

1. Post a **different message** in the source channel: `This is a completely different message`
2. Check the destination channel — this new message **should** appear
3. This confirms that only true duplicates are blocked, not all messages

## 7. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Message not forwarded | Bot is not an admin in destination channel | Add bot as admin with "Post Messages" permission |
| Message not forwarded | Source channel ID doesn't match DB | Verify `SourceChannel.telegramId` matches the actual channel ID |
| Message not forwarded | Subscription list is not active | Check `SubscriptionList.isActive` is `true` |
| Message not forwarded | No SubscriptionListChannel link | Verify the junction table row exists linking list and channel |
| Worker crashes on start | Missing environment variables | Check all required vars in `.env`: `BOT_TOKEN`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`, `DATABASE_URL` |
| Worker starts but no messages | Userbot not connected | Check worker logs for `listener_connected`. Regenerate session string if expired |
| Duplicate not caught | Different whitespace or formatting | Dedup normalizes text (lowercase, remove punctuation, first 10 words). Minor differences may produce different hashes |
| Redis connection error | Redis not running | Run `docker compose up -d redis` and verify with `redis-cli ping` |
| Database connection error | PostgreSQL not running | Run `docker compose up -d postgres` and verify with `docker compose ps` |

## 8. Cleanup

After testing, remove test data:

```bash
# Via psql
docker compose exec postgres psql -U postgres -d aggregator -c "
  DELETE FROM \"SubscriptionListChannel\" WHERE \"subscriptionListId\" IN (
    SELECT id FROM \"SubscriptionList\" WHERE name = 'Test List'
  );
  DELETE FROM \"SubscriptionList\" WHERE name = 'Test List';
  DELETE FROM \"SourceChannel\" WHERE title = 'My Source Channel';
  DELETE FROM \"User\" WHERE \"firstName\" = 'TestUser';
"
```

Flush Redis dedup keys:

```bash
docker compose exec redis redis-cli KEYS "dedup:*" | xargs docker compose exec redis redis-cli DEL
```

Stop services:

```bash
docker compose down
```
