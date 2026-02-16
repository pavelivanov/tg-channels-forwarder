# API Contract: Health Check

**Service**: `apps/api` (NestJS)
**Base URL**: `http://localhost:3000`

## GET /health

Returns the health status of the API service.

### Request

No parameters, no headers, no body.

### Response

**Status**: `200 OK`

```json
{
  "status": "ok",
  "info": {
    "memory_heap": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "memory_heap": {
      "status": "up"
    }
  }
}
```

**Status**: `503 Service Unavailable` (when any health indicator fails)

```json
{
  "status": "error",
  "info": {},
  "error": {
    "memory_heap": {
      "status": "down",
      "message": "Used heap exceeds threshold"
    }
  },
  "details": {
    "memory_heap": {
      "status": "down",
      "message": "Used heap exceeds threshold"
    }
  }
}
```

### Notes

- Uses `@nestjs/terminus` `HealthCheckService`
- Memory heap threshold: 512 MB
- The top-level `status` field is always `"ok"` or `"error"`
- Docker health check should use: `curl -f http://localhost:3000/health`
