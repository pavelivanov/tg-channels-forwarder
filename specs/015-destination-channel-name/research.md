# Research: Destination Channel Name Input

## R1: How to resolve a @username to a channel ID via Bot API

**Decision**: Use grammY's `api.getChat("@username")` method.

**Rationale**: The Telegram Bot API `getChat` method accepts a `@username` string and returns a `Chat` object containing the numeric `id`. grammY wraps this as `api.getChat(chatId)` where `chatId` can be a number or `@username` string. The bot must have previously interacted with the chat (i.e., be a member/admin). This is the simplest approach — no additional dependencies.

**Alternatives considered**:
- MTProto (GramJS) `resolveUsername`: More powerful but requires userbot session, not available in the API app.
- Storing a username→ID mapping table: Unnecessary complexity — `getChat` resolves on demand.

## R2: Username validation format

**Decision**: Accept with or without `@` prefix. Normalize by stripping `@` before API call, then pass `@{username}` to `getChat`.

**Rationale**: Telegram channel usernames follow the pattern `[a-zA-Z][a-zA-Z0-9_]{3,}` (5-32 chars, starts with letter). Accepting both `mychannel` and `@mychannel` reduces user friction. Validation via `class-validator` `@Matches` decorator on the DTO.

**Alternatives considered**:
- Require `@` prefix always: More restrictive, worse UX.
- No client-side validation: Would lead to unnecessary API calls for obviously invalid inputs.

## R3: Where to place the resolution logic

**Decision**: Add `resolveChannel(username: string)` method to existing `BotService`. The `SubscriptionListsService` calls `resolveChannel` then `verifyBotAdmin` sequentially.

**Rationale**: `BotService` already owns the grammY `Api` instance and bot-related operations (`verifyBotAdmin`, `isHealthy`). Adding channel resolution there follows single-responsibility within the bot domain. The subscription-lists service orchestrates the two calls.

**Alternatives considered**:
- New `ChannelResolverService`: Over-engineering for a single method.
- Inline in subscription-lists service: Would require injecting grammY Api directly, breaking encapsulation.

## R4: Error handling for failed resolution

**Decision**: `resolveChannel` catches `GrammyError` and throws a NestJS `BadRequestException` with a user-friendly message. Different messages for "not found" (400/403/404 from Telegram) vs "service unavailable" (network errors).

**Rationale**: Follows the same pattern as `verifyBotAdmin` which distinguishes GrammyError (user error) from unexpected errors (service unavailable). The frontend displays the error message from the API response.

## R5: DTO field replacement strategy

**Decision**: Replace `destinationChannelId: number` with `destinationUsername: string` as a required field in Create DTO and optional in Update DTO. Remove `destinationChannelId` from both DTOs entirely — the API resolves it internally.

**Rationale**: The numeric ID is an implementation detail that users should never need to provide. The API handles resolution. This is a clean break rather than supporting both fields.

## R6: Backward compatibility for existing data

**Decision**: Existing subscription lists that have `destinationChannelId` but no `destinationUsername` will show the numeric ID as a fallback in the form. The API response continues to include both fields.

**Rationale**: Some existing lists may have been created before `destinationUsername` was populated. The form falls back to displaying the numeric ID if username is null, prompting users to update.
