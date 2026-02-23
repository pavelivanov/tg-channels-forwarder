# Research: Fix Forwarding Bug

## R-001: GramJS NewMessage `chats` Filter Behavior

**Decision**: Remove the `chats` parameter from `NewMessage` event registration; rely on `activeChannelIds` Set for filtering.

**Rationale**: The GramJS `chats` filter is **client-side only** — Telegram's MTProto server sends all channel updates regardless. The filter is resolved once at registration and is immutable (no API to update it). Removing it has zero impact on network traffic or server load. The existing `activeChannelIds.has(channelId)` check in `handleNewMessage` already performs the same filtering and is dynamically updatable.

**Alternatives considered**:
- **Re-register event handler**: Remove old handler + add new handler each time channels change. Works but adds complexity (must store handler/builder references, risk of race conditions during re-registration). Unnecessary since filter is client-side anyway.
- **Use `func` parameter closure**: Pass a filter function that reads from the mutable Set. Works but adds a redundant check — the handler already checks `activeChannelIds`.

## R-002: Dynamic Channel Tracking Strategy

**Decision**: Add `addChannel(telegramId)` and `removeChannel(telegramId)` methods to `ListenerService`. Call them from `ChannelOpsConsumer` after successful join/leave operations.

**Rationale**: Simplest approach that directly addresses the bug. The `activeChannelIds` Set already exists and is used for filtering. Adding/removing entries is O(1). No database queries needed — the join operation already knows the telegramId.

**Alternatives considered**:
- **Reload all channels from DB on every change**: Calls `loadActiveChannels()` which queries the DB. Works but wasteful — we already have the specific telegramId from the join/leave operation. Reserve `loadActiveChannels()` for bulk operations (startup, reconnect).
- **Pub/sub via Redis**: Worker API publishes channel change events, listener subscribes. Over-engineered for a single-process worker.

## R-003: Wiring ChannelOpsConsumer to ListenerService

**Decision**: Pass a callback (or the ListenerService instance) to `ChannelOpsConsumer` so it can notify the listener after successful channel operations.

**Rationale**: The `ChannelOpsConsumer` already processes join/leave jobs and has the telegramId available after a successful join (returned by `ChannelManager.joinChannel()`). Adding a notification callback is minimal code change.

**Alternatives considered**:
- **Event emitter pattern**: Have `ChannelManager` emit events. Adds indirection without clear benefit for a single consumer.
- **Direct dependency injection**: Pass `ListenerService` to `ChannelOpsConsumer`. Creates circular dependency concerns. A callback/interface is cleaner.
