# Feature Specification: Fix Message Forwarding Bug

**Feature Branch**: `020-fix-forwarding-bug`
**Created**: 2026-02-22
**Status**: Draft
**Input**: User description: "the forwarding works incorrectly, there are 2 channels that have sent messages but only one message was forwarded. I've create 2 new channels for testing, added them to my subsctiptions list, sent a message to each channel - the service didn't forward them. Find the issue and fix it. Cover it with tests"

## Root Cause Analysis

The message listener registers a GramJS `NewMessage` event handler at startup with a **static** `chats` filter containing only the channels active at that moment. When new source channels are later joined via the `ChannelOpsConsumer` (triggered when a user adds channels to a subscription list), the system fails in two ways:

1. **Static event filter**: The GramJS event handler's `chats` parameter is set once at startup and never updated — new channels are invisible to the event handler.
2. **Stale in-memory channel set**: The `activeChannelIds` set in the listener is only refreshed at startup and on reconnect — not when the channel-ops consumer successfully joins a new channel.

This explains both symptoms:
- **New test channels not forwarded**: Channels joined after startup aren't in the event handler's filter.
- **Only 1 of 2 existing channels forwarded**: If one channel was added after the last worker restart (or a worker restart occurred between adds), only the earlier channel would be in the filter.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Messages from newly-added channels are forwarded (Priority: P1)

A user adds new source channels to their subscription list. Messages posted to those channels should be forwarded to the destination channel, even if the channels were added after the worker was already running.

**Why this priority**: This is the core bug — the primary forwarding functionality is broken for any channel added after worker startup.

**Independent Test**: Can be fully tested by adding a channel to a subscription list, sending a message to that channel, and verifying it arrives in the destination channel.

**Acceptance Scenarios**:

1. **Given** the worker is running and listening to existing channels, **When** a new source channel is joined via channel-ops, **Then** the listener immediately begins tracking messages from that channel.
2. **Given** a source channel was joined after worker startup, **When** a message is posted to that channel, **Then** the message is enqueued for forwarding and delivered to all matching destination channels.
3. **Given** the listener is tracking a channel that gets removed (leave operation), **When** a message is posted to that channel, **Then** the message is NOT enqueued or forwarded.

---

### User Story 2 - All matching subscription lists receive forwarded messages (Priority: P2)

When a message arrives from a source channel, it should be forwarded to ALL active subscription lists that include that channel — not just one.

**Why this priority**: Ensures correctness of the forwarding fan-out; a single source message may map to multiple destinations.

**Independent Test**: Can be tested by creating two subscription lists pointing to different destinations, both including the same source channel, then verifying the message appears in both destinations.

**Acceptance Scenarios**:

1. **Given** a source channel is included in 2 active subscription lists with different destinations, **When** a message is posted to the source channel, **Then** the message is forwarded to both destinations.
2. **Given** a source channel is included in 1 active and 1 inactive subscription list, **When** a message is posted, **Then** the message is only forwarded to the active list's destination.

---

### User Story 3 - Forwarding covered by automated tests (Priority: P3)

The forwarding pipeline has test coverage ensuring the dynamic channel tracking and end-to-end forwarding logic work correctly, preventing regressions.

**Why this priority**: Tests prevent this class of bug from recurring and document the expected behavior.

**Independent Test**: Can be verified by running the test suite and confirming all forwarding-related tests pass.

**Acceptance Scenarios**:

1. **Given** the test suite, **When** tests run, **Then** dynamic channel addition/removal is verified.
2. **Given** the test suite, **When** tests run, **Then** end-to-end forwarding from source → queue → forwarder → destination is verified.

---

### Edge Cases

- What happens when a channel is joined but the GramJS client is temporarily disconnected? (Answer: On reconnect, `loadActiveChannels` is called, and the event handler should be re-registered with the updated channel list.)
- What happens when the same channel is joined twice in rapid succession? (Answer: The channel set uses telegramId as key, so duplicates are idempotent.)
- What happens when a channel leave operation occurs while a message from that channel is in the BullMQ queue? (Answer: The forwarder queries the DB at processing time, so if the subscription list is still active, the message is forwarded; this is acceptable behavior.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The listener MUST update its tracked channel set when a new source channel is successfully joined via channel-ops.
- **FR-002**: The listener MUST remove a channel from its tracked set when a leave operation succeeds.
- **FR-003**: The message event handler MUST be able to receive messages from channels added after startup (either by removing the static `chats` filter or by dynamically updating it).
- **FR-004**: The listener MUST re-register its event handler with the current channel set on reconnect.
- **FR-005**: The forwarder MUST forward a message to ALL active subscription lists that include the source channel, not just the first match.
- **FR-006**: The system MUST have unit tests covering dynamic channel addition to the listener.
- **FR-007**: The system MUST have tests verifying the forwarder fans out to multiple destinations.

### Key Entities

- **ListenerService**: Manages the GramJS connection and in-memory channel tracking set; must support dynamic add/remove of channels.
- **ChannelOpsConsumer**: Processes channel join/leave operations; must notify the listener after successful operations.
- **ForwarderService**: Queries subscription lists by source channel telegramId and forwards to all matching destinations.

## Assumptions

- The GramJS `NewMessage` event's `chats` filter is client-side only (GramJS receives all updates regardless, the filter merely controls which ones trigger the handler). Removing it does not increase network traffic.
- The worker runs as a single process. No inter-process coordination is needed for channel tracking updates.
- The `activeChannelIds` check in `handleNewMessage` is sufficient filtering; the GramJS `chats` filter is redundant once dynamic tracking is implemented.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Messages from channels added after worker startup are forwarded within the normal processing time (under 10 seconds).
- **SC-002**: 100% of active subscription lists matching a source channel receive the forwarded message.
- **SC-003**: All new and existing forwarding tests pass with zero failures.
- **SC-004**: No regression in forwarding for channels that were active at worker startup.
