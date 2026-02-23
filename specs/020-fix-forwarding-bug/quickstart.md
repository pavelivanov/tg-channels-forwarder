# Quickstart: Fix Forwarding Bug

## Prerequisites
- Running PostgreSQL and Redis (via docker-compose)
- Worker app builds and tests pass

## Verification Steps

### 1. Build passes
```bash
pnpm turbo run build --filter=@aggregator/worker
```

### 2. All tests pass
```bash
pnpm turbo run test --filter=@aggregator/worker
```

### 3. Lint passes
```bash
pnpm turbo run lint --filter=@aggregator/worker
```

### 4. Dynamic channel tracking works (unit test)
- Listener starts with initial channels
- `addChannel(telegramId)` makes the listener process messages from that channel
- `removeChannel(telegramId)` makes the listener ignore messages from that channel

### 5. Channel ops wiring works (unit test)
- After successful join, listener is notified with the new telegramId
- After successful leave, listener is notified to stop tracking

### 6. Forwarder fans out to all destinations (unit test)
- Message from a source channel in 2 subscription lists → forwarded to 2 destinations
- Existing forwarder tests still pass

### 7. No static chats filter in event registration
- `NewMessage` handler registered with `{ incoming: true }` only
- No `chats` parameter passed
