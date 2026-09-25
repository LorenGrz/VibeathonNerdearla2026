FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

# Copy workspace manifests and root tsconfig
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/api/package.json ./apps/api/

# Install all dependencies (including dev) for building
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/domain ./packages/domain
COPY apps/api ./apps/api

# Build domain and api
RUN pnpm --filter @subs/domain build && pnpm --filter @subs/api build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

# Install system runtime dependencies: ffmpeg for audio transcoding, yt-dlp for YouTube audio stream
RUN apk add --no-cache ffmpeg yt-dlp

RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy build artifacts
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

ENV NODE_ENV=production
ENV PORT=4000
ENV SAMPLES_DIR=/app/samples

EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
