# Feature Specification: Forwarder Service

**Feature Branch**: `009-forwarder-service`
**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "Forwarder Service (grammY Bot) — Consume queued messages and forward them to destination channels via a Telegram bot."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Forward Text Messages to Destinations (Priority: P1)

When a new text message arrives from a subscribed source channel, the system consumes it from the message queue, identifies all active subscription lists that include that source channel, and sends the message text (with formatting preserved) to each destination channel. After successful delivery, the message is recorded as forwarded to prevent future duplicates.

**Why this priority**: This is the core value of the entire aggregator — without forwarding, nothing else matters. Text messages are the most common message type.

**Independent Test**: Send a text message in a source channel that belongs to one subscription list. Verify the message appears in the destination channel with formatting intact.

**Acceptance Scenarios**:

1. **Given** a queued text message from source channel A, **When** channel A belongs to subscription list L with destination D, **Then** the message text with entities is delivered to destination D and marked as forwarded.
2. **Given** a queued text message from source channel A, **When** channel A belongs to two subscription lists with different destinations D1 and D2, **Then** the message is delivered to both D1 and D2.
3. **Given** a queued text message from source channel A, **When** channel A belongs to two subscription lists both targeting the same destination D, **Then** the message is delivered to D only once (dedup across lists).

---

### User Story 2 - Forward Media Messages (Priority: P1)

When a media message (photo, video, document, animation, audio) arrives from a subscribed source channel, the system forwards it to all matching destinations using the appropriate delivery method for that media type. Captions and formatting entities are preserved.

**Why this priority**: Media messages are equally critical to text — channels frequently post images, videos, and documents. Without media support the forwarder has limited utility.

**Independent Test**: Send a photo with a caption in a source channel. Verify the photo and caption appear in the destination channel.

**Acceptance Scenarios**:

1. **Given** a queued photo message with a caption, **When** processed, **Then** the photo is delivered to the destination with caption and entities preserved.
2. **Given** a queued video message, **When** processed, **Then** the video is delivered to the destination with caption preserved.
3. **Given** a queued document/animation/audio message, **When** processed, **Then** the file is delivered using the correct delivery method for its type.

---

### User Story 3 - Forward Albums (Priority: P1)

When an album (media group) arrives from a subscribed source channel, the system forwards it as a single grouped media delivery to each destination, preserving the album structure.

**Why this priority**: Albums are a common posting format in Telegram channels. Breaking albums into individual messages degrades the user experience.

**Independent Test**: Send a 3-photo album in a source channel. Verify all 3 photos arrive as a single album in the destination.

**Acceptance Scenarios**:

1. **Given** a queued album job containing 3 photos, **When** processed, **Then** a single grouped media delivery containing all 3 photos is sent to the destination.
2. **Given** an album with mixed media types (photos and videos), **When** processed, **Then** the album is delivered as a single grouped delivery with correct media types.

---

### User Story 4 - Deduplicate Messages (Priority: P2)

When a message has already been forwarded to a particular destination, subsequent identical messages are silently skipped to prevent spam in destination channels.

**Why this priority**: Dedup prevents noise — without it, overlapping subscription lists or repeated source messages would flood destinations. Important but secondary to core forwarding.

**Independent Test**: Forward a message to a destination, then re-queue the same message. Verify the second delivery is skipped.

**Acceptance Scenarios**:

1. **Given** a message already forwarded to destination D, **When** an identical message is queued for D, **Then** delivery is skipped and a dedup log entry is recorded.
2. **Given** a message forwarded to destination D1, **When** an identical message is queued for a different destination D2, **Then** the message is delivered to D2 (dedup is per-destination).

---

### User Story 5 - Rate Limiting (Priority: P2)

The system enforces rate limits to avoid hitting platform limits: a global cap of 20 messages per second across all destinations, and a per-destination cap of 15 messages per minute. When limits are reached, messages are queued and processed once capacity becomes available.

**Why this priority**: Without rate limiting the bot risks being temporarily banned by Telegram. Critical for reliability, but the system works without it at low volume.

**Independent Test**: Rapidly enqueue 30 messages for the same destination. Verify they are delivered over time (spread across at least 2 minutes) rather than all at once.

**Acceptance Scenarios**:

1. **Given** 25 messages queued simultaneously for various destinations, **When** processing, **Then** no more than 20 messages are sent in any 1-second window.
2. **Given** 20 messages queued for the same destination, **When** processing, **Then** no more than 15 are sent within any 1-minute window, with the remainder delayed.

---

### User Story 6 - Retry on Failure (Priority: P2)

When a message delivery fails due to a temporary error (e.g., rate-limit response from Telegram with a retry-after header), the system retries delivery. When a message fails due to a permanent error (e.g., bot was removed from the channel), it fails after the configured maximum retry attempts.

**Why this priority**: Retries ensure transient failures don't cause message loss. Essential for reliability in production.

**Independent Test**: Simulate a temporary error on the first send attempt. Verify the message is retried and eventually delivered.

**Acceptance Scenarios**:

