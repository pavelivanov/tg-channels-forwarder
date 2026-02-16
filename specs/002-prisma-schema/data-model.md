# Data Model: Database Schema & Prisma Setup

**Feature**: 002-prisma-schema | **Date**: 2026-02-16

## Entity Relationship Diagram

```
User 1──* SubscriptionList *──* SourceChannel
                              (via SubscriptionListChannel)
```

- A **User** has many **SubscriptionLists** (one-to-many).
- A **SubscriptionList** has many **SourceChannels** through **SubscriptionListChannel** (many-to-many join).
- A **SourceChannel** can belong to many **SubscriptionLists** through **SubscriptionListChannel**.

## Entities

### User

| Field       | Type      | Constraints                        |
|-------------|-----------|------------------------------------|
| id          | UUID      | PK, auto-generated                 |
| telegramId  | BigInt    | Unique, not null                   |
| firstName   | String    | Not null                           |
| lastName    | String    | Nullable                           |
| username    | String    | Nullable                           |
| photoUrl    | String    | Nullable                           |
| isPremium   | Boolean   | Not null, default: false           |
| maxLists    | Int       | Not null, default: 1               |
| createdAt   | DateTime  | Not null, auto-set on create       |
| updatedAt   | DateTime  | Not null, auto-updated             |

**Relationships**: Has many SubscriptionList (cascade delete)

### SourceChannel

| Field        | Type      | Constraints                       |
|--------------|-----------|-----------------------------------|
| id           | UUID      | PK, auto-generated                |
| telegramId   | BigInt    | Unique, not null                  |
| username     | String    | Nullable                          |
| title        | String    | Not null                          |
| isActive     | Boolean   | Not null, default: true           |
| subscribedAt | DateTime  | Not null, auto-set on create      |
| updatedAt    | DateTime  | Not null, auto-updated            |

**Relationships**: Has many SubscriptionListChannel (cascade delete)

### SubscriptionList

| Field                | Type      | Constraints                       |
|----------------------|-----------|-----------------------------------|
| id                   | UUID      | PK, auto-generated                |
| userId               | UUID      | FK → User.id, not null            |
| name                 | String    | Not null                          |
| destinationChannelId | BigInt    | Not null                          |
| destinationUsername   | String    | Nullable                          |
| isActive             | Boolean   | Not null, default: true           |
| createdAt            | DateTime  | Not null, auto-set on create      |
| updatedAt            | DateTime  | Not null, auto-updated            |

**Indexes**: `userId` (for lookups by user)
**Relationships**: Belongs to User; has many SubscriptionListChannel (cascade delete)

### SubscriptionListChannel

| Field              | Type  | Constraints                                    |
|--------------------|-------|------------------------------------------------|
| id                 | UUID  | PK, auto-generated                             |
| subscriptionListId | UUID  | FK → SubscriptionList.id, not null             |
| sourceChannelId    | UUID  | FK → SourceChannel.id, not null                |

**Unique constraint**: `[subscriptionListId, sourceChannelId]`
**Relationships**: Belongs to SubscriptionList (cascade delete from parent); belongs to SourceChannel (cascade delete from parent)

## Cascade Delete Behavior

| When deleted       | Cascades to                                          |
|--------------------|------------------------------------------------------|
| User               | All SubscriptionLists → all SubscriptionListChannels  |
| SourceChannel      | All SubscriptionListChannels referencing it           |
| SubscriptionList   | All SubscriptionListChannels in that list             |

## Validation Rules

- `telegramId` on User and SourceChannel must be unique across their respective tables.
- `SubscriptionListChannel` composite unique constraint prevents adding the same source channel to the same list twice.
- `maxLists` defaults to 1 (enforced at application level, not DB constraint).
- All required fields are non-nullable at the database level.
