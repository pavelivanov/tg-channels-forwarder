# Feature Specification: Telegram Listener Service

**Feature Branch**: `008-telegram-listener`
**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "Telegram Listener Service (MTProto Userbot) — Listen to subscribed channels via the userbot and push new messages to the queue."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Receive and Queue Channel Messages (Priority: P1)

The system connects to Telegram as a userbot and listens for new messages in subscribed channels. When a message arrives in a subscribed channel, the system extracts its content (text, caption, media information) and places a forwarding job onto the message queue for downstream processing.

**Why this priority**: This is the core purpose of the listener — without receiving and queuing messages, no forwarding can occur. This is the MVP.

**Independent Test**: Send a message to a subscribed test channel, verify a forwarding job with the correct payload appears in the message queue.

**Acceptance Scenarios**:

1. **Given** the listener is connected and a channel is in the active subscription list, **When** a text message is posted in that channel, **Then** a forwarding job containing the message ID, channel ID, text, and timestamp is placed on the queue.
2. **Given** the listener is connected and a channel is in the active subscription list, **When** a photo message with a caption is posted, **Then** a forwarding job containing the message ID, channel ID, caption, media type ("photo"), media file identifier, and timestamp is placed on the queue.
3. **Given** the listener is connected, **When** a message arrives from a channel that is NOT in the active subscription list, **Then** no forwarding job is created and the message is silently ignored.
4. **Given** the listener is connected, **When** multiple individual messages arrive in rapid succession from a subscribed channel, **Then** each message produces its own separate forwarding job.

---

### User Story 2 — Group Album Messages into a Single Job (Priority: P1)

When a user sends an album (multiple photos/videos grouped together) in a subscribed channel, the system collects all messages in the album within a short time window and combines them into a single forwarding job with a media group array, rather than creating separate jobs for each media item.

**Why this priority**: Albums are a common Telegram pattern. Without grouping, albums would be forwarded as separate unrelated messages, breaking the user experience.

**Independent Test**: Send an album (3 photos) to a subscribed channel. Verify that exactly one forwarding job is created containing all 3 media items in its media group array, and that the job is emitted after the collection window expires.

**Acceptance Scenarios**:

1. **Given** the listener is connected and a subscribed channel exists, **When** an album of 3 photos is posted (all sharing the same media group identifier), **Then** a single forwarding job is created with a media group array containing 3 entries, one per photo.
2. **Given** album messages are arriving, **When** the 300-millisecond collection window expires after the last message in the group, **Then** the combined forwarding job is emitted to the queue.
3. **Given** two separate albums are posted within seconds of each other, **When** they have different media group identifiers, **Then** two separate forwarding jobs are created, each with its own media group array.

---

### User Story 3 — Join and Leave Channels via the Userbot (Priority: P1)

When an operator adds a new source channel through the management interface, the system joins that channel using the userbot account. On success, the channel record is updated with the resolved channel identity and title, and messages from that channel begin flowing. When a channel is removed, the userbot leaves it.

**Why this priority**: Without the ability to join channels, the listener cannot subscribe to new sources. This completes the channel lifecycle started in Spec 04 (Channels API).

**Independent Test**: Call the join operation with a public channel username. Verify the userbot joins, the channel identity and title are returned, and new messages from that channel are received.

**Acceptance Scenarios**:

1. **Given** a valid public channel username, **When** the join operation is invoked, **Then** the system joins the channel and returns the channel's numeric identity and title.
2. **Given** the join operation succeeds, **When** the corresponding channel record is updated, **Then** the record reflects the resolved numeric identity, title, and active status.
3. **Given** the join operation fails (invalid channel, banned, etc.), **When** the error is caught, **Then** the pending channel record is deleted and an error is returned to the caller.
4. **Given** a channel's numeric identity, **When** the leave operation is invoked, **Then** the userbot leaves the channel.
5. **Given** the join operation is rate-limited to a maximum of 5 joins per hour, **When** a 6th join is attempted within the same hour, **Then** the request is rejected with a rate limit error.
6. **Given** the messaging platform returns a flood-wait penalty, **When** the system receives this signal, **Then** it waits the required duration before retrying.

