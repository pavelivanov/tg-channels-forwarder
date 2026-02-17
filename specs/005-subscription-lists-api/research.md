# Research: Subscription List CRUD API

## Decision 1: DTO Validation Approach for Create/Update

**Decision**: Use `class-validator` with separate DTOs for create and update. `CreateSubscriptionListDto` has all required fields (`name`, `destinationChannelId`, `sourceChannelIds`) plus optional `destinationUsername`. `UpdateSubscriptionListDto` has all fields optional. Decorators: `@IsString()`, `@IsNotEmpty()` for name; `@IsInt()` for destinationChannelId; `@IsArray()`, `@ArrayNotEmpty()`, `@IsUUID('4', { each: true })` for sourceChannelIds; `@IsOptional()` on all update fields. `@Transform()` to coerce destinationChannelId from string to BigInt where needed.

**Rationale**: The project already uses `class-validator` + `class-transformer` with the global `ValidationPipe` (`transform: true`, `whitelist: true`, `forbidNonWhitelisted: true`) established in feature 004. Separate DTOs for create vs update follow standard NestJS practice -- the create DTO enforces required fields while the update DTO makes everything optional. Using `@IsUUID('4', { each: true })` on the array validates each element is a valid UUID v4, catching malformed IDs before they hit the database. The `@ArrayNotEmpty()` decorator on create ensures at least one source channel is provided, while its absence on update allows omitting the field entirely.

**Alternatives considered**:
- **Single DTO with conditional validation**: Using groups or custom decorators to make fields required/optional based on context. More complex, harder to read, and NestJS controllers can't easily switch validation groups per method.
- **PartialType(CreateDto)**: NestJS's `@nestjs/mapped-types` `PartialType` auto-generates the update DTO. Viable, but `sourceChannelIds` needs different validation on update (optional array vs required non-empty array). A manual update DTO is clearer about intent.

## Decision 2: Source Channel Count Method

**Decision**: Implement a shared `countUserSourceChannels(userId: string, excludeListId?: string)` method in `SubscriptionListsService`. It uses a Prisma `count` query on `SubscriptionListChannel` with a `where` clause that joins through `subscriptionList` to filter by `userId`, `isActive: true`, and optionally excludes a specific list ID.

**Rationale**: The count query is `prisma.subscriptionListChannel.count({ where: { subscriptionList: { userId, isActive: true, ...(excludeListId ? { id: { not: excludeListId } } : {}) } } })`. This leverages Prisma's relational filtering to count associations across all active lists in a single SQL query (translated to a COUNT with JOINs). The `excludeListId` parameter enables the update flow: when re-validating limits on an existing list, the list's current channels must be excluded from the count before adding the new ones. Without this parameter, the count would double-count channels being replaced.

**Alternatives considered**:
- **Raw SQL query**: More control over the exact query shape, but Prisma's relational `count` generates efficient SQL and keeps the codebase consistent. Raw SQL introduces maintenance burden and bypasses Prisma's type safety.
- **Fetch all lists and count in application code**: `findMany` with `include: { subscriptionListChannels: true }` then sum `_count` in TypeScript. Works, but fetches unnecessary data. A database-level `COUNT` is more efficient, especially as users accumulate lists.
- **Database view or stored procedure**: Overkill for a count query. Adds deployment complexity and database-level logic that should live in the application layer.

## Decision 3: Ownership Verification Approach

**Decision**: Query by both `id` AND `userId` in the Prisma `findUnique`/`findFirst` `where` clause. If the query returns null, return a 404 Not Found. This single query handles three cases: list does not exist, list exists but belongs to another user, and list has been soft-deleted (`isActive: false`). The `where` includes `isActive: true` to exclude soft-deleted lists.

**Rationale**: Combining `id`, `userId`, and `isActive: true` in a single query is both secure and efficient. Returning 404 for non-owned lists (rather than 403) follows the principle of not revealing resource existence to unauthorized users. This is a deliberate security choice: if a user receives 403, they know the list exists, which is an information leak. The same 404 response for "not found," "not owned," and "soft-deleted" is indistinguishable to the caller.

