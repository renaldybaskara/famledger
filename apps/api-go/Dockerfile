# ============================================================
# FinTrackr API (Go) — Multi-stage Dockerfile
# Clean Architecture · Gin · GORM · PostgreSQL
# ============================================================

# ── Stage 1: Builder ────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install git (needed for go mod download with private/VCS dependencies)
RUN apk add --no-cache git ca-certificates

# Copy go module files first for better layer caching
COPY go.mod go.sum ./

# Download dependencies (cached unless go.mod/go.sum changes)
RUN go mod download

# Copy source code
COPY . .

# Build static binary
# CGO_ENABLED=0 → fully static, no libc dependency
# -ldflags="-w -s" → strip debug info (smaller binary)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
    -ldflags="-w -s" \
    -o /app/server \
    ./cmd/server

# Verify binary was built
RUN test -f /app/server && echo "✅ Binary built successfully" || (echo "❌ Build failed" && exit 1)

# ── Stage 2: Runner ─────────────────────────────────────────
FROM alpine:3.19 AS runner

WORKDIR /app

# ca-certificates: needed for HTTPS calls (Google OAuth)
# tzdata: timezone support
RUN apk add --no-cache ca-certificates tzdata wget

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only the binary from builder
COPY --from=builder --chown=appuser:appgroup /app/server /app/server

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["/app/server"]
