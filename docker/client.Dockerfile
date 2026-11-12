# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.22.3-alpine3.23

FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec turbo run build --filter=@kamito/client...

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
# Standalone output keeps the monorepo layout under apps/client.
COPY --from=build --chown=node:node /repo/apps/client/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/client/.next/static ./apps/client/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/client/server.js"]
