# Research: MTProto Seed Channels

## R1: Script Location

**Decision**: Place the seed script at `apps/api/prisma/seed-channels.ts`, alongside the existing `seed.ts`.

**Rationale**: All Prisma-related seeding scripts live in `apps/api/prisma/`. The script's primary purpose is database seeding — the MTProto call is just the resolution mechanism. Keeping seed scripts co-located with the schema and existing seed makes discovery natural.

**Alternatives considered**:
- `apps/worker/scripts/seed-channels.ts` — Worker already has `telegram`, but seed scripts belong with Prisma/DB setup.
- Root-level `scripts/` — Goes against monorepo conventions of keeping things in their respective app.

## R2: GramJS Dependency for API App

**Decision**: Add `telegram` (GramJS) as a **devDependency** of `apps/api`.

**Rationale**: The seed script is a developer/operator tool, not part of the API runtime. Adding as devDependency keeps the production bundle clean while making the import available for the seed script.

**Alternatives considered**:
- Importing from `apps/worker` — Cross-app imports violate monorepo boundaries.
- Creating a shared package for GramJS — Over-engineering for a single seed script.

## R3: Script Execution Method

**Decision**: Run via `tsx` with `--env-file=.env` flag, exposed as `"seed:channels": "tsx --env-file=.env prisma/seed-channels.ts"` in `apps/api/package.json`.

**Rationale**: `tsx` is already a devDependency in `apps/api` (^4.19.4). The `--env-file` flag loads `.env` automatically without needing `dotenv`. Matches the worker's `dev` script pattern.

**Alternatives considered**:
- Using Prisma's built-in seed mechanism — Only supports a single seed command; would overwrite the existing seed.
- Using `ts-node` — Not installed; `tsx` is faster and already present.

## R4: Channel Resolution via GramJS

**Decision**: Use `TelegramClient.getEntity()` with the channel username to resolve `telegramId` and `title`.

**Rationale**: `getEntity()` is the standard GramJS method for resolving usernames to full entity objects. It returns `Api.Channel` with `id` and `title` fields. No need to join the channel just to resolve it.

**Alternatives considered**:
- `Api.contacts.ResolveUsername` — Lower-level; `getEntity()` wraps it with caching.
- `Api.channels.GetChannels` — Requires numeric ID, which we don't have yet.

## R5: Join Mechanism

**Decision**: Use `Api.channels.JoinChannel` (same as existing `ChannelManager.joinChannel()`) when `--join` flag is provided.

**Rationale**: The existing `ChannelManager` in the worker uses this exact API call. For the seed script, we call it directly rather than importing ChannelManager (which has additional dependencies on Prisma and logger).

**Alternatives considered**:
- Reusing `ChannelManager` class — Would require importing pino logger and wiring dependencies; overkill for a seed script.
- Using `client.invoke(new Api.channels.JoinChannel(...))` — This is what we'll use directly.

## R6: Logging in CLI Script

**Decision**: Use `console.log`/`console.warn`/`console.error` for the seed script output.

**Rationale**: The constitution requires pino for "services and apps." A one-shot seed script is neither a service nor a long-running app — it's a developer CLI tool. Using console output is standard for CLI scripts and provides readable output without JSON formatting overhead.

**Alternatives considered**:
- pino — Produces JSON output that's harder to read in a terminal for a one-shot CLI tool.
- Custom logger wrapper — Over-engineering for a seed script.
