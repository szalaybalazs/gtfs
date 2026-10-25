# Daily static GTFS import, run as a scheduled Fargate task (see sst.config.ts)
FROM node:22-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY src ./src

CMD ["node", "src/jobs/import.ts"]
