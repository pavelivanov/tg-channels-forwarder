# Contract: BotService

**Module**: `apps/api/src/bot/bot.service.ts`
**Provider**: `BotService` (NestJS Injectable)

## Interface

### `verifyBotAdmin(channelId: number): Promise<boolean>`

Verifies that the bot has administrator or creator status in the specified Telegram channel.

**Parameters**:
- `channelId` (number): Telegram channel ID to check

**Returns**: `Promise<boolean>`
- `true` if the bot's status is `"administrator"` or `"creator"`
- `false` if the bot is not an admin, not a member, or the channel doesn't exist

**Throws**:
- `ServiceUnavailableException` (HTTP 503) if the Telegram API is unreachable or times out (>10s)

**Behavior**:
1. Call `api.getChatMember(channelId, botUserId)` with a 10-second `AbortSignal` timeout
2. Check if the returned `ChatMember.status` is `"administrator"` or `"creator"`
3. On `GrammyError` with HTTP error codes (400, 403): return `false` (fail closed)
4. On network/timeout errors: throw `ServiceUnavailableException`

### Bot User ID Resolution

The bot's user ID is resolved via `api.getMe()` during `onModuleInit()` and cached for the lifetime of the service. This avoids repeated `getMe` calls.

## NestJS Module

**File**: `apps/api/src/bot/bot.module.ts`

```typescript
@Global()
@Module({
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
```

Registered as `@Global()` so `SubscriptionListsModule` can inject `BotService` without importing `BotModule`.

## Integration Points

### SubscriptionListsService.create()

```
Before creating the list:
  1. Call botService.verifyBotAdmin(dto.destinationChannelId)
  2. If false → throw BadRequestException with DESTINATION_BOT_NOT_ADMIN
  3. If true → proceed with existing creation logic
```

### SubscriptionListsService.update()

```
When dto.destinationChannelId is present:
  1. Call botService.verifyBotAdmin(dto.destinationChannelId)
  2. If false → throw BadRequestException with DESTINATION_BOT_NOT_ADMIN
  3. If true → proceed with existing update logic

When dto.destinationChannelId is NOT present:
  Skip verification entirely (FR-003)
```

## Error Response

When `verifyBotAdmin` returns `false`, the service throws:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Please add the bot as an administrator to your destination channel before creating a subscription list.",
  "errorCode": "DESTINATION_BOT_NOT_ADMIN"
}
```

Implementation uses a custom `BotNotAdminException` extending `BadRequestException` to include the `errorCode` field.
