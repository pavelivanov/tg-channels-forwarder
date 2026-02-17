# API Contract: Authentication

**Branch**: `003-telegram-jwt-auth` | **Date**: 2026-02-16

## POST /auth/validate

Validates Telegram Mini App initData and returns a JWT with user profile.

**Authentication**: None (public endpoint)

### Request

```
POST /auth/validate
Content-Type: application/json

{
  "initData": "<raw URL-encoded initData string from Telegram>"
}
```

| Field    | Type   | Required | Description                        |
| -------- | ------ | -------- | ---------------------------------- |
| initData | string | Yes      | Raw initData from Telegram WebApp  |

### Response — 200 OK

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "telegramId": "123456789",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "photoUrl": null,
    "isPremium": false
  }
}
```

| Field             | Type    | Description                          |
| ----------------- | ------- | ------------------------------------ |
| token             | string  | JWT, valid for 1 hour                |
| user.id           | string  | Internal UUID                        |
| user.telegramId   | string  | Telegram user ID (BigInt as string)  |
| user.firstName    | string  | From Telegram profile                |
| user.lastName     | string? | From Telegram profile, may be null   |
| user.username     | string? | From Telegram profile, may be null   |
| user.photoUrl     | string? | From Telegram profile, may be null   |
| user.isPremium    | boolean | Telegram Premium status              |

### Response — 401 Unauthorized

Returned when initData is invalid, tampered, or expired.

```json
{
  "statusCode": 401,
  "message": "Invalid initData"
}
```

## Protected Endpoints

All endpoints except those decorated with `@Public()` require authentication.

### Request Header

```
Authorization: Bearer <JWT token>
```

### Response — 401 Unauthorized (missing/invalid/expired token)

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Request Context

On successful JWT validation, the authenticated user payload is attached to the request:

```typescript
request['user'] = {
  sub: string;        // User UUID
  telegramId: string; // BigInt as string
}
```