---

### User Story 4 — Auto-Reconnect on Disconnection (Priority: P2)

The userbot connection may drop due to network issues or server-side disconnections. The system automatically reconnects with configurable retry attempts and delays, ensuring minimal message loss.

**Why this priority**: Reliability is essential for a long-running listener, but the core message flow must work first.

**Independent Test**: Simulate a disconnection event, verify the system attempts to reconnect with increasing delays, and resumes message processing after reconnection.

**Acceptance Scenarios**:

1. **Given** the userbot is connected, **When** the connection drops, **Then** the system logs the disconnection and begins automatic reconnection attempts.
2. **Given** reconnection attempts are in progress, **When** a reconnection succeeds, **Then** the system logs the reconnection, reloads the active channel list, and resumes message processing.
3. **Given** reconnection attempts are in progress, **When** multiple consecutive attempts fail, **Then** the retry delay increases up to the configured maximum retry count.

---

### User Story 5 — Wire Channel API to Userbot Operations (Priority: P2)

The existing channel management endpoint (POST /channels from Spec 04) currently creates a database record but does not actually join the channel. This story wires that endpoint to the userbot's join operation, so adding a channel through the API triggers the actual Telegram join.

**Why this priority**: Completes the integration between the API layer and the worker's listener service. Requires both the API (Spec 04) and the listener (US3) to be working.

**Independent Test**: Call POST /channels with a valid channel username via the API. Verify the userbot joins the channel, the database record is updated with the resolved identity and title and active status, and new messages from the channel are queued.

**Acceptance Scenarios**:

1. **Given** a user calls the channel creation endpoint with a valid username, **When** the userbot successfully joins the channel, **Then** the channel record is updated to active with the resolved numeric identity and title.
2. **Given** a user calls the channel creation endpoint with a valid username, **When** the userbot fails to join (channel not found, banned, rate limited), **Then** the pending channel record is deleted and an error response is returned.

---

### Edge Cases

- What happens when the same album message is received twice (duplicate delivery)? The system should deduplicate using the existing message deduplication service before queuing.
- What happens when a message contains no text, no caption, and no media (e.g., a service message like "channel photo updated")? The system ignores service messages and only processes content messages.
- What happens when the session credentials are invalid or expired at startup? The system fails fast with a clear error message and does not start.
- What happens when the database is unreachable at startup (cannot load active channels)? The system logs the error and retries loading the channel list, or fails fast if the database remains unavailable.
- What happens when a forwarding job cannot be placed on the queue (queue backing store unavailable)? The system logs an error. The message is lost for this attempt; the queue infrastructure's own retry/health mechanisms handle recovery.
- What happens when a channel the userbot is already a member of is joined again? The system treats it as a success and returns the existing channel identity and title.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST connect to the messaging platform as a userbot using session credentials provided via environment configuration.
- **FR-002**: System MUST, on startup, load all active source channels from the database and begin listening for new messages on those channels.
- **FR-003**: System MUST extract message content (message identifier, channel identifier, text, caption, media type, media file identifier, media group identifier, and timestamp) from each new message in a subscribed channel.
- **FR-004**: System MUST construct a forwarding job from the extracted message content and place it on the message queue.
- **FR-005**: System MUST group album messages (messages sharing the same media group identifier) within a 300-millisecond collection window into a single forwarding job containing a media group array.
- **FR-006**: System MUST emit the grouped album job after the 300-millisecond window expires, not before.
- **FR-007**: System MUST silently ignore messages from channels not in the active subscription list.
- **FR-008**: System MUST provide a join operation that subscribes the userbot to a channel given a username, returning the channel's numeric identity and title on success.
- **FR-009**: System MUST provide a leave operation that unsubscribes the userbot from a channel given its numeric identity.
- **FR-010**: System MUST rate-limit join operations to a maximum of 5 per hour with a random delay of 2–5 seconds before each join.
- **FR-011**: System MUST handle flood-wait penalties from the messaging platform by waiting the required duration before retrying the operation.
- **FR-012**: System MUST automatically reconnect on disconnection using configurable retry attempts with delay.
- **FR-013**: System MUST log key events: channel joined, channel join failed, userbot disconnected, userbot reconnected, and message received (at debug level).
- **FR-014**: System MUST integrate the join operation with the existing channel creation endpoint — on success, update the channel record to active with the resolved identity and title; on failure, delete the pending record and return an error.
- **FR-015**: System MUST fail fast at startup with a clear error if session credentials are missing or invalid.
- **FR-016**: System MUST support all standard content message types: text, photo, video, document, animation, audio, sticker, voice, and video note.

