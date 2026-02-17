# API Contract: Subscription Lists

## GET /subscription-lists

**Description**: List all active subscription lists for the authenticated user, with source channels populated.

**Authentication**: Required (JWT Bearer token)

### Request

```
GET /subscription-lists
Authorization: Bearer <jwt>
```

No query parameters.

### Response -- 200 OK

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Tech Feed",
    "destinationChannelId": "1002000001",
    "destinationUsername": "mytechfeed",
    "isActive": true,
    "createdAt": "2026-02-17T12:00:00.000Z",
    "sourceChannels": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "telegramId": "1001000001",
        "username": "technews",
        "title": "Tech News Channel"
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440002",
        "telegramId": "1001000002",
        "username": "devupdates",
        "title": "Dev Updates"
      }
    ]
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Subscription list unique identifier |
| name | string | User-defined list name |
| destinationChannelId | string | Telegram destination channel ID (stringified BigInt) |
| destinationUsername | string or null | Telegram destination @username (without @) |
| isActive | boolean | Always `true` in GET response (filter applied) |
| createdAt | string (ISO 8601) | When the list was created |
| sourceChannels | array | Associated source channels |
| sourceChannels[].id | string (UUID) | Source channel unique identifier |
| sourceChannels[].telegramId | string | Telegram source channel ID (stringified BigInt) |
| sourceChannels[].username | string or null | Telegram @username (without @) |
| sourceChannels[].title | string | Channel display name |

Returns an empty array `[]` if the user has no active subscription lists.

### Response -- 401 Unauthorized

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthorized"
}
```

---

## POST /subscription-lists

**Description**: Create a new subscription list with source channel associations. Enforces list count and source channel count limits.

**Authentication**: Required (JWT Bearer token)

### Request

```
POST /subscription-lists
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "My Tech Feed",
  "destinationChannelId": 1002000001,
  "destinationUsername": "mytechfeed",
  "sourceChannelIds": [
    "660e8400-e29b-41d4-a716-446655440001",
    "660e8400-e29b-41d4-a716-446655440002"
  ]
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | yes | Non-empty string | Display name for the list |
| destinationChannelId | integer | yes | Valid integer | Telegram destination channel numeric ID |
| destinationUsername | string | no | -- | Telegram destination @username (informational) |
| sourceChannelIds | string[] (UUID v4) | yes | Non-empty array, each element UUID v4 | Source channels to forward from |

### Response -- 201 Created

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Tech Feed",
  "destinationChannelId": "1002000001",
  "destinationUsername": "mytechfeed",
  "isActive": true,
  "createdAt": "2026-02-17T12:00:00.000Z",
  "sourceChannels": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "telegramId": "1001000001",
      "username": "technews",
      "title": "Tech News Channel"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "telegramId": "1001000002",
      "username": "devupdates",
      "title": "Dev Updates"
    }
  ]
}
```

Response shape is identical to the GET list item shape.

### Response -- 400 Bad Request (validation error)

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "name should not be empty; sourceChannelIds should not be empty"
}
```

### Response -- 400 Bad Request (invalid source channels)

Returned when one or more source channel IDs do not exist or reference inactive channels.

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid or inactive source channel IDs: 660e8400-e29b-41d4-a716-446655440099"
}
```

### Response -- 401 Unauthorized

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthorized"
}
```

### Response -- 403 Forbidden (list limit exceeded)

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Subscription list limit reached (maximum: 1)"
}
```

### Response -- 403 Forbidden (source channel limit exceeded)

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Source channel limit exceeded (maximum: 30, current: 28, requested: 5)"
}
```

---

## PATCH /subscription-lists/:id

**Description**: Partially update an existing subscription list. All fields are optional. When `sourceChannelIds` is provided, all existing associations are replaced with the new set.

**Authentication**: Required (JWT Bearer token)

### Request

```
PATCH /subscription-lists/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "Renamed Feed",
  "sourceChannelIds": [
    "660e8400-e29b-41d4-a716-446655440003"
  ]
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | no | Non-empty string if provided | New display name |
| destinationChannelId | integer | no | Valid integer if provided | New destination channel ID |
| destinationUsername | string | no | -- | New destination @username |
| sourceChannelIds | string[] (UUID v4) | no | Non-empty array if provided, each element UUID v4 | Replaces all source channel associations |

**Note**: If `sourceChannelIds` is omitted, existing source channel associations remain unchanged. If provided, all existing associations are removed and replaced with the new set.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Subscription list ID |

### Response -- 200 OK

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Renamed Feed",
  "destinationChannelId": "1002000001",
  "destinationUsername": "mytechfeed",
  "isActive": true,
  "createdAt": "2026-02-17T12:00:00.000Z",
  "sourceChannels": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440003",
      "telegramId": "1001000003",
      "username": "cryptonews",
      "title": "Crypto News"
    }
  ]
}
```

Response shape is identical to the GET list item shape.

### Response -- 400 Bad Request (validation error)

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "each value in sourceChannelIds must be a UUID"
}
```

### Response -- 400 Bad Request (empty body)

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Request body must contain at least one updatable field"
}
```

### Response -- 400 Bad Request (invalid source channels)

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid or inactive source channel IDs: 660e8400-e29b-41d4-a716-446655440099"
}
```

### Response -- 401 Unauthorized

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthorized"
}
```

### Response -- 403 Forbidden (source channel limit exceeded)

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Source channel limit exceeded (maximum: 30, current: 20, requested: 15)"
}
```

### Response -- 404 Not Found

Returned when the list does not exist, has been soft-deleted, or belongs to another user.

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Subscription list not found"
}
```

---

## DELETE /subscription-lists/:id

**Description**: Soft-delete a subscription list by setting `isActive` to `false`. The record is preserved in the database.

**Authentication**: Required (JWT Bearer token)

### Request

```
DELETE /subscription-lists/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <jwt>
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Subscription list ID |

### Response -- 204 No Content

No response body.

### Response -- 401 Unauthorized

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthorized"
}
```

### Response -- 404 Not Found

Returned when the list does not exist, has been soft-deleted, or belongs to another user.

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Subscription list not found"
}
```

---

## Error Response Shape (Global)

All error responses follow this structure:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Human-readable description"
}
```

| Field | Type | Description |
|-------|------|-------------|
| statusCode | number | HTTP status code |
| error | string | Error category (e.g., "Bad Request", "Forbidden", "Not Found") |
| message | string | Human-readable error message |

## Status Code Summary

| Endpoint | Success | Errors |
|----------|---------|--------|
| GET /subscription-lists | 200 | 401 |
| POST /subscription-lists | 201 | 400, 401, 403 |
| PATCH /subscription-lists/:id | 200 | 400, 401, 403, 404 |
| DELETE /subscription-lists/:id | 204 | 401, 404 |
