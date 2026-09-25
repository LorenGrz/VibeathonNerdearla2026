# Build stage
FROM node:22-slim AS builder

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy domain package
COPY packages/domain ./packages/domain

# Copy web package
COPY apps/web ./apps/web

# Install with frozen lockfile
RUN pnpm install --frozen-lockfile

# Build domain first (shared by web)
RUN pnpm build:domain

# Build Next.js app (with NEXT_PUBLIC_API_URL injected via build arg or env)
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @subs/web build

# Runtime stage
FROM node:22-slim

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy domain package (source for reference)
COPY packages/domain ./packages/domain

# Copy web package (source for next config and public assets)
COPY apps/web ./apps/web

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built Next.js app from builder stage
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

# Expose web port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start Next.js
CMD ["pnpm", "--filter", "@subs/web", "start"]
