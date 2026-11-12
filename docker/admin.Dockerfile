# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.22.3-alpine3.23

FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@kamito/admin...

# Unprivileged nginx runs as non-root and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine AS runtime
COPY --chown=nginx:nginx --from=build /repo/apps/admin/dist /usr/share/nginx/html
COPY docker/admin-nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/admin-api-proxy.conf /etc/nginx/snippets/api-proxy.conf
COPY docker/admin-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chmod=755 docker/admin-entrypoint.sh /docker-entrypoint.d/40-write-admin-config.sh
EXPOSE 8080
