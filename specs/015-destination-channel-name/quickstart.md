# Quickstart: Destination Channel Name Input

## Test Scenarios

### TC1: Create subscription list with @username (happy path)

**Setup**: API running, bot is admin in `@testchannel`.

1. POST `/subscription-lists` with `{ name: "Test", destinationUsername: "testchannel", sourceChannelIds: [...] }`
2. Expect 201 response with `destinationChannelId` (resolved numeric ID) and `destinationUsername: "testchannel"`

### TC2: Create with invalid username

**Setup**: API running.

1. POST `/subscription-lists` with `{ name: "Test", destinationUsername: "nonexistent_xyz_123", sourceChannelIds: [...] }`
2. Expect 400 response with error message about channel not found

### TC3: Create with bot not admin

**Setup**: API running, channel exists but bot is not admin.

1. POST `/subscription-lists` with `{ name: "Test", destinationUsername: "channelwithoutbot", sourceChannelIds: [...] }`
2. Expect 400 response with error about bot not being admin

### TC4: Update destination username

**Setup**: Existing subscription list, bot is admin in new channel.

1. PATCH `/subscription-lists/:id` with `{ destinationUsername: "newchannel" }`
2. Expect 200 with updated `destinationChannelId` and `destinationUsername`

### TC5: Mini-app form create flow

**Setup**: Mini-app running, authenticated user.

1. Navigate to create form
2. Enter list name, type `@mychannel` in destination field
3. Select source channels
4. Submit form
5. Expect redirect to list view, destination shows `@mychannel`

### TC6: Mini-app form edit flow (existing list)

**Setup**: Existing subscription list with `destinationUsername` set.

1. Navigate to edit form for the list
2. Destination field pre-populated with `@existingchannel`
3. Change to `@newchannel`, submit
4. Expect update succeeds, shows `@newchannel`

## Running Tests

```bash
# Unit tests (API)
pnpm turbo run test --filter=@aggregator/api

# Unit tests (mini-app)
pnpm turbo run test --filter=@aggregator/mini-app

# All tests
pnpm test

# Lint
pnpm lint
```
