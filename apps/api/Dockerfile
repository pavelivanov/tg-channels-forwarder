FROM node:22-alpine AS base
RUN npm install -g pnpm@10 turbo@2

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune --scope=@aggregator/api --scope=@aggregator/mini-app --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN turbo run build --filter=@aggregator/api --filter=@aggregator/mini-app

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
COPY --from=installer /app/apps/api/dist ./apps/api/dist
COPY --from=installer /app/apps/api/package.json ./apps/api/package.json
COPY --from=installer /app/apps/mini-app/dist ./apps/mini-app/dist
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/packages/shared/dist ./packages/shared/dist
COPY --from=installer /app/packages/shared/package.json ./packages/shared/package.json
USER nestjs
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
