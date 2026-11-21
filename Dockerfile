# GAFLEX game server (Node + Socket.IO). Builds one self-contained bundle, runs it on a slim image.
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
# the lockfile lists every workspace project; its manifest keeps --frozen-lockfile happy
COPY apps/client/package.json apps/client/
RUN pnpm install --frozen-lockfile --filter @gaflex/server...
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @gaflex/server build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/server/dist/index.js ./index.js
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:${PORT:-3001}/health || exit 1
CMD ["node", "index.js"]
