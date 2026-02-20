FROM node:22-alpine AS base
RUN npm install -g pnpm@10 turbo@2

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune --scope=@aggregator/worker --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN turbo run build --filter=@aggregator/worker

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/worker/dist ./apps/worker/dist
COPY --from=installer /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=installer /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=installer /app/packages/shared/dist ./packages/shared/dist
COPY --from=installer /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=installer /app/packages/shared/node_modules ./packages/shared/node_modules
USER worker
EXPOSE 3001
CMD ["node", "apps/worker/dist/main.js"]
