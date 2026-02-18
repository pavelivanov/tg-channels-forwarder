# API Contract: Telegram Mini App (Frontend)

**Feature Branch**: `013-telegram-mini-app` | **Date**: 2026-02-18

This document describes the existing backend API endpoints consumed by the mini-app frontend. These endpoints already exist — no backend changes are needed except adding `@nestjs/serve-static` for serving the built app.

## Authentication

### POST /auth/validate

Exchanges Telegram initData for a JWT token.

**Request**:
```json
{
  "initData": "<raw Telegram WebApp.initData string>"
}
```

**Response 200**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "telegramId": "123456789",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "photoUrl": "https://t.me/i/userpic/...",
    "isPremium": false
  }
}
```

**Error 401**: Invalid or expired initData.

**Frontend usage**: Called automatically on app load. Token stored in memory, attached as `Authorization: Bearer <token>` to all subsequent requests.

---

## Channels

All channel endpoints require `Authorization: Bearer <token>` header.

### GET /channels

Returns all source channels available in the system.

**Response 200**:
```json
[
  {
    "id": "uuid",
    "telegramId": "-1001234567890",
    "username": "channelname",
    "title": "Channel Title",
    "isActive": true
  }
]
```

**Frontend usage**: Fetched when opening the Create/Edit form to populate the source channel multi-select.

### POST /channels

Register a new source channel by @username.

**Request**:
```json
{
  "username": "channelname"
}
```

**Response 201** (new channel created):
```json
{
  "id": "uuid",
  "telegramId": "-1001234567890",
  "username": "channelname",
  "title": "Channel Title",
  "isActive": true
}
```

**Response 200** (channel already exists):
Same shape as 201.

**Error 400**: Username format invalid.
**Error 422**: Bot is not an admin in this channel / channel not found.

**Frontend usage**: Called from the "Add Channel" inline form. On success, the returned channel is added to the current selection.

---

## Subscription Lists

All subscription list endpoints require `Authorization: Bearer <token>` header.

### GET /subscription-lists

Returns all subscription lists belonging to the authenticated user.

**Response 200**:
```json
[
  {
    "id": "uuid",
    "name": "My List",
    "destinationChannelId": -1001234567890,
    "destinationUsername": "destchannel",
    "isActive": true,
    "sourceChannels": [
      {
        "id": "uuid",
        "telegramId": "-1001111111111",
        "username": "source1",
        "title": "Source Channel 1",
        "isActive": true
      }
    ]
  }
]
```

**Frontend usage**: Fetched on Home screen load. Each list displayed as a card with name, destination, source count, and active badge.

### POST /subscription-lists

Create a new subscription list.

**Request**:
```json
{
  "name": "My New List",
  "destinationChannelId": -1001234567890,
  "destinationUsername": "destchannel",
  "sourceChannelIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response 201**: Created subscription list (same shape as GET item).

**Error 400**: Validation errors (name empty, invalid channel IDs).
**Error 403**: Maximum list limit reached (non-premium user).
**Error 422**: Bot not admin in destination channel.

**Frontend usage**: Called on Create form submission. On success, navigate to Home. On 403, show "Premium" indicator.

### PATCH /subscription-lists/:id

Update an existing subscription list.

**Request** (all fields optional):
```json
{
  "name": "Updated Name",
  "destinationChannelId": -1001234567890,
  "destinationUsername": "newdest",
  "sourceChannelIds": ["uuid1", "uuid2"]
}
```

**Response 200**: Updated subscription list.

**Error 400**: Validation errors.
**Error 404**: List not found or not owned by user.
**Error 422**: Bot not admin in destination channel.

**Frontend usage**: Called on Edit form submission with changed fields only.

### DELETE /subscription-lists/:id

Delete a subscription list.

**Response 204**: No content (success).

**Error 404**: List not found or not owned by user.

**Frontend usage**: Called after user confirms deletion. On success, navigate to Home.

---

## Error Response Format

All API errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Username must be 5-32 characters, alphanumeric and underscores only",
  "error": "Bad Request"
}
```

Or with multiple validation errors:
```json
{
  "statusCode": 400,
  "message": [
    "name should not be empty",
    "sourceChannelIds must contain at least 1 elements"
  ],
  "error": "Bad Request"
}
```

**Frontend handling**: Display `message` (string or first array element) as inline error near the relevant form field. For network errors (no response), show a generic "Connection error" message with retry option.
