# Data Model: Channel Cleanup Job

## Entity Changes

### SourceChannel (modified)

| Field            | Type       | Change   | Notes                                                 |
|------------------|------------|----------|-------------------------------------------------------|
| id               | UUID       | existing | Primary key                                           |
| telegramId       | BigInt     | existing | Unique Telegram channel ID                            |
| username         | String?    | existing | Optional @username                                    |
| title            | String     | existing | Channel display name                                  |
| isActive         | Boolean    | existing | `true` = bot is in channel, `false` = left/deactivated |
| subscribedAt     | DateTime   | existing | When channel was first added                          |
| updatedAt        | DateTime   | existing | Auto-updated by Prisma on any change                  |
| lastReferencedAt | DateTime?  | **NEW**  | Last time a subscription list referenced this channel |

**New field rationale**: `lastReferencedAt` tracks when the channel was last actively used by any subscription list. Set when a `SubscriptionListChannel` row is created pointing to this channel. The cleanup job uses `COALESCE(lastReferencedAt, subscribedAt)` to determine the grace period start for channels that predate this field.

### SubscriptionListChannel (unchanged)

| Field              | Type   | Notes                                           |
|--------------------|--------|-------------------------------------------------|
| id                 | UUID   | Primary key                                     |
| subscriptionListId | UUID   | FK to SubscriptionList                          |
| sourceChannelId    | UUID   | FK to SourceChannel                             |

The join table's existence/absence determines whether a source channel is referenced. Cascade delete from `SubscriptionList` or `SourceChannel` automatically removes these rows.

## Query Patterns

### Find orphaned channels eligible for cleanup

```
SELECT sc.*
FROM SourceChannel sc
LEFT JOIN SubscriptionListChannel slc ON slc.sourceChannelId = sc.id
WHERE sc.isActive = true
  AND slc.id IS NULL
  AND COALESCE(sc.lastReferencedAt, sc.subscribedAt) < NOW() - INTERVAL '30 days'
```

Prisma equivalent:

```
prisma.sourceChannel.findMany({
  where: {
    isActive: true,
    subscriptionListChannels: { none: {} },
    OR: [
      { lastReferencedAt: { lt: threshold } },
      { lastReferencedAt: null, subscribedAt: { lt: threshold } },
    ],
  },
})
```

### Deactivate channel after leaving

```
prisma.sourceChannel.update({
  where: { id: channelId },
  data: { isActive: false },
})
```

## State Transitions

```
SourceChannel.isActive state machine:

  [false] ---(user adds to subscription list)---> [true]
  [true]  ---(cleanup: no refs for 30+ days)----> [false]
  [true]  ---(still referenced)----------------> [true] (no change)
```

## Indexes

The existing unique index on `SourceChannel.telegramId` is sufficient. The cleanup query filters on `isActive` (boolean) and joins on `sourceChannelId` (FK with implicit index). No additional indexes required for the expected data volume.
