# Quickstart: Database Schema & Prisma Setup

**Feature**: 002-prisma-schema

## Prerequisites

- Node.js 20 LTS, pnpm
- Docker & Docker Compose (for PostgreSQL)
- Completed `001-monorepo-scaffold` setup

## Setup Steps

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

Wait for healthy status:
```bash
docker compose ps  # postgres should show "healthy"
```

### 2. Install Dependencies

```bash
pnpm install
```

This triggers Prisma's postinstall hook which runs `prisma generate`.

### 3. Run Migrations

```bash
cd apps/api
npx prisma migrate deploy
```

### 4. Seed Test Data

```bash
cd apps/api
npx prisma db seed
```

### 5. Verify

```bash
# Start the API
cd apps/api
pnpm dev

# In another terminal, check health (should include database: up)
curl http://localhost:3000/health
```

## Common Tasks

### View Database in Prisma Studio

```bash
cd apps/api
npx prisma studio
```

### Create a New Migration (after schema changes)

```bash
cd apps/api
npx prisma migrate dev --name <migration-name>
```

### Reset Database (destructive)

```bash
cd apps/api
npx prisma migrate reset
```

This drops the database, re-runs all migrations, and re-seeds.

## Environment Variables

| Variable      | Required | Default | Description                    |
|---------------|----------|---------|--------------------------------|
| DATABASE_URL  | Yes      | —       | PostgreSQL connection string   |

Already defined in `.env.example`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aggregator?schema=public
```
