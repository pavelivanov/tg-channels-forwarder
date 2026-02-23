# Contract: ListenerService Changes

## New Public Methods

### addChannel(telegramId: number): void
Adds a channel to the active tracking set so incoming messages from it are processed.

**Called by**: ChannelOpsConsumer after successful join
**Precondition**: Channel has been successfully joined via GramJS
**Postcondition**: `activeChannelIds` contains the new telegramId; messages from this channel will be processed by `handleNewMessage`

### removeChannel(telegramId: number): void
Removes a channel from the active tracking set so incoming messages from it are ignored.

**Called by**: ChannelOpsConsumer after successful leave
**Precondition**: Channel has been left via GramJS
**Postcondition**: `activeChannelIds` no longer contains the telegramId; messages from this channel will be silently dropped

## Modified Behavior

### start()
- **Before**: Registers `NewMessage` handler with `{ chats: channelIds, incoming: true }`
- **After**: Registers `NewMessage` handler with `{ incoming: true }` only (no `chats` filter)
- Filtering is handled entirely by `activeChannelIds.has(channelId)` in `handleNewMessage`

### loadActiveChannels()
- No changes. Still queries DB and populates `activeChannelIds` set. Used at startup and on reconnect for bulk loading.
