# Quickstart: E2E Integration Test Scenarios

## Prerequisites

- Docker Compose running (`docker compose up -d` for PostgreSQL + Redis)
- `pnpm install` completed at repo root
- Prisma client generated (`cd apps/api && pnpm exec prisma generate`)

## Test Scenario 1: Forward Pipeline (US1)

**File**: `apps/worker/test/e2e-forward-pipeline.spec.ts`

### Setup
1. Connect to real Redis (localhost:6379)
2. Initialize Prisma client
3. Create test user, source channel, and subscription list in DB
4. Create mock grammY Api with vi.fn() spies
5. Instantiate service chain: DedupService → RateLimiterService → MessageSender(mockApi) → ForwarderService
6. Create QueueConsumer with real BullMQ Worker

### Test Cases

**TC1: Message is forwarded to destination**
- Push ForwardJob with text "Hello integration test" to queue
- Wait for worker 'completed' event
- Assert: `mockApi.sendMessage` called with (destinationChannelId, "Hello integration test")

**TC2: Duplicate message is skipped**
- Push same ForwardJob again (identical text, same source channel)
- Wait for worker 'completed' event
- Assert: `mockApi.sendMessage` call count unchanged (still 1 from TC1)
- Assert: logger.info called with "message_deduplicated"

**TC3: New message is forwarded after duplicate**
- Push ForwardJob with different text "Different message"
- Wait for worker 'completed' event
- Assert: `mockApi.sendMessage` called with "Different message"

**TC4: Failed job lands in DLQ**
- Configure mockApi.sendMessage to reject with GrammyError
- Push ForwardJob to queue
- Wait for worker 'failed' event (after max retries)
- Assert: DLQ contains a job with the original ForwardJob data

### Cleanup
- Delete subscription list, source channel, user from DB
- Flush Redis keys matching `dedup:*`
- Obliterate test queues

---

## Test Scenario 2: Multi-Destination (US2)

**File**: `apps/worker/test/e2e-multi-destination.spec.ts`

### Setup
Same as Scenario 1, but create TWO subscription lists:
- List A: sourceChannel → destinationA
- List B: sourceChannel → destinationB

### Test Cases

**TC5: Message forwarded to both destinations**
- Push one ForwardJob for the shared source channel
- Wait for worker 'completed' event
- Assert: `mockApi.sendMessage` called twice — once with destinationA, once with destinationB

**TC6: Per-destination dedup independence**
- Manually mark the message as forwarded for destinationA only (via DedupService.markAsForwarded)
- Push the same ForwardJob again
- Wait for worker 'completed' event
- Assert: `mockApi.sendMessage` called once for destinationB only (destinationA skipped by dedup)

### Cleanup
Same as Scenario 1

---

## Test Scenario 3: Manual Testing (US3)

**File**: `docs/MANUAL_TESTING.md`

### Content Outline
1. **Prerequisites**: Bot token, 2 test channels (source + destination), bot added as admin to destination
2. **Database setup**: Create user, source channel, subscription list via Prisma Studio or seed script
3. **Start services**: `docker compose up` for full stack
4. **Send a test message**: Post a message in the source channel
5. **Verify forwarding**: Check the destination channel for the forwarded message
6. **Verify dedup**: Send the same message again, confirm it does NOT appear twice
7. **Verify different message**: Send a different message, confirm it IS forwarded

## Running Tests

```bash
# Ensure Docker Compose services are running
docker compose up -d

# Run only e2e tests
cd apps/worker && pnpm exec vitest run test/e2e-forward-pipeline.spec.ts test/e2e-multi-destination.spec.ts

# Run all worker tests (including e2e)
pnpm turbo run test --filter=@aggregator/worker
```
