FROM node:22-alpine AS base
RUN npm install -g pnpm@10 turbo@2

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune --scope=@aggregator/mini-app --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN turbo run build --filter=@aggregator/mini-app

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/mini-app/dist /usr/share/nginx/html/app
# SPA fallback: serve index.html for all /app/* routes
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  location /app {\n\
    try_files $uri $uri/ /app/index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK CMD wget -q --spider http://localhost:80/app/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