### Key Entities

- **Listener Session**: The authenticated userbot connection to the messaging platform. Configured via session string, application identifier, and application hash.
- **Subscribed Channel**: A source channel that the listener actively monitors. Loaded from the database at startup and updated when channels are joined or left.
- **Forwarding Job**: The unit of work placed on the queue. Contains message identity, channel identity, text/media content references, optional media group, and timestamp. Defined in the shared package (Spec 07).
- **Album Buffer**: A temporary in-memory collection that accumulates messages sharing the same media group identifier. Flushed to the queue as a single job after the 300ms window.
- **Rate Limiter**: An in-memory counter that enforces the maximum of 5 channel joins per hour, with a random 2–5 second delay before each join operation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New messages posted in subscribed channels appear as forwarding jobs in the queue within 2 seconds of being posted.
- **SC-002**: Albums (grouped media) are correctly combined into a single forwarding job 100% of the time, with all media items present.
- **SC-003**: The system reconnects automatically after a disconnection within 60 seconds under normal network conditions.
- **SC-004**: Channel join operations complete within 10 seconds for valid public channels.
- **SC-005**: The system correctly handles at least 6 distinct message types (text, photo, video, document, animation, audio) by extracting the appropriate content fields.
- **SC-006**: Rate limiting prevents more than 5 channel joins in any rolling 1-hour window.

## Assumptions

- The userbot session string is pre-generated (e.g., via a one-time interactive login script) and provided as an environment variable. This feature does not include interactive login or QR code authentication.
- The existing `SourceChannel` database model from Spec 04 already has `telegramId`, `title`, and `isActive` fields.
- The `ForwardJob` interface and `QueueProducer` from Spec 07 are available and working.
- The messaging platform's userbot API delivers messages in near-real-time with occasional duplicates or out-of-order delivery.
- The worker process has direct database access (via Prisma) for loading active channels at startup and for the join/leave integration.
- The API-to-worker communication for the join operation uses an inter-process mechanism (e.g., direct function call within the worker, or a separate RPC/queue command). The exact mechanism will be determined during planning.

## Scope Boundaries

**In scope**:
- Userbot connection, message listening, album grouping, job queuing
- Channel join/leave operations with rate limiting and flood-wait handling
- Auto-reconnect with exponential backoff
- Wiring POST /channels to the join operation
- Structured logging for all key events

**Out of scope**:
- Interactive Telegram login / session generation (pre-existing session assumed)
- Message forwarding logic (Spec 09)
- Channel deduplication beyond what the existing dedup service provides
- Admin UI for monitoring the listener
- Multi-account / multi-session support

## Dependencies

- **Spec 04** (Channels API): Provides `SourceChannel` model and POST /channels endpoint
- **Spec 07** (BullMQ Queue Setup): Provides `ForwardJob` interface, `QueueProducer`, and queue infrastructure
- **Spec 06** (Redis Dedup Service): Provides message deduplication before queuing
