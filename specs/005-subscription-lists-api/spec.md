# Feature Specification: Subscription List CRUD API

**Feature Branch**: `005-subscription-lists-api`
**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "Subscription List CRUD API — users can create, read, update, and delete subscription lists with limit enforcement"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse My Subscription Lists (Priority: P1)

An authenticated user wants to view all their active subscription lists, including the source channels assigned to each list, so they can understand their current forwarding setup.

**Why this priority**: Reading existing data is the foundational operation. Users need to see their lists before they can manage them. This also provides the base module structure for all other CRUD operations.

**Independent Test**: Can be fully tested by authenticating a user who has subscription lists with assigned source channels, then requesting the list. Returns active lists with populated source channels.

**Acceptance Scenarios**:

1. **Given** an authenticated user with one or more active subscription lists, **When** the user requests their lists, **Then** the system returns all active lists for that user, each including the list's details and its associated source channels.
2. **Given** an authenticated user with no active subscription lists, **When** the user requests their lists, **Then** the system returns an empty array.
3. **Given** an authenticated user with both active and soft-deleted (inactive) lists, **When** the user requests their lists, **Then** only active lists are returned.
4. **Given** an unauthenticated request, **When** the list is requested, **Then** the system returns a 401 unauthorized error.

---

### User Story 2 - Create a Subscription List (Priority: P1)

An authenticated user wants to create a new subscription list by providing a name, a destination channel, and one or more source channels to forward from. The system enforces limits on the number of lists a user can have and the total number of source channels across all their lists.

**Why this priority**: Creating lists is the core write operation that enables the product's primary value — setting up channel forwarding configurations.

**Independent Test**: Can be tested by creating a list with valid inputs and verifying it persists, then testing limit enforcement by exceeding the user's maximum list count or total source channel count.

**Acceptance Scenarios**:

1. **Given** an authenticated user who has not reached their list limit, **When** the user submits a valid list with a name, destination channel, and one or more active source channels, **Then** the system creates the list and returns it with populated source channel details.
2. **Given** an authenticated user who has reached their maximum list count (maxLists), **When** the user attempts to create another list, **Then** the system returns a 403 error indicating the list limit has been reached.
3. **Given** an authenticated user whose total source channels across all active lists would exceed 30 with the new list, **When** the user attempts to create the list, **Then** the system returns a 403 error indicating the source channel limit has been reached.
4. **Given** a request referencing source channel IDs that do not exist or are inactive, **When** the user attempts to create a list, **Then** the system returns a 400 error identifying the invalid channel references.
5. **Given** a request with an empty source channels array, **When** the user attempts to create a list, **Then** the system returns a 400 validation error.

---

### User Story 3 - Update a Subscription List (Priority: P1)

An authenticated user wants to modify an existing subscription list — changing its name, destination channel, or source channels. The system re-validates channel limits, excluding the current list's channels from the count before adding new ones.

**Why this priority**: Updating is essential for users to adjust their forwarding setup as their needs evolve. Without updates, users would need to delete and recreate lists.

**Independent Test**: Can be tested by creating a list, then updating it with different source channels and verifying the changes persist and limits are re-validated correctly.

**Acceptance Scenarios**:

1. **Given** an authenticated user who owns an active subscription list, **When** the user submits a partial update (e.g., changing only the name), **Then** the system updates only the specified fields and returns the updated list.
2. **Given** an authenticated user who owns an active subscription list, **When** the user updates the source channels, **Then** the system re-validates the total channel limit by excluding the current list's channels from the count and adding the new ones.
3. **Given** an authenticated user who does NOT own the specified list, **When** the user attempts to update it, **Then** the system returns a 404 not found error (non-owners cannot distinguish "not found" from "not owned").
4. **Given** a list that has been soft-deleted, **When** the user attempts to update it, **Then** the system returns a 404 not found error.
5. **Given** an update that would cause the total source channels across all active lists to exceed 30, **When** the user submits the update, **Then** the system returns a 403 error indicating the source channel limit has been reached.

---

### User Story 4 - Delete a Subscription List (Priority: P2)

An authenticated user wants to remove a subscription list they no longer need. The system performs a soft delete by marking the list as inactive, preserving the data for potential audit or recovery.

**Why this priority**: Deletion is important for cleanup but less critical than creation and modification. A soft delete approach is simpler and safer than hard deletion.

**Independent Test**: Can be tested by creating a list, deleting it, then verifying it no longer appears in the user's active lists but still exists in the database as inactive. Also verify that the deleted list's channels no longer count toward the user's channel limit.

**Acceptance Scenarios**:

1. **Given** an authenticated user who owns an active subscription list, **When** the user deletes the list, **Then** the system marks it as inactive and returns a success response.
2. **Given** an authenticated user who does NOT own the specified list, **When** the user attempts to delete it, **Then** the system returns a 404 not found error (non-owners cannot distinguish "not found" from "not owned").
3. **Given** a list that has already been soft-deleted, **When** the user attempts to delete it again, **Then** the system returns a 404 not found error.
4. **Given** a user who deletes a list, **When** the user subsequently creates a new list, **Then** the deleted list's source channels no longer count toward the user's channel limit, and the deleted list no longer counts toward the user's list limit.

---

### User Story 5 - Limit Enforcement Across Operations (Priority: P2)

