# tg-channels-forwarder Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-16

## Active Technologies
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, Prisma ORM (latest v6), @prisma/clien (002-prisma-schema)
- PostgreSQL 16 (via Docker Compose, already provisioned in 001-monorepo-scaffold) (002-prisma-schema)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, @nestjs/jwt, @nestjs/config, Prisma ORM v6, node:crypto (built-in) (003-telegram-jwt-auth)
- PostgreSQL 16 (existing, via Docker Compose) — User table already exists (003-telegram-jwt-auth)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, Prisma ORM v6+, `class-validator`, `class-transformer` (004-channels-api)
- PostgreSQL 16 via Prisma (existing `SourceChannel` model) (004-channels-api)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, Prisma ORM v6, class-validator, class-transformer (005-subscription-lists-api)
- PostgreSQL 16 via Prisma (existing schema, no migrations) (005-subscription-lists-api)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, ioredis, node:crypto (built-in) + ioredis (new), @nestjs/terminus (existing), pino (existing), @aggregator/shared (existing) (006-redis-dedup-service)
- Redis 7 (existing via Docker Compose) — ephemeral key-value with TTL, no PostgreSQL changes (006-redis-dedup-service)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + BullMQ (queue/worker), ioredis (Redis client, already installed), express (dashboard mounting), @bull-board/api + @bull-board/express (dashboard UI) (007-bullmq-queue-setup)
- Redis 7 (already provisioned via Docker Compose) (007-bullmq-queue-setup)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + `telegram` (GramJS) ^2.26.22, BullMQ (existing), Prisma (existing), pino (existing) (008-telegram-listener)
- PostgreSQL 16 via Prisma (existing SourceChannel model), Redis (existing, for BullMQ queues) (008-telegram-listener)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + `grammy` (Telegram Bot API), `@grammyjs/auto-retry` (429 handling), `bottleneck` (rate limiting), BullMQ (existing), Prisma (existing), ioredis (existing), pino (existing) (009-forwarder-service)
- PostgreSQL 16 via Prisma (existing schema, no migrations), Redis (existing, for dedup + BullMQ) (009-forwarder-service)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10 + grammY (Bot API client), @nestjs/common, @nestjs/config, Prisma ORM v6 (010-bot-admin-verification)
- PostgreSQL 16 via Prisma (no schema changes) (010-bot-admin-verification)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + BullMQ (existing), Prisma ORM v6 (existing), pino (existing), `ChannelManager` (existing) (011-channel-cleanup)
- PostgreSQL 16 via Prisma (add `lastReferencedAt` field to SourceChannel) (011-channel-cleanup)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, nestjs-pino 4.x, pino 9.x, pino-http 10.x, @nestjs/terminus 10.x, grammY, GramJS (telegram), BullMQ, Prisma ORM v6 (012-logging-health-check)
- PostgreSQL 16 (existing), Redis (existing) (012-logging-health-check)
- TypeScript 5.x with `strict: true`, React 19, Node.js 20 LTS + React 19, React Router 7, Vite 6, `@twa-dev/sdk`, `@nestjs/serve-static` (API-side) (013-telegram-mini-app)
- N/A (frontend-only; backend handles all persistence) (013-telegram-mini-app)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + Vitest, ioredis, bullmq, grammy (mocked), @prisma/client, pino (014-e2e-integration-test)
- PostgreSQL 16 (real, via Docker Compose) + Redis 7 (real, via Docker Compose) (014-e2e-integration-test)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, grammY (Bot API), React 19, Vite 6, class-validator (015-destination-channel-name)
- PostgreSQL 16 via Prisma (existing schema, no migrations — `destinationUsername` field already exists) (015-destination-channel-name)
- TypeScript 5.x with `strict: true`, Node.js 20 LTS + `telegram` (GramJS) ^2.26.22, `@prisma/client` v6, `@prisma/adapter-pg`, `tsx` ^4.19.4 (016-mtproto-seed-channels)
- PostgreSQL 16 via Prisma (existing `SourceChannel` model, no schema changes) (016-mtproto-seed-channels)
- TypeScript 5.8.3, React 19.1.0 + shadcn/ui (component source, copy-paste), Tailwind CSS v4 (`@tailwindcss/vite`), class-variance-authority, clsx, tailwind-merge, lucide-react, tw-animate-css (017-shadcn-mini-app-ui)
- N/A (frontend-only, no data changes) (017-shadcn-mini-app-ui)

- TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, @nestjs/terminus, nestjs-pino, pino, (001-monorepo-scaffold)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x with `strict: true`, Node.js 20 LTS: Follow standard conventions

## Recent Changes
- 017-shadcn-mini-app-ui: Added TypeScript 5.8.3, React 19.1.0 + shadcn/ui (component source, copy-paste), Tailwind CSS v4 (`@tailwindcss/vite`), class-variance-authority, clsx, tailwind-merge, lucide-react, tw-animate-css
- 016-mtproto-seed-channels: Added TypeScript 5.x with `strict: true`, Node.js 20 LTS + `telegram` (GramJS) ^2.26.22, `@prisma/client` v6, `@prisma/adapter-pg`, `tsx` ^4.19.4
- 015-destination-channel-name: Added TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, grammY (Bot API), React 19, Vite 6, class-validator


<!-- MANUAL ADDITIONS START -->

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

When working on `apps/mini-app`, always use the Shadcn MCP for UI components. Use it to look up available components, get usage examples, and add new components to the project.

<!-- MANUAL ADDITIONS END -->
