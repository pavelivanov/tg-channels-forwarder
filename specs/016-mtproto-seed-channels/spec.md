# Feature Specification: MTProto Seed Channels

**Feature Branch**: `016-mtproto-seed-channels`
**Created**: 2026-02-19
**Status**: Draft
**Input**: User description: "using Telegram MTProto env keys add source channels to the database: manually calling a script (as seed)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Seed Source Channels from a List of Usernames (Priority: P1)

As a developer/operator, I want to run a CLI script that takes a list of Telegram channel usernames, resolves each one via the MTProto API to get the real `telegramId` and `title`, and upserts them into the `SourceChannel` table so they are ready for the listener to monitor.

**Why this priority**: Without source channels in the database, the forwarding pipeline has nothing to listen to. This is the foundational data-seeding step that unblocks all other functionality.

**Independent Test**: Can be fully tested by running the script with a list of known public channel usernames and verifying rows appear in the `SourceChannel` table with correct `telegramId`, `username`, and `title`.

**Acceptance Scenarios**:

1. **Given** the database has no source channels and the MTProto session is valid, **When** the operator runs the seed script with a comma-separated list of channel usernames (e.g., `@channel1,@channel2`), **Then** the script resolves each channel via MTProto, upserts them into `SourceChannel`, and prints a summary of added/updated channels.
2. **Given** a channel username is already in the database, **When** the seed script is run with that username again, **Then** the existing record is updated (title refreshed) rather than duplicated.
3. **Given** the MTProto session string is missing or invalid, **When** the script runs, **Then** it exits with a clear error message indicating the session configuration issue.
4. **Given** one of the usernames in the list cannot be resolved (e.g., doesn't exist or is private), **When** the script runs, **Then** it logs a warning for that channel, skips it, and continues processing the remaining channels.

---

### User Story 2 - Join Channels via MTProto During Seed (Priority: P2)

As a developer/operator, I want the seed script to optionally join each channel via the MTProto userbot account so the listener can receive messages from them, rather than requiring a separate join step.

**Why this priority**: Resolving channels gets them into the database, but the userbot must also be a member to receive messages. Combining both into one script simplifies the setup workflow.

**Independent Test**: Can be tested by running the script with a `--join` flag, verifying the userbot has joined the channels (via Telegram), and that the `SourceChannel` records have `isActive: true`.

**Acceptance Scenarios**:

1. **Given** a valid MTProto session and a list of channel usernames, **When** the operator runs the seed script with the `--join` flag, **Then** the script resolves each channel, joins it via the userbot, and upserts the record with `isActive: true`.
2. **Given** the userbot is already a member of a channel, **When** the script runs with `--join`, **Then** it skips the join step for that channel without error and still upserts the record.
3. **Given** the `--join` flag is not provided, **When** the script runs, **Then** channels are resolved and upserted but the userbot does not attempt to join any channels.

---

### Edge Cases

- What happens when the channel list is empty? The script prints a usage message and exits with a non-zero code.
- What happens when a channel username has a leading `@`? The script strips it before resolving.
- What happens when the same username appears multiple times in the list? The script deduplicates before processing.
- What happens when the Telegram API rate-limits the requests? The script adds a delay between resolutions (2-3 seconds) and retries on `FloodWaitError` after the required wait time.
- What happens when the database is unreachable? The script exits with a clear connection error before attempting any resolutions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a seed script executable via `pnpm seed:channels` (or similar npm script) from the `apps/api` directory.
- **FR-002**: The script MUST accept a list of Telegram channel usernames as a CLI argument (comma-separated or space-separated).
- **FR-003**: The script MUST use the existing `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_SESSION` environment variables to initialize the MTProto client.
- **FR-004**: For each channel username, the script MUST resolve the channel via MTProto to obtain the numeric `telegramId` and `title`.
- **FR-005**: The script MUST upsert each resolved channel into the `SourceChannel` table, matching on `username` (to avoid duplicates) and updating `telegramId` and `title` on conflict.
- **FR-006**: The script MUST strip leading `@` from usernames before processing.
- **FR-007**: The script MUST deduplicate the input list before processing.
- **FR-008**: The script MUST log a summary at completion showing how many channels were added, updated, and skipped (due to errors).
- **FR-009**: When the `--join` flag is provided, the script MUST join each resolved channel via the userbot MTProto account.
- **FR-010**: The script MUST add a 2-3 second delay between channel resolutions to avoid Telegram rate limits.
- **FR-011**: The script MUST handle `FloodWaitError` by waiting the required time and retrying.
- **FR-012**: The script MUST continue processing remaining channels if one fails to resolve or join.

### Key Entities

- **SourceChannel** (existing): Represents a Telegram channel to monitor. Key attributes: `telegramId` (BigInt, unique), `username` (String, unique), `title` (String), `isActive` (Boolean).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operator can seed 10+ channels in a single script invocation, with all resolved channels appearing in the database within 60 seconds.
- **SC-002**: Running the script twice with the same channel list produces no duplicate rows — only updates to existing records.
- **SC-003**: If 1 out of 10 channels fails to resolve, the remaining 9 are still successfully seeded.
- **SC-004**: The script provides clear console output showing progress and a final summary (added/updated/skipped counts).
