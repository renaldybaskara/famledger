# ============================================================
# FinTrackr Web — Multi-stage Dockerfile
# Expo (React Native Web) → static export → nginx
# ============================================================

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Stage 1: Install dependencies ──────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

ENV CI=true
# Use hoisted linker so node_modules is a flat directory (safe to COPY between stages)
RUN pnpm install --frozen-lockfile --node-linker=hoisted || pnpm install --no-frozen-lockfile --node-linker=hoisted

# ── Stage 2: Build static export ───────────────────────────
FROM base AS builder
WORKDIR /app

ENV CI=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time API URL injected via ARG so it bakes into the JS bundle
ARG EXPO_PUBLIC_API_URL=http://localhost/api
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

# Expo web export → dist/
RUN node_modules/.bin/expo export --platform web

# ── Stage 3: Serve with nginx ───────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

# Fallback nginx config for SPA routing — inline so no external file needed
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n  gzip on;\n  gzip_types text/plain text/css application/json application/javascript text/xml application/xml;\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
