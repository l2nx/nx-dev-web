# syntax=docker/dockerfile:1
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
