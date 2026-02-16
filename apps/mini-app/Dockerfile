FROM node:22-alpine AS builder
WORKDIR /app
COPY . .

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/mini-app/index.html /usr/share/nginx/html/index.html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
