# API Contract: Channels

## GET /channels

**Description**: List all active source channels, ordered alphabetically by title.

**Authentication**: Required (JWT Bearer token)

### Request

```
GET /channels
Authorization: Bearer <jwt>
```

No query parameters.

### Response — 200 OK

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "telegramId": "1001000001",
    "username": "technews",
    "title": "Tech News Channel",
    "subscribedAt": "2026-02-16T12:00:00.000Z",
    "isActive": true
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Channel unique identifier |
| telegramId | string | Telegram numeric channel ID (stringified BigInt) |
| username | string or null | Telegram @username (without @) |
| title | string | Channel display name |
| subscribedAt | string (ISO 8601) | When the channel was added |
| isActive | boolean | Always `true` in GET response (filter applied) |

### Response — 401 Unauthorized

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthorized"
}
```

---

## POST /channels

**Description**: Submit a channel username to request subscription. Returns existing channel if already tracked, or creates a new pending record.

**Authentication**: Required (JWT Bearer token)

### Request

```
POST /channels
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "username": "newchannel"
}
```

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| username | string | `^[a-zA-Z0-9_]{5,32}$`, required | Telegram channel username (without @) |

### Response — 201 Created (new pending channel)

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "telegramId": "-1739712600000",
  "username": "newchannel",
  "title": "newchannel",
  "subscribedAt": "2026-02-16T12:30:00.000Z",
  "isActive": false
}
```

### Response — 200 OK (existing channel returned)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "telegramId": "1001000001",
  "username": "technews",
  "title": "Tech News Channel",
  "subscribedAt": "2026-02-16T12:00:00.000Z",
  "isActive": true
}
```

### Response — 400 Bad Request (invalid username format)

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Username must be 5-32 characters, alphanumeric and underscores only"
}
```

### Response — 401 Unauthorized

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthorized"
}
```

---

## Error Response Shape (Global)

All error responses follow this structure:

```json
{
  "statusCode": <number>,
  "error": "<error type>",
  "message": "<human-readable description>"
}
```

| Field | Type | Description |
|-------|------|-------------|
| statusCode | number | HTTP status code |
| error | string | Error category (e.g., "Bad Request", "Unauthorized") |
| message | string | Human-readable error message |
