# Contract: ChannelOpsConsumer Changes

## Constructor Change

### Before
```
constructor(channelManager: ChannelManager, logger: pino.Logger)
```

### After
```
constructor(
  channelManager: ChannelManager,
  logger: pino.Logger,
  onChannelJoined?: (telegramId: number) => void,
  onChannelLeft?: (telegramId: number) => void,
)
```

Optional callbacks invoked after successful channel operations. This avoids a direct dependency on ListenerService while allowing dynamic channel tracking.

## Modified Behavior

### processJob(job)
- **join operation**: After `channelManager.joinChannel()` succeeds, calls `onChannelJoined(result.telegramId)` if callback provided
- **leave operation**: After `channelManager.leaveChannel()` succeeds, calls `onChannelLeft(job.data.telegramId)` if callback provided

## Wiring (main.ts)

```
const channelOpsConsumer = new ChannelOpsConsumer(
  channelManager,
  logger,
  (telegramId) => listener.addChannel(telegramId),
  (telegramId) => listener.removeChannel(telegramId),
);
```
