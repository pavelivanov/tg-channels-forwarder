# Research: Monorepo Scaffold & Infrastructure

**Branch**: `001-monorepo-scaffold` | **Date**: 2026-02-16

## 1. Turborepo Monorepo Structure

**Decision**: Standard `apps/` + `packages/` split with pnpm workspaces
and `@aggregator/*` scoped packages. `turbo.json` declares `build`,
`dev`, `test`, and `lint` tasks with dependency ordering.

**Rationale**: Canonical Turborepo structure. `build` uses `^build`
(compile deps first), `dev` uses `cache: false` + `persistent: true`
(long-running watcher), `test` depends on `^build` (types must exist),
`lint` depends on `^lint` for per-package cache.

**Alternatives considered**:
- Nx: heavier, more opinionated. Turborepo sufficient for this scope.
- Lerna: legacy, replaced by Turborepo for task running.

## 2. NestJS Health Check

**Decision**: Use `@nestjs/terminus` with a `HealthController` exposing
`GET /health`. Include memory heap check. Returns structured JSON with
per-indicator status.

**Rationale**: Production-ready from day one. Structured response body
enables Docker/K8s readiness/liveness probes with diagnostic info.
The spec requires `{ "status": "ok" }` — terminus returns
`{ "status": "ok", "info": {...} }` which satisfies the contract.

**Alternatives considered**:
- Plain `{ status: 'ok' }` controller: no diagnostic value.
- No health endpoint: blocks container orchestration probes.

## 3. Multi-Stage Dockerfile

**Decision**: Use `turbo prune --scope=<app> --docker` to produce a
minimal sub-repo, then a four-stage Dockerfile:
`base` → `pruner` → `installer` → `runner`.

**Rationale**: `turbo prune --docker` splits into `out/json/`
(package.json files for install layer cache) and `out/full/` (source).
Docker install layer only invalidates when package.json/lockfile changes.
Runner stage copies only `dist/` and `node_modules/`, runs as non-root.

**Alternatives considered**:
- `pnpm deploy`: simpler but loses Docker layer cache split.
- Single-stage: ships compilers and dev deps into production.
- Distroless base: `node:20-alpine` with non-root user sufficient.

## 4. Shared TypeScript Config

**Decision**: `packages/tsconfig` as a plain package (no build step)
containing `tsconfig.base.json`, `tsconfig.node.json`, and
`tsconfig.nestjs.json`. Apps extend via package name.

**Rationale**: Avoids config drift. TypeScript resolves `extends` at
compile time via package.json exports. NestJS config adds
`experimentalDecorators` and `emitDecoratorMetadata`.

**Alternatives considered**:
- Root-level tsconfig.base.json: relative paths break at depth.
- Project References: too much config burden for scaffold.

## 5. ESLint Configuration

**Decision**: ESLint v9 flat config (`eslint.config.js`) with shared
`packages/eslint-config` exporting composable config arrays using
`typescript-eslint`.

**Rationale**: Flat config is default in ESLint v9, legacy format
deprecated. Plugins resolve from shared package's node_modules via
JS imports, eliminating `@rushstack/eslint-patch` hack. Per-package
configs enable Turborepo lint caching.

**Alternatives considered**:
- Legacy `.eslintrc.js`: deprecated, don't start new projects on it.
- Biome: faster but narrower TypeScript rules, no NestJS plugins.

## 6. Docker Compose for Local Dev

**Decision**: Two Compose files: `docker-compose.yml`
(production-like with infrastructure + apps) and
`docker-compose.dev.yml` (dev overrides with volumes,
hot reload, port mapping).

**Rationale**: Override pattern shares infrastructure definitions while
varying app build targets. Dev override mounts source, uses dev target,
anonymous volume for `node_modules` prevents host platform conflicts.

**Alternatives considered**:
- Single compose with profiles: can't override build.target cleanly.
- No Docker for dev: insufficient when Postgres/Redis required.

## 7. Pino Logging in NestJS

**Decision**: Use `nestjs-pino` (iamolegga/nestjs-pino) configured via
`LoggerModule.forRoot`. Use `pino-pretty` in dev, raw JSON in prod.
Bootstrap with `bufferLogs: true` and `app.useLogger(app.get(Logger))`.

**Rationale**: `nestjs-pino` binds request context (request ID, method,
URL) via `AsyncLocalStorage` for structured log correlation. `bufferLogs`
ensures bootstrap logs route through pino.

**Alternatives considered**:
- Custom LoggerService: AsyncLocalStorage binding is non-trivial.
- Winston: slower, not JSON-native.
- NestJS built-in: no structured output, no request context.

## 8. Environment Variable Validation

**Decision**: `@nestjs/config` with Zod `validate` function for NestJS
apps. Standalone Zod parse at entry point for the plain Node.js worker.
Fail-fast on startup with clear error messages.

**Rationale**: Zod infers TypeScript types from schemas, produces
excellent error messages listing every missing/malformed variable,
and composes across modules. `@nestjs/config` accepts a `validate`
function making Zod integration first-class.

**Alternatives considered**:
- Joi: no TypeScript type inference from schemas.
- envalid: simpler but narrower, no cross-field validation.
- No validation: unacceptable for a scaffold.
