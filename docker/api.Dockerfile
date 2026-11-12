# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.22.3-alpine3.23

FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@kamito/api...
RUN pnpm --filter @kamito/api deploy --legacy --prod /out/api
# Migrate image needs the prisma CLI (a devDependency of @kamito/db).
RUN pnpm --filter @kamito/db deploy --legacy /out/migrate

FROM ${NODE_IMAGE} AS migrate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/migrate ./
COPY --chown=node:node scripts/print-db-target.mjs ./scripts/print-db-target.mjs
COPY --chown=node:node docker/migrate-entrypoint.sh ./migrate-entrypoint.sh
USER node
ENTRYPOINT ["sh", "./migrate-entrypoint.sh"]

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
