# ============================================================
# FinTrackr Web — Multi-stage Dockerfile
# Stage 1: deps     — install dependencies
# Stage 2: builder  — expo export --platform web → dist/
# Stage 3: runner   — nginx:alpine serving static files
# ============================================================

FROM node:22-alpine AS base
RUN npm install -g pnpm@11.3.0

# ── Stage 1: Install dependencies ──────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json          ./apps/web/
COPY packages/shared/package.json   ./packages/shared/ 2>/dev/null || true

RUN pnpm install --frozen-lockfile --filter @fintrackr/web...

# ── Stage 2: Build static export ───────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY . .

# Build-time API URL injected via ARG so it bakes into the JS bundle
ARG EXPO_PUBLIC_API_URL=http://localhost/api
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

# Build shared packages if they exist
RUN pnpm --filter @fintrackr/shared build 2>/dev/null || true

# Expo web export → apps/web/dist/
RUN pnpm --filter @fintrackr/web build

# ── Stage 3: Serve with nginx ───────────────────────────────
FROM nginx:1.27-alpine AS runner

# Copy static output
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# SPA-aware nginx config
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
