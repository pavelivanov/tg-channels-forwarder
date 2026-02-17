# Quickstart: Forwarder Service

## Scenario 1: Text Message Forwarding (MVP)

**Setup**: Source channel A is in subscription list L targeting destination D.

1. A `ForwardJob` with `{ sourceChannelId: 100, messageId: 1, text: "Hello **bold**", timestamp: ... }` is consumed from the `message-forward` queue.
2. ForwarderService queries Prisma: find active subscription lists containing source channel with `telegramId = 100`.
3. Returns: `[{ destinationChannelId: -1001234567890 }]`
4. Dedup check: `isDuplicate(-1001234567890, "Hello **bold**")` → `false`
5. Rate limiter: `execute(-1001234567890, () => sender.sendText(-1001234567890, "Hello **bold**", entities))`
6. grammY: `api.sendMessage(-1001234567890, "Hello **bold**", { entities })`
7. On success: `markAsForwarded(-1001234567890, "Hello **bold**")`
8. Log: `message_forwarded { sourceChannelId: 100, destinationChannelId: -1001234567890, messageId: 1 }`

**Expected result**: Message appears in destination channel D with bold formatting preserved.

## Scenario 2: Photo with Caption

1. `ForwardJob` with `{ sourceChannelId: 100, messageId: 2, mediaType: "photo", mediaFileId: "AgACAgIAAxk...", caption: "Check this out" }`
2. Route → destination -1001234567890
3. Dedup check on caption text → not duplicate
4. `api.sendPhoto(-1001234567890, "AgACAgIAAxk...", { caption: "Check this out", caption_entities })`
5. Mark forwarded, log success.

## Scenario 3: Album (Media Group)

1. `ForwardJob` with `mediaGroup: [{ mediaType: "photo", mediaFileId: "f1", caption: "Album caption" }, { mediaType: "photo", mediaFileId: "f2" }, { mediaType: "video", mediaFileId: "f3" }]`
2. Route → destination -1001234567890
3. Dedup check on caption → not duplicate
4. Build InputMedia array:
   - `InputMediaBuilder.photo("f1", { caption: "Album caption" })`
   - `InputMediaBuilder.photo("f2")`
   - `InputMediaBuilder.video("f3")`
5. `api.sendMediaGroup(-1001234567890, media)`
6. Mark forwarded, log success.

## Scenario 4: Multi-Destination (Same Message to Two Channels)

1. Source channel 100 is in list L1 (dest D1) and list L2 (dest D2).
2. Route query returns: `[D1, D2]` (unique destinations).
3. For D1: dedup → not dup → send → mark forwarded.
4. For D2: dedup → not dup → send → mark forwarded.
5. Both destinations receive the message independently.

## Scenario 5: Cross-List Dedup (Same Destination)

1. Source channel 100 is in list L1 (dest D1) and list L2 (also dest D1).
2. Route query returns unique destinations: `[D1]` (deduplicated at query level).
3. Send once to D1. No double-send.

## Scenario 6: Duplicate Message Skipped

1. Message "Hello" was already forwarded to D1 (dedup key exists in Redis).
2. Same message arrives again for source channel 100.
3. Route → D1.
4. `isDuplicate(D1, "Hello")` → `true`.
5. Log `message_deduplicated`, skip send.

## Scenario 7: 429 Rate Limit Error

1. Telegram responds with `{ error_code: 429, parameters: { retry_after: 30 } }`.
2. `@grammyjs/auto-retry` plugin catches it, waits 30s, retries transparently.
3. If auto-retry also fails (exceeds max attempts), the error propagates.
4. BullMQ catches the thrown error, schedules a retry with exponential backoff.
5. After 3 total BullMQ attempts, job moves to DLQ.

## Scenario 8: Non-Retryable Error (Bot Removed from Channel)

1. `api.sendMessage(chatId, text)` throws `GrammyError` with `error_code: 403, description: "bot was kicked"`.
2. ForwarderService logs `forward_failed`, throws the error.
3. BullMQ retries 3 times (exponential backoff).
4. After 3 failures, job moves to DLQ.
5. Operator inspects DLQ, discovers bot was removed from the destination.

## Test Verification Matrix

| Test | Input | Expected Output |
|------|-------|-----------------|
| Text forwarded | ForwardJob with text | `sendMessage` called with correct chat_id and entities |
| Photo forwarded | ForwardJob with photo mediaType | `sendPhoto` called with fileId and caption |
| Video forwarded | ForwardJob with video mediaType | `sendVideo` called with fileId and caption |
| Document forwarded | ForwardJob with document mediaType | `sendDocument` called with fileId and caption |
| Animation forwarded | ForwardJob with animation mediaType | `sendAnimation` called with fileId |
| Audio forwarded | ForwardJob with audio mediaType | `sendAudio` called with fileId and caption |
| Album forwarded | ForwardJob with mediaGroup array | `sendMediaGroup` called with InputMedia array |
| Dedup hit | Same text already forwarded to same dest | Send NOT called, `message_deduplicated` logged |
| Multi-dest | Source in 2 lists, different dests | Send called for each destination |
| Same-dest dedup | Source in 2 lists, same dest | Send called once (unique dest) |
| 429 retry | GrammyError 429 | Error thrown, BullMQ retries |
| Fatal after 3 | Error on all 3 attempts | Job in DLQ |
