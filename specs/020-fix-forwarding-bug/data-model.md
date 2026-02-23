# Data Model: Fix Forwarding Bug

## Schema Changes

**None.** This is a pure behavioral bug fix. No database schema changes, no new tables, no new columns. All changes are in-memory state management within the worker process.

## Affected Entities (Read-Only)

### SourceChannel (existing, no changes)
- `telegramId` (BigInt, unique): Used to match incoming messages to tracked channels
- `isActive` (Boolean): Loaded at startup to populate `activeChannelIds` set

### SubscriptionList (existing, no changes)
- `isActive` (Boolean): Queried by ForwarderService to find destinations
- `destinationChannelId` (BigInt): Target channel for forwarded messages
- Linked to SourceChannels via `SubscriptionListChannel` junction table

## In-Memory State Changes

### ListenerService.activeChannelIds (Set<number>)
- **Current behavior**: Populated at startup via `loadActiveChannels()`, refreshed on reconnect
- **New behavior**: Also updated incrementally when `addChannel(telegramId)` or `removeChannel(telegramId)` is called after channel operations
