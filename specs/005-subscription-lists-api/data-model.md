# Data Model: Subscription List CRUD API

## Schema Changes

**None required.** All models (`User`, `SourceChannel`, `SubscriptionList`, `SubscriptionListChannel`) already exist in the Prisma schema from feature 002. This feature operates entirely on the existing schema.

## Existing Models Used

### SubscriptionList

```prisma
model SubscriptionList {
  id                   String   @id @default(uuid()) @db.Uuid
  userId               String   @db.Uuid
  name                 String
  destinationChannelId BigInt
  destinationUsername  String?
  isActive             Boolean  @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  user                    User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscriptionListChannels SubscriptionListChannel[]
  @@index([userId])
}
```

### SubscriptionListChannel (Join Table)

```prisma
model SubscriptionListChannel {
  id                 String @id @default(uuid()) @db.Uuid
  subscriptionListId String @db.Uuid
  sourceChannelId    String @db.Uuid
  subscriptionList SubscriptionList @relation(fields: [subscriptionListId], references: [id], onDelete: Cascade)
  sourceChannel    SourceChannel    @relation(fields: [sourceChannelId], references: [id], onDelete: Cascade)
  @@unique([subscriptionListId, sourceChannelId])
}
```

### User (Referenced for Limits)

```prisma
model User {
  id        String   @id @default(uuid()) @db.Uuid
  telegramId BigInt  @unique
  firstName String
  lastName  String?
  username  String?
  photoUrl  String?
  isPremium Boolean  @default(false)
  maxLists  Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  subscriptionLists SubscriptionList[]
}
```

### SourceChannel (Referenced for Validation)

```prisma
model SourceChannel {
  id           String   @id @default(uuid()) @db.Uuid
  telegramId   BigInt   @unique
  username     String?  @unique
  title        String
  isActive     Boolean  @default(true)
  subscribedAt DateTime @default(now())
  updatedAt    DateTime @updatedAt
  subscriptionListChannels SubscriptionListChannel[]
}
```

## Field Usage by Endpoint

### SubscriptionList Fields

| Field | GET (response) | POST (request) | POST (response) | PATCH (request) | PATCH (response) | DELETE |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|
| id | returned | -- | returned | route param | returned | route param |
| userId | filter (= JWT sub) | from JWT sub | -- | ownership check | -- | ownership check |
| name | returned | required | returned | optional | returned | -- |
| destinationChannelId | returned (as string) | required | returned (as string) | optional | returned (as string) | -- |
| destinationUsername | returned | optional | returned | optional | returned | -- |
| isActive | filter (= true) | default true | returned | -- | returned | set to false |
| createdAt | returned | auto (now()) | returned | -- | returned | -- |
| updatedAt | -- | auto | -- | auto | -- | auto |

### SubscriptionListChannel Fields

| Field | GET | POST | PATCH | DELETE |
|-------|:-:|:-:|:-:|:-:|
| id | -- | auto-generated | auto-generated | -- |
| subscriptionListId | join to list | set to new list ID | deleteMany + createMany | -- |
| sourceChannelId | join to source channel | from sourceChannelIds[] | from sourceChannelIds[] | -- |

### SourceChannel Fields (in Response)

| Field | Included in Response | Purpose |
|-------|:-:|---------|
| id | yes | Source channel identifier |
| telegramId | yes (as string) | Telegram numeric channel ID |
| username | yes | Telegram @username (without @) |
| title | yes | Channel display name |
| isActive | no | Used only for validation (must be true when referenced) |
| subscribedAt | no | Not relevant to subscription list context |

### User Fields (Referenced)

| Field | Usage | Purpose |
|-------|-------|---------|
| id | WHERE clause | Match authenticated user (from JWT `sub`) |
| maxLists | read | Enforce per-user list limit |

## Validation Rules

| Field | Rule | Source |
|-------|------|--------|
| name (input) | Non-empty string, required on create | FR-003, Edge Cases |
| destinationChannelId (input) | Required integer on create, any numeric value accepted | FR-003, Edge Cases |
| destinationUsername (input) | Optional string | FR-003 |
| sourceChannelIds (input) | Non-empty UUID v4 array on create, optional on update | FR-003, FR-007 |
| sourceChannelIds (input) | Deduplicated before processing | FR-013 |
| sourceChannelIds (input) | Each must reference an existing, active SourceChannel | FR-006 |
| active list count | Must not exceed user.maxLists | FR-004 |
| total source channels | Must not exceed 30 across all active lists | FR-005, FR-008 |

## Key Queries

### List user's active subscription lists with source channels

```
prisma.subscriptionList.findMany({
  where: { userId, isActive: true },
  include: {
    subscriptionListChannels: {
      include: { sourceChannel: true }
    }
  }
})
```

### Count user's total source channel assignments

```
prisma.subscriptionListChannel.count({
  where: {
    subscriptionList: {
      userId,
      isActive: true,
      ...(excludeListId ? { id: { not: excludeListId } } : {})
    }
  }
})
```

### Count user's active lists

```
prisma.subscriptionList.count({
  where: { userId, isActive: true }
})
```

### Find list by ID with ownership + active check

```
prisma.subscriptionList.findFirst({
  where: { id, userId, isActive: true }
})
```

### Validate source channel IDs exist and are active

```
prisma.sourceChannel.findMany({
  where: { id: { in: sourceChannelIds }, isActive: true }
})
// Compare returned count to input count to detect invalid/inactive IDs
```
