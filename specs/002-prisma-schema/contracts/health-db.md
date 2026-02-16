# Contract: Health Endpoint with Database Check

**Feature**: 002-prisma-schema

## Updated Health Endpoint

This feature extends the existing `GET /health` endpoint (from 001-monorepo-scaffold) to include a database connectivity check.

### GET /health

**Response 200** (all checks pass):
```json
{
  "status": "ok",
  "info": {
    "memory_heap": { "status": "up" },
    "database": { "status": "up" }
  },
  "error": {},
  "details": {
    "memory_heap": { "status": "up" },
    "database": { "status": "up" }
  }
}
```

**Response 503** (database check fails):
```json
{
  "status": "error",
  "info": {
    "memory_heap": { "status": "up" }
  },
  "error": {
    "database": { "status": "down", "message": "..." }
  },
  "details": {
    "memory_heap": { "status": "up" },
    "database": { "status": "down", "message": "..." }
  }
}
```

### Notes

- No new endpoints are introduced by this feature.
- The existing health endpoint is enhanced with a `database` indicator.
- The `@nestjs/terminus` `HealthCheckService` orchestrates both checks.
