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
- 005-subscription-lists-api: Added TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, Prisma ORM v6, class-validator, class-transformer
- 004-channels-api: Added TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, Prisma ORM v6+, `class-validator`, `class-transformer`
- 003-telegram-jwt-auth: Added TypeScript 5.x with `strict: true`, Node.js 20 LTS + NestJS 10, @nestjs/jwt, @nestjs/config, Prisma ORM v6, node:crypto (built-in)


<!-- MANUAL ADDITIONS START -->

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

<!-- MANUAL ADDITIONS END -->