1. **Given** a message delivery that returns a rate-limit (429) response with a retry-after value, **When** retried, **Then** the system waits the specified duration before retrying and ultimately delivers the message.
2. **Given** a message delivery that fails with a non-retryable error, **When** maximum retry attempts (3) are exhausted, **Then** the job is moved to the dead-letter queue and logged as permanently failed.
3. **Given** a temporary network error, **When** the next retry succeeds, **Then** the message is delivered and marked as forwarded.

---

### Edge Cases

- What happens when a subscription list has no active source channels? The forwarder finds no matching lists for the source channel, so the message is not forwarded anywhere — this is expected behavior.
- What happens when the bot is not an admin in the destination channel? The delivery fails, retries are attempted, and after max retries the job moves to the dead-letter queue.
- What happens when a message has no text and no media (service message)? These are filtered out upstream by the listener; the forwarder never receives them.
- What happens when an album contains more than 10 items? Albums are capped at 10 upstream by the album grouper. The forwarder processes whatever it receives.
- What happens when two messages arrive nearly simultaneously for the same destination? Rate limiting ensures they are spaced appropriately.
- What happens when Redis (dedup) is unavailable? The dedup service fails open (allows delivery rather than blocking), as implemented in the existing DedupService.
- What happens when a subscription list becomes inactive between job enqueue and processing? The system queries only active lists at processing time, so inactive lists are excluded.
- What happens when a media message has no caption? The message is delivered with just the media, no caption text.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST consume jobs from the message-forward queue and process each one to completion or failure.
- **FR-002**: For each job, the system MUST query all active subscription lists that include the source channel identified in the job.
- **FR-003**: For each matching subscription list, the system MUST deliver the message to the list's destination channel.
- **FR-004**: Before delivering to a destination, the system MUST check for duplicates. If the message has already been sent to that destination, delivery MUST be skipped with a log entry.
- **FR-005**: When the same destination appears in multiple matching subscription lists, the system MUST deliver the message to that destination only once.
- **FR-006**: Text messages MUST be delivered with formatting entities preserved.
- **FR-007**: Photo, video, document, animation, and audio messages MUST be delivered using the appropriate media delivery method with captions and entities preserved.
- **FR-008**: Album (media group) messages MUST be delivered as a single grouped media delivery preserving the album structure.
- **FR-009**: The system MUST enforce a global rate limit of 20 messages per second.
- **FR-010**: The system MUST enforce a per-destination rate limit of 15 messages per minute.
- **FR-011**: On a rate-limit (429) response, the system MUST retry after the duration specified in the response.
- **FR-012**: On other delivery errors, the system MUST retry up to the configured maximum attempts (3) with exponential backoff.
- **FR-013**: After all retry attempts are exhausted, the failed job MUST be moved to the dead-letter queue.
- **FR-014**: On successful delivery, the system MUST mark the message as forwarded in the dedup store.
- **FR-015**: The system MUST log: `message_forwarded` on success, `message_deduplicated` when dedup skips, and `forward_failed` on error.

### Key Entities

- **ForwardJob**: A queued message to be forwarded, containing source channel ID, message ID, text/caption, media info, and optional album data.
- **SubscriptionList**: A user-defined list mapping source channels to a single destination channel. Has an active/inactive state.
- **SubscriptionListChannel**: Junction entity linking a subscription list to its source channels.
- **SourceChannel**: A Telegram channel being monitored for new messages.
- **DedupRecord**: An ephemeral record (72-hour TTL) keyed by destination + content hash, preventing duplicate deliveries.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A text message from a subscribed source channel reaches all configured destination channels within 10 seconds under normal load.
- **SC-002**: Media messages (photo, video, document, animation, audio) are delivered with captions and formatting intact — zero formatting loss.
- **SC-003**: Albums arrive at destinations as a single grouped delivery, not as individual messages.
- **SC-004**: Duplicate messages are prevented — the same content is never delivered to the same destination twice within the 72-hour dedup window.
- **SC-005**: The system sustains a throughput of at least 20 messages per second globally without triggering platform rate-limit bans.
- **SC-006**: Per-destination delivery does not exceed 15 messages per minute.
- **SC-007**: Temporary failures are recovered automatically — at least 95% of retryable errors result in successful delivery on retry.
- **SC-008**: All forwarding operations produce structured log entries sufficient for operational monitoring and debugging.

## Assumptions

- The bot token is for a bot that has already been added as an admin to all destination channels (the system does not manage bot permissions).
- The existing DedupService (Redis-backed, 72-hour TTL, fail-open) is used as-is for duplicate detection.
- The existing BullMQ queue infrastructure (message-forward queue, DLQ, retry with exponential backoff) is used as the job source.
- The existing Prisma schema (SubscriptionList, SubscriptionListChannel, SourceChannel) is used for routing lookups.
- The message-forward queue consumer in the worker will be replaced or extended to delegate to the ForwarderService instead of the current no-op/stub processing.
- Global rate limit (20 msg/s) and per-destination rate limit (15 msg/min) are initial values that may be tuned based on production behavior.
