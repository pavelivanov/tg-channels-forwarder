# Research: Bot Admin Verification & Destination Validation

**Feature Branch**: `010-bot-admin-verification`
**Date**: 2026-02-17

## R1: How to verify bot admin status in a Telegram channel

**Decision**: Use grammY `Api` class standalone (no Bot instance, no polling) with `api.getChatMember(channelId, botUserId)` and check if `status` is `"administrator"` or `"creator"`.

**Rationale**:
- The worker already uses grammY `Api` standalone for sending messages (Feature 009). Same pattern applies to the API app.
- `getChatMember` returns a `ChatMember` object with a `status` field: `"creator"`, `"administrator"`, `"member"`, `"restricted"`, `"left"`, or `"kicked"`.
- The bot needs to know its own user ID. Call `api.getMe()` once at startup (or module init) and cache the result. `getMe()` returns `UserFromGetMe` with an `id` field.
- If the bot is not a member of the channel at all, `getChatMember` throws a grammY error (400 or 403). This is the "unreachable/non-existent channel" case — catch it and return `false`.

**Alternatives considered**:
- Using `getChatAdministrators(channelId)` to get the full admin list and search for the bot — wasteful, returns all admins when we only need one.
- Using Telegraf instead of grammY — project constitution mandates grammY (Principle V).

## R2: NestJS integration pattern for grammY Api

**Decision**: Create a `BotModule` that provides a `BotService` wrapping the grammY `Api` instance. Register as a global module so `SubscriptionListsModule` can inject `BotService`.

**Rationale**:
- Follows existing NestJS module patterns in the project (PrismaModule, RedisModule, AuthModule).
- `BotService` is the clean boundary — it exposes `verifyBotAdmin(channelId: number): Promise<boolean>` and hides grammY details.
- The `Api` instance is created in the module's provider factory using `ConfigService` to read `BOT_TOKEN`.
- `BotService` calls `api.getMe()` lazily on first use (or in `onModuleInit`) to cache the bot's user ID.

**Alternatives considered**:
- Adding verification directly in `SubscriptionListsService` — violates single responsibility, leaks Telegram API details into business logic.
- Using a plain utility function — harder to test (can't mock), doesn't follow NestJS DI patterns.

## R3: Error handling for getChatMember failures

**Decision**: Fail closed. Any error from `getChatMember` (network, 400, 403, timeout) results in `verifyBotAdmin` returning `false`, except for transient/network errors which throw a specific exception for retry.

**Rationale**:
- Spec FR-006: "fail closed — deny access if verification cannot be completed"
- Spec FR-007: "handle temporary external service failures by returning an appropriate error that allows the user to retry"
- Spec FR-008: "Verification MUST complete within 10 seconds"
- Distinguish between:
  - **Bot not admin / channel doesn't exist / bot kicked**: `getChatMember` throws 400/403 → return `false`
  - **Network/timeout error**: Throw a service-level exception so the controller returns a 503/retry-friendly response
- Use `AbortSignal.timeout(10_000)` for the 10-second timeout (FR-008).

**Alternatives considered**:
- Always returning `false` on any error — loses the distinction between "definitely not admin" and "service temporarily down" (violates FR-007).
- Caching admin status — explicitly out of scope per spec.

## R4: Integration point in SubscriptionListsService

**Decision**: Inject `BotService` into `SubscriptionListsService`. Call `verifyBotAdmin(destinationChannelId)` at the start of `create()` and conditionally in `update()` (only when `destinationChannelId` is present in the DTO).

**Rationale**:
- Spec FR-001/FR-002: Verify before create and before update (destination change only).
- Spec FR-003: Do NOT verify when updating other fields (name, isActive, sourceChannelIds).
- The `update()` method already checks `dto.destinationChannelId !== undefined` — verification hooks into the same conditional.
- If verification fails, throw `BadRequestException` with error code `DESTINATION_BOT_NOT_ADMIN` and the specified message.

**Alternatives considered**:
- Using a NestJS guard or interceptor — too generic for a single-field validation, and needs access to the request body which guards handle awkwardly.
- Using a Prisma middleware/extension — wrong layer, this is business logic not data access.
