# Feature Specification: Database Schema & Prisma Setup

**Feature Branch**: `002-prisma-schema`
**Created**: 2026-02-16
**Status**: Draft
**Input**: User description: "Database Schema & Prisma Setup — Define the data model and ensure migrations run cleanly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Runs Migrations on Fresh Database (Priority: P1)

A developer starts the local PostgreSQL via Docker Compose, runs the Prisma migration command, and the database schema is created with all required tables, indexes, and constraints. The migration completes without errors and is repeatable.

**Why this priority**: Without a working schema no application code can persist or query configuration data. Migrations are the foundation for all data-dependent features.

**Independent Test**: Start PostgreSQL via Docker Compose, run `npx prisma migrate deploy`, and verify all four tables exist with correct columns and constraints.

**Acceptance Scenarios**:

1. **Given** a running PostgreSQL instance with an empty database, **When** the developer runs `npx prisma migrate deploy`, **Then** the migration completes successfully and all four tables (User, SourceChannel, SubscriptionList, SubscriptionListChannel) are created.
2. **Given** migrations have already been applied, **When** the developer runs `npx prisma migrate deploy` again, **Then** the command completes without errors (idempotent).
3. **Given** the migration has been applied, **When** the developer inspects the database schema, **Then** all unique constraints, indexes, and foreign keys match the specification.

---

### User Story 2 - Developer Seeds Test Data (Priority: P2)

A developer runs the seed script after migrations. The database is populated with a test user and two source channels. The seeded data is queryable and can be used for local development and testing.

**Why this priority**: Seed data accelerates local development by providing a realistic baseline without manual data entry.

**Independent Test**: Run `npx prisma db seed`, then query the database and verify one user and two source channels exist.

**Acceptance Scenarios**:

1. **Given** migrations have been applied to an empty database, **When** the developer runs `npx prisma db seed`, **Then** one test user and two source channels are created.
2. **Given** seed data already exists, **When** the developer runs `npx prisma db seed` again, **Then** it completes without errors (upsert behavior, no duplicates).
3. **Given** seed data has been created, **When** the developer queries users and source channels, **Then** all fields contain valid, non-null data for required columns.

---

### User Story 3 - API App Connects to Database via PrismaService (Priority: P3)

The NestJS API application boots with a PrismaService provider that establishes a database connection on startup and disconnects cleanly on shutdown. Other modules can inject PrismaService to query the database.

**Why this priority**: PrismaService is the gateway for all database access in the API. Without it, no feature can read or write data.

**Independent Test**: Start the API app, verify it connects to the database on startup, and verify it disconnects without errors on shutdown.

**Acceptance Scenarios**:

1. **Given** PostgreSQL is running and migrations are applied, **When** the API app starts, **Then** PrismaService connects to the database and the health endpoint returns successfully.
2. **Given** the API app is running, **When** it receives a shutdown signal, **Then** PrismaService disconnects from the database cleanly without errors.
3. **Given** PrismaService is registered as a provider, **When** any NestJS service injects PrismaService, **Then** it can execute database queries.

---

### Edge Cases

- What happens when the database is unreachable at startup? The API fails fast with a clear error message naming the connection issue.
- What happens when a migration is run against a database with an incompatible schema? Prisma reports a migration conflict with instructions to resolve.
- What happens when a SubscriptionList is deleted? All associated SubscriptionListChannel records are cascade-deleted.
- What happens when a SourceChannel is deleted that is referenced by SubscriptionListChannel records? The cascade delete removes the join records.
- What happens when a duplicate SubscriptionListChannel (same subscription list + source channel) is inserted? The unique constraint rejects the insert with an appropriate error.
- What happens when a User with existing SubscriptionLists is deleted? The cascade delete removes all SubscriptionLists and their associated SubscriptionListChannel records.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Prisma schema MUST define a `User` entity with fields: id (UUID, auto-generated), telegramId (BigInt, unique), firstName (string), lastName (string, optional), username (string, optional), photoUrl (string, optional), isPremium (boolean, default false), maxLists (integer, default 1), createdAt (timestamp, auto-set), updatedAt (timestamp, auto-updated).
- **FR-002**: The Prisma schema MUST define a `SourceChannel` entity with fields: id (UUID, auto-generated), telegramId (BigInt, unique), username (string, optional), title (string), isActive (boolean, default true), subscribedAt (timestamp, auto-set), updatedAt (timestamp, auto-updated).
- **FR-003**: The Prisma schema MUST define a `SubscriptionList` entity with fields: id (UUID, auto-generated), userId (foreign key to User), name (string), destinationChannelId (BigInt), destinationUsername (string, optional), isActive (boolean, default true), createdAt (timestamp, auto-set), updatedAt (timestamp, auto-updated). An index MUST exist on userId.
- **FR-004**: The Prisma schema MUST define a `SubscriptionListChannel` entity with fields: id (UUID, auto-generated), subscriptionListId (foreign key to SubscriptionList), sourceChannelId (foreign key to SourceChannel). A unique constraint MUST exist on the combination of subscriptionListId and sourceChannelId.
- **FR-005**: Deleting a User MUST cascade-delete all their SubscriptionLists, which in turn cascade-delete all associated SubscriptionListChannel records.
- **FR-006**: Deleting a SourceChannel MUST cascade-delete all SubscriptionListChannel records referencing it.
- **FR-007**: A PrismaService MUST be available as a NestJS provider that connects to the database on module initialization and disconnects on module destruction.
- **FR-008**: An initial migration MUST be generated and applicable via `npx prisma migrate deploy`.
- **FR-009**: A seed script MUST create one test user and two source channels with realistic data.
- **FR-010**: The seed script MUST be idempotent — running it multiple times produces no duplicates.

### Key Entities

- **User**: A Telegram user who manages forwarding rules. Identified by their unique Telegram ID. Has limits on how many subscription lists they can create.
- **SourceChannel**: A Telegram channel that can be a source for forwarded messages. Identified by its unique Telegram ID. Can be active or inactive.
- **SubscriptionList**: A named forwarding rule owned by a user. Maps one destination channel to many source channels. Can be toggled active or inactive.
- **SubscriptionListChannel**: A many-to-many join between a subscription list and a source channel. Enforces uniqueness so the same source channel cannot be added to the same list twice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All database migrations apply successfully on a fresh PostgreSQL instance with zero errors.
- **SC-002**: The seed script populates the database with test data that is queryable by the application.
- **SC-003**: PrismaService connects and disconnects cleanly, verifiable via automated tests.
- **SC-004**: All four entity tables are created with the correct columns, types, constraints, and indexes as specified.
- **SC-005**: Cascade deletes propagate correctly through all parent-child relationships.
- **SC-006**: The API application starts and responds to health checks with PrismaService active.

## Assumptions

- PostgreSQL is available via the Docker Compose setup from `001-monorepo-scaffold`.
- The `DATABASE_URL` environment variable is already defined in `.env.example` and used by the API app.
- Prisma is installed in `apps/api` since the API is the primary database consumer.
- The seed script uses `prisma db seed` with a TypeScript seed file executed via `tsx`.
- UUIDs are generated by the database (Prisma `@default(uuid())`).
- BigInt is used for Telegram IDs as they can exceed JavaScript's safe integer limit.