The system consistently enforces two limits across all write operations: (1) a per-user maximum number of active subscription lists (governed by the user's maximum list setting), and (2) a global maximum of 30 total source channel assignments across all of a user's active lists. The same source channel appearing in two different lists counts once per list toward this total.

**Why this priority**: While limit enforcement is embedded in create/update stories, it deserves its own story because the counting logic is shared across operations and must be tested holistically.

**Independent Test**: Can be tested by creating multiple lists up to the limit, verifying the limit is enforced, then deleting a list and verifying the freed capacity allows new creation.

**Acceptance Scenarios**:

1. **Given** a user with a maximum list setting of 1 who already has 1 active list, **When** the user tries to create a second list, **Then** the system rejects it with a limit error.
2. **Given** a user with 25 source channel assignments across active lists, **When** the user tries to create a list with 6 new source channels, **Then** the system rejects it (25 + 6 = 31 > 30).
3. **Given** a user with the same source channel in two different lists, **When** the system counts total source channels, **Then** each occurrence counts separately (once per list, not deduplicated globally).
4. **Given** a user at the list limit who soft-deletes a list, **When** the user tries to create a new list, **Then** the system allows it because the deleted list no longer counts.
5. **Given** a user updating a list's source channels from 5 channels to 3 channels, **When** the system validates limits, **Then** it correctly accounts for the reduction (excludes the current list's old channels, adds the new ones).

---

### Edge Cases

- What happens when a user tries to create a list with a destination channel ID of 0 or a negative number? The system accepts any numeric value for the destination channel ID — validation of whether the destination is a real Telegram channel is out of scope for this feature.
- What happens when a user submits duplicate source channel IDs in a single request? The system deduplicates them before processing and limit calculation.
- What happens when a source channel becomes inactive after being assigned to a list? The list retains the association, but the channel is no longer selectable for new lists or updates. Existing associations are not automatically removed.
- What happens when a user provides an empty name for a list? The system returns a 400 validation error — names must be non-empty strings.
- What happens when a user tries to update only the name without providing source channels? The system updates only the name; source channel associations remain unchanged.
- What happens when a user reaches exactly the limit (30 source channels)? The system allows it — the limit is "at most 30," meaning 30 is valid.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST return all active subscription lists for the authenticated user, each populated with its associated source channels.
- **FR-002**: Each subscription list in responses MUST include: id, name, destinationChannelId (as string), destinationUsername, isActive, createdAt, and an array of source channels with their details.
- **FR-003**: System MUST allow creation of a subscription list with a name, destination channel ID, optional destination username, and a non-empty array of active source channel IDs.
- **FR-004**: System MUST reject list creation when the user's active list count would exceed their maximum list limit, returning a 403 error with a descriptive message.
- **FR-005**: System MUST reject list creation or update when the user's total source channel assignments across all active lists would exceed 30, returning a 403 error with a descriptive message.
- **FR-006**: System MUST validate that all submitted source channel IDs reference existing, active source channels; invalid or inactive references result in a 400 error.
- **FR-007**: System MUST support partial updates to a subscription list's name, destination channel ID, destination username, and source channel associations.
- **FR-008**: System MUST re-validate the channel limit on update by excluding the target list's current channel count before adding the new channels.
- **FR-009**: System MUST verify that the authenticated user owns the subscription list before allowing update or delete operations; non-owners receive a 404 error (indistinguishable from "not found" to prevent resource existence leakage).
- **FR-010**: System MUST perform soft deletion by setting the list's active status to false rather than removing the record.
- **FR-011**: System MUST use a shared counting method for determining a user's total source channels across active lists, supporting an optional parameter to exclude a specific list from the count.
- **FR-012**: All subscription list endpoints MUST require authentication; unauthenticated requests MUST receive a 401 error.
- **FR-013**: System MUST deduplicate source channel IDs within a single create or update request before processing.
- **FR-014**: System MUST return a 404 error when attempting to update or delete a list that does not exist or has been soft-deleted.

### Key Entities

- **Subscription List**: Represents a user's forwarding configuration. Key attributes: unique identifier, owner user reference, display name, destination channel (numeric ID and optional username), active/inactive status, and timestamps. Each list has one or more source channel associations.
- **Subscription List Channel**: Represents the many-to-many relationship between a subscription list and its source channels. Constrained to one association per source channel per list.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can retrieve their subscription lists with populated source channels in under 1 second.
- **SC-002**: Users can create, update, and delete subscription lists and receive a response in under 2 seconds.
- **SC-003**: 100% of limit enforcement scenarios (list count, channel count) correctly prevent violations across create and update operations.
- **SC-004**: Cross-user access is denied in 100% of attempts — no user can view, modify, or delete another user's subscription lists.
- **SC-005**: Soft-deleted lists are excluded from all active queries and do not count toward any limits.
- **SC-006**: All 7 specified test scenarios pass: list limit enforcement, channel limit enforcement, per-list channel counting, update recalculation, soft delete behavior, cross-user denial, and inactive channel rejection.

## Assumptions

- The destination channel ID is a raw numeric identifier. Validation of whether it corresponds to a real Telegram channel is out of scope — that will be handled by a future userbot integration feature.
- The optional destination username field is informational only — it helps users identify their destination but is not validated against Telegram.
- The per-user list limit is governed by the existing maximum list setting on the user profile (default: 1). Changing this limit is an admin operation outside the scope of this feature.
- The global source channel limit of 30 applies to the sum of source channels across all active lists, counting each assignment individually (not deduplicated across lists).
- When source channels are updated on a list, the system replaces all existing associations with the new set (full replacement, not incremental add/remove).
- Subscription list names have no uniqueness constraint — a user may have multiple lists with the same name.
