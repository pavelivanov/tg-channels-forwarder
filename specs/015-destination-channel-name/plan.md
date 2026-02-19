# Implementation Plan: Destination Channel Name Input

**Branch**: `015-destination-channel-name` | **Date**: 2026-02-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/015-destination-channel-name/spec.md`

## Summary

Replace the numeric destination channel ID input with a `@username` field in the mini-app form. The API resolves the username to a Telegram channel ID via `api.getChat()`, verifies bot admin status, and stores both values. The worker/forwarder continues using the stored numeric ID — no changes needed.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS
**Primary Dependencies**: NestJS 10, grammY (Bot API), React 19, Vite 6, class-validator
**Storage**: PostgreSQL 16 via Prisma (existing schema, no migrations — `destinationUsername` field already exists)
**Testing**: Vitest
**Target Platform**: Linux server (API/worker), Telegram Mini App (frontend)
**Project Type**: Web application (monorepo: `apps/api`, `apps/mini-app`)
**Performance Goals**: Username resolution via `getChat` should respond within 5 seconds
**Constraints**: Telegram Bot API rate limits apply to `getChat` calls
**Scale/Scope**: Affects 2 apps (api, mini-app), ~6 files modified

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode | PASS | All changes in strict TS, no `any` types |
| II. Vitest Testing Standards | PASS | New `resolveChannel` method needs unit tests; existing subscription-list tests updated |
| III. Observability & Logging | PASS | Log username resolution success/failure in BotService |
| IV. Performance Requirements | PASS | No impact on forwarding pipeline |
| V. Technology Stack & Monorepo | PASS | Uses existing grammY Api, NestJS patterns, React |
| VI. Docker-First Deployment | PASS | No new services or env vars |
| VII. Data Architecture | PASS | No schema changes — `destinationUsername` already exists |

## Project Structure

### Documentation (this feature)

```text
specs/015-destination-channel-name/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (files to modify)

```text
apps/api/
├── src/
│   ├── bot/
│   │   └── bot.service.ts              # Add resolveChannel() method
│   └── subscription-lists/
│       ├── dto/
│       │   ├── create-subscription-list.dto.ts   # Replace destinationChannelId with destinationUsername
│       │   └── update-subscription-list.dto.ts   # Replace destinationChannelId with destinationUsername
│       └── subscription-lists.service.ts          # Resolve username → ID before storing
└── test/
    ├── bot.spec.ts                     # Add resolveChannel tests
    ├── subscription-lists.spec.ts      # Update payloads to use username
    └── subscription-lists-bot-verify.spec.ts  # Update payloads to use username

apps/mini-app/
├── src/
│   ├── pages/
│   │   └── ListFormPage.tsx            # Replace ID input with @username input
│   └── types/
│       └── index.ts                    # Update SubscriptionList interface
└── test/                               # Update any affected tests
```

**Structure Decision**: Existing monorepo web application structure. Changes span api (backend) and mini-app (frontend). No new files needed — only modifications to existing ones.

## Implementation Approach

### 1. BotService: Add `resolveChannel()` method

In `apps/api/src/bot/bot.service.ts`, add a new method:

```typescript
async resolveChannel(username: string): Promise<{ id: number; title: string }> {
  const chat = await this.api.getChat(`@${username}`);
  // chat.id is the numeric channel ID, chat.title is the channel name
  return { id: chat.id, title: 'title' in chat ? chat.title ?? '' : '' };
}
```

- Accepts username without `@` prefix (normalized by caller)
- Throws `GrammyError` if channel not found / bot has no access
- Reuse existing error handling pattern from `verifyBotAdmin()`

### 2. DTOs: Replace `destinationChannelId` with `destinationUsername`

**Create DTO**: Remove `@IsInt() destinationChannelId`, make `destinationUsername` required with `@IsString() @IsNotEmpty() @Matches(/^@?[a-zA-Z][a-zA-Z0-9_]{3,}$/)`.

**Update DTO**: Remove optional `destinationChannelId`, keep `destinationUsername` as optional string with same validation.

### 3. SubscriptionListsService: Resolve before storing

In the `create()` method:
1. Normalize username (strip leading `@`)
2. Call `botService.resolveChannel(username)` to get numeric ID
3. Call `botService.verifyBotAdmin(numericId)` to verify admin status
4. Store both `destinationChannelId: BigInt(numericId)` and `destinationUsername`

Same pattern for `update()` when `destinationUsername` is provided.

### 4. Mini-app: Replace ID input with @username input

In `ListFormPage.tsx`:
- Remove `destinationChannelId` state, keep only `destinationUsername`
- Change input field: label "Destination Channel", placeholder `@mychannel`, type `text`
- On submit: send `destinationUsername` instead of `destinationChannelId`
- On load (edit mode): populate from `list.destinationUsername`

Update `SubscriptionList` type in `types/index.ts`: remove `destinationChannelId`, keep `destinationUsername`.

### 5. API Response: Keep `destinationChannelId` in response

The API response continues to include `destinationChannelId` (as string) for backward compatibility, but the frontend no longer uses it. The frontend displays `destinationUsername` only.
