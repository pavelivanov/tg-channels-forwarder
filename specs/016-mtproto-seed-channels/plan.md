# Implementation Plan: MTProto Seed Channels

**Branch**: `016-mtproto-seed-channels` | **Date**: 2026-02-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-mtproto-seed-channels/spec.md`

## Summary

Create a CLI seed script that uses GramJS (MTProto) to resolve Telegram channel usernames into their numeric IDs and titles, then upserts them into the existing `SourceChannel` table. The script accepts a list of usernames as CLI arguments, handles errors gracefully (skip failures, continue processing), and optionally joins channels via the userbot with a `--join` flag.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, Node.js 20 LTS
**Primary Dependencies**: `telegram` (GramJS) ^2.26.22, `@prisma/client` v6, `@prisma/adapter-pg`, `tsx` ^4.19.4
**Storage**: PostgreSQL 16 via Prisma (existing `SourceChannel` model, no schema changes)
**Testing**: Vitest
**Target Platform**: CLI script (Node.js)
**Project Type**: Monorepo (Turborepo) — `apps/api`
**Performance Goals**: N/A (one-shot CLI tool)
**Constraints**: 2-3 second delay between Telegram API calls to avoid rate limits
**Scale/Scope**: Typically 5-30 channels per invocation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict Mode | PASS | Script uses strict TypeScript, no `any` types |
| II. Vitest Testing | PASS | Unit test for parsing/dedup logic; integration test optional (requires live MTProto session) |
| III. Observability & Logging | JUSTIFIED | CLI seed script uses `console.log` instead of pino — not a service/app, it's a one-shot developer tool (see R6 in research.md) |
| IV. Performance | N/A | Not a production service |
| V. Technology Stack | PASS | GramJS for MTProto, Prisma for DB — both mandated by constitution |
| VI. Docker-First | N/A | Seed script is a dev tool, not a deployed service |
| VII. Data Architecture | PASS | Only stores channel config in PostgreSQL, no message content |

## Project Structure

### Documentation (this feature)

```text
specs/016-mtproto-seed-channels/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/
├── prisma/
│   ├── seed.ts                # Existing seed (unchanged)
│   └── seed-channels.ts       # NEW: MTProto channel seed script
├── test/
│   └── seed-channels.spec.ts  # NEW: Unit tests for seed logic
└── package.json               # MODIFIED: add seed:channels script, telegram devDep
```

**Structure Decision**: The seed script lives alongside the existing `seed.ts` in `apps/api/prisma/` since all database seeding belongs with the Prisma schema. `telegram` is added as a devDependency since it's only needed for this developer tool, not the API runtime.

## Key Design Decisions

### Script Architecture

The script is a single file (`seed-channels.ts`) with clearly separated concerns:

1. **Argument parsing**: Extract channel usernames and flags from `process.argv`
2. **Input normalization**: Strip `@` prefixes, deduplicate
3. **MTProto client initialization**: Connect using env vars, validate session
4. **Channel resolution loop**: For each username, resolve via `client.getEntity()`, with delay and error handling
5. **Optional join**: If `--join` flag, call `Api.channels.JoinChannel` after resolution
6. **Database upsert**: Upsert each resolved channel into `SourceChannel` via Prisma
7. **Summary output**: Print counts (added/updated/skipped)

### Upsert Strategy

Use Prisma's `upsert` matching on `username` (unique field on `SourceChannel`):
- **Create**: Insert new record with `telegramId`, `username`, `title`, `isActive: true`
- **Update**: Refresh `telegramId` and `title` (username stays the same since it's the match key)

This matches the existing seed.ts pattern which upserts on `telegramId`, but we match on `username` since that's what the operator provides.

### Rate Limiting

- 2-3 second random delay between channel resolutions (matches the existing `ChannelManager` pattern with `JOIN_DELAY_MIN_MS`/`JOIN_DELAY_MAX_MS`)
- `FloodWaitError` handling: extract wait time from error, sleep, then retry once

### Error Handling

- Missing env vars → exit immediately with clear error message
- MTProto connection failure → exit immediately
- Individual channel resolution failure → log warning, increment skip counter, continue
- Individual channel join failure → log warning, still upsert the resolved data, continue
- Database connection failure → exit immediately (Prisma will throw on first query)
