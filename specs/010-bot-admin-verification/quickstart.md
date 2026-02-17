# Quickstart: Bot Admin Verification & Destination Validation

**Feature Branch**: `010-bot-admin-verification`
**Date**: 2026-02-17

## Prerequisites

- Feature 005 (Subscription Lists API) is complete and merged
- `BOT_TOKEN` is already in `apps/api/src/env.schema.ts`
- grammY needs to be added to `apps/api/package.json`

## Setup

1. Install grammY in the API app:
   ```bash
   cd apps/api && pnpm add grammy
   ```

2. No Prisma schema changes needed.

3. No new environment variables needed (`BOT_TOKEN` already exists).

## Test Scenarios

### BotService Unit Tests (`apps/api/test/bot.spec.ts`)

1. **verifyBotAdmin returns true when bot is administrator**
   - Mock `api.getChatMember` returning `{ status: "administrator" }`
   - Assert returns `true`

2. **verifyBotAdmin returns true when bot is creator**
   - Mock `api.getChatMember` returning `{ status: "creator" }`
   - Assert returns `true`

3. **verifyBotAdmin returns false when bot is regular member**
   - Mock `api.getChatMember` returning `{ status: "member" }`
   - Assert returns `false`

4. **verifyBotAdmin returns false when channel doesn't exist**
   - Mock `api.getChatMember` throwing `GrammyError` with 400
   - Assert returns `false`

5. **verifyBotAdmin returns false when bot is kicked/banned**
   - Mock `api.getChatMember` throwing `GrammyError` with 403
   - Assert returns `false`

6. **verifyBotAdmin throws ServiceUnavailableException on network error**
   - Mock `api.getChatMember` throwing a network error
   - Assert throws `ServiceUnavailableException`

### Integration Tests (`apps/api/test/subscription-lists-bot-verify.spec.ts`)

7. **List creation succeeds when bot is admin**
   - Mock `BotService.verifyBotAdmin` returning `true`
   - POST `/subscription-lists` with valid payload
   - Assert 201 Created

8. **List creation rejected when bot is not admin**
   - Mock `BotService.verifyBotAdmin` returning `false`
   - POST `/subscription-lists` with valid payload
   - Assert 400 with `errorCode: "DESTINATION_BOT_NOT_ADMIN"`

9. **List update rejected when changing destination to non-admin channel**
   - Mock `BotService.verifyBotAdmin` returning `false`
   - PATCH `/subscription-lists/:id` with `destinationChannelId`
   - Assert 400 with `errorCode: "DESTINATION_BOT_NOT_ADMIN"`

10. **List update succeeds when NOT changing destination (no verification)**
    - PATCH `/subscription-lists/:id` with only `name` field
    - Assert 200 OK (no call to `verifyBotAdmin`)

## File Map

| New File | Purpose |
|----------|---------|
| `apps/api/src/bot/bot.module.ts` | NestJS global module for BotService |
| `apps/api/src/bot/bot.service.ts` | verifyBotAdmin implementation |
| `apps/api/test/bot.spec.ts` | BotService unit tests |
| `apps/api/test/subscription-lists-bot-verify.spec.ts` | Integration tests for verification in CRUD |

| Modified File | Change |
|---------------|--------|
| `apps/api/src/app.module.ts` | Import BotModule |
| `apps/api/src/subscription-lists/subscription-lists.service.ts` | Inject BotService, add verification calls |
| `apps/api/src/subscription-lists/subscription-lists.module.ts` | No change needed (BotModule is global) |
| `apps/api/package.json` | Add grammy dependency |