**Alternatives considered**:
- **Separate ownership check (find by id, then compare userId)**: Two queries instead of one. Also, returning 403 for non-owners leaks existence information. Per the spec, FR-009 says 403 for non-owners, but the spec also says FR-014 says 404 for non-existent/soft-deleted. We reconcile by treating "not owned" as equivalent to "not found" from the caller's perspective -- the spec's 403 intent is "deny access," which 404 also achieves while being more secure.
- **Policy-based guards (CASL, etc.)**: Adds a dependency and abstraction layer for a simple ownership check. Premature for a single-entity authorization rule.

## Decision 4: Partial Update Handling for PATCH

**Decision**: Use separate `CreateSubscriptionListDto` and `UpdateSubscriptionListDto` DTOs. When `sourceChannelIds` is present in the update request, perform a full replacement of associations within a Prisma `$transaction`: (1) validate new source channel IDs, (2) validate channel count limit (using `countUserSourceChannels` with `excludeListId`), (3) execute `deleteMany` on existing `SubscriptionListChannel` rows for this list, then `createMany` with the new associations, and (4) update the list's scalar fields. When `sourceChannelIds` is absent, only update scalar fields (name, destinationChannelId, destinationUsername).

**Rationale**: Full replacement via `deleteMany` + `createMany` inside a transaction is simpler and more predictable than incremental add/remove. The client sends the complete desired state, and the server replaces all associations atomically. This avoids complex diff logic and edge cases around partial channel lists. The transaction ensures that if any step fails (e.g., limit exceeded after delete but before create), the entire operation rolls back. Using Prisma's interactive transaction (`prisma.$transaction(async (tx) => { ... })`) gives full control over the multi-step operation with automatic rollback.

**Alternatives considered**:
- **Incremental add/remove (separate `addChannels`/`removeChannels` arrays)**: More granular but significantly more complex. Requires diff computation, partial failure handling, and a more complex API surface. The spec explicitly states "PATCH with sourceChannelIds replaces all associations."
- **Prisma `set` on relations**: Prisma's `update({ data: { subscriptionListChannels: { set: [...] } } })` can replace relations, but requires providing full relation objects and doesn't support the `sourceChannelId` -> `SubscriptionListChannel` mapping cleanly. `deleteMany` + `createMany` is more explicit.
- **Upsert per channel**: `upsertMany` isn't a Prisma primitive. Individual upserts in a loop are N queries vs. 2 (deleteMany + createMany). Worse performance and more complex code.

## Decision 5: Response Shape

**Decision**: Return subscription lists with source channel details populated inline. Each list includes `id`, `name`, `destinationChannelId` (BigInt serialized as string), `destinationUsername`, `isActive`, `createdAt`, and a `sourceChannels` array. Each source channel entry includes `id`, `telegramId` (BigInt serialized as string), `username`, and `title`. The `userId` and `updatedAt` fields are excluded from responses as they are internal/not useful to the client.

**Rationale**: Populating source channels inline avoids N+1 queries on the client side and provides all information needed to render a list management UI in a single request. Prisma's `include` with `select` on the nested relation efficiently fetches only the needed source channel fields. BigInt fields (`destinationChannelId`, `telegramId`) are serialized as strings to avoid JavaScript number precision loss, consistent with the pattern established in feature 004 for `SourceChannel.telegramId`. The `sourceChannels` array is derived by mapping through `subscriptionListChannels` join records and extracting the `sourceChannel` relation.

**Alternatives considered**:
- **Return channel IDs only, require separate fetch**: Reduces payload size but forces the client to make additional requests. Since the channel details (title, username) are needed to display the list, this creates unnecessary round trips.
- **Separate endpoint for list channels**: A `GET /subscription-lists/:id/channels` endpoint would follow REST conventions but is unnecessary when the channel count per list is bounded (max 30 total across all lists). Inline population is simpler for both client and server.
- **Include all SubscriptionListChannel fields (join table)**: Exposing the join record's `id` and `subscriptionListId` adds no value to the client. Mapping to a flat `sourceChannels` array is cleaner.
