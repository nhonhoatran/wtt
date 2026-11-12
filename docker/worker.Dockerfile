# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.22.3-alpine3.23

FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@kamito/worker...
RUN pnpm --filter @kamito/worker deploy --legacy --prod /out/worker

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/worker ./
USER node
CMD ["node", "dist/main.js"]
