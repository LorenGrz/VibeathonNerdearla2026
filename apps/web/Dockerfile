FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

# Copy workspace manifests and root tsconfig
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/web/package.json ./apps/web/

# Install all dependencies for build
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/domain ./packages/domain
COPY apps/web ./apps/web

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build domain and web application
RUN pnpm --filter @subs/domain build && pnpm --filter @subs/web build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/domain/package.json ./packages/domain/
COPY apps/web/package.json ./apps/web/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built artifacts
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_API_URL=http://localhost:4000

EXPOSE 3000

CMD ["pnpm", "--filter", "@subs/web", "start"]
