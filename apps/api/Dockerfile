# ============================================================
# FinTrackr API — Multi-stage Dockerfile
# Stage 1: deps       — install all dependencies
# Stage 2: builder    — compile TypeScript → dist/
# Stage 3: runner     — minimal production image
# ============================================================

FROM node:22-alpine AS base
RUN npm install -g pnpm@11.3.0

# ── Stage 1: Install dependencies ──────────────────────────
FROM base AS deps
WORKDIR /app

# Copy workspace manifests first (layer-cache friendly)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json            ./apps/api/
COPY packages/db/package.json         ./packages/db/
COPY packages/shared/package.json     ./packages/shared/ 2>/dev/null || true

# Install only what the API (and its workspace deps) need
RUN pnpm install --frozen-lockfile --filter @fintrackr/api...

# ── Stage 2: Build ─────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Bring in installed node_modules from deps stage
COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy full source tree
COPY . .

# Build internal packages first, then the API
RUN pnpm --filter @fintrackr/db     build 2>/dev/null || true
RUN pnpm --filter @fintrackr/shared build 2>/dev/null || true
RUN pnpm --filter @fintrackr/api    build

# ── Stage 3: Production runner ─────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Security: run as non-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

# Copy only what's needed to run — no source, no devDeps
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist          ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules           ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules  ./apps/api/node_modules

# Copy packages/db dist if it was built (used at runtime via drizzle)
COPY --from=builder --chown=nestjs:nodejs /app/packages               ./packages

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "dist/main"]
