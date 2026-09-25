# Build stage
FROM node:22-slim AS builder

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy domain package
COPY packages/domain ./packages/domain

# Copy API package
COPY apps/api ./apps/api

# Install with frozen lockfile
RUN pnpm install --frozen-lockfile

# Build domain first (shared by API)
RUN pnpm build:domain

# Build API
RUN pnpm --filter @subs/api build

# Runtime stage
FROM node:22-slim

# Enable corepack for pnpm
RUN corepack enable

# Install ffmpeg and yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
  ffmpeg \
  yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy domain package (both source and built dist)
COPY packages/domain ./packages/domain

# Copy API package (source for later reference, dist for runtime)
COPY apps/api ./apps/api

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built app from builder stage
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Create samples directory and copy samples if provided
RUN mkdir -p /app/samples

# Expose API port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start API
CMD ["node", "apps/api/dist/main.js"]
