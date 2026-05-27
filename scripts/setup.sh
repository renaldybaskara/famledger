#!/usr/bin/env bash
# ============================================================
# FinTrackr — First-Time Setup Script
#
# Run once after cloning on a fresh VPS / local machine:
#   bash scripts/setup.sh
#
# What it does:
#   1. Creates .env with randomly generated secrets
#   2. Builds Docker images
#   3. Starts core infrastructure (Postgres, Redis)
#   4. Runs DB migrations + seed
#   5. Starts the full stack
#   6. Pulls the default Ollama model
# ============================================================

set -euo pipefail

# ── Color helpers ────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERR]${RESET}   $*" >&2; }
die()     { error "$*"; exit 1; }

# ── Prerequisites check ──────────────────────────────────────
check_requirements() {
  info "Checking requirements..."

  command -v docker  >/dev/null 2>&1 || die "Docker is not installed. Visit https://docs.docker.com/get-docker/"
  command -v openssl >/dev/null 2>&1 || die "openssl is required but not found"

  # Check Docker Compose V2 (docker compose, not docker-compose)
  if ! docker compose version >/dev/null 2>&1; then
    die "Docker Compose V2 is required. Update Docker Desktop or install the compose plugin."
  fi

  success "All requirements satisfied"
}

# ── .env generation ──────────────────────────────────────────
setup_env() {
  if [ -f .env ]; then
    warn ".env already exists — skipping generation"
    warn "To regenerate secrets, delete .env and rerun this script"
    return 0
  fi

  info "Generating .env from template..."
  [ -f .env.example ] || die ".env.example not found — are you in the project root?"
  cp .env.example .env

  # Generate cryptographically random secrets
  local jwt_secret jwt_refresh_secret pg_pass redis_pass minio_secret \
        encryption_key glitchtip_secret plausible_secret

  jwt_secret=$(openssl rand -hex 64)
  jwt_refresh_secret=$(openssl rand -hex 64)
  pg_pass=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  redis_pass=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  minio_secret=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  encryption_key=$(openssl rand -hex 32)
  glitchtip_secret=$(openssl rand -hex 50)
  plausible_secret=$(openssl rand -hex 64)

  # Inject secrets (sed with | delimiter to avoid / conflicts)
  sed -i \
    -e "s|change_me_to_random_64_char_string_in_production|${jwt_secret}|g" \
    -e "s|change_me_to_another_random_64_char_string|${jwt_refresh_secret}|g" \
    -e "s|POSTGRES_PASSWORD=change_me_in_production|POSTGRES_PASSWORD=${pg_pass}|g" \
    -e "s|REDIS_PASSWORD=change_me_in_production|REDIS_PASSWORD=${redis_pass}|g" \
    -e "s|MINIO_SECRET_KEY=change_me_in_production|MINIO_SECRET_KEY=${minio_secret}|g" \
    -e "s|ENCRYPTION_KEY=change_me_to_32_char_hex_string_prod|ENCRYPTION_KEY=${encryption_key}|g" \
    .env

  # Append secrets not in .env.example
  cat >> .env <<EOF

# ── Auto-generated secrets (DO NOT commit) ──────────────────
GLITCHTIP_SECRET=${glitchtip_secret}
PLAUSIBLE_SECRET=${plausible_secret}
GRAFANA_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')
EOF

  success ".env created with randomly generated secrets"
  echo ""
  warn "IMPORTANT: Open .env and configure at minimum:"
  warn "  - DOMAIN (your server's domain or IP)"
  warn "  - CADDY_EMAIL (for Let's Encrypt TLS)"
  warn "  - SMTP_* (for email notifications, optional)"
  warn "  - GOOGLE_CLIENT_* (for Google OAuth, optional)"
  echo ""
  read -r -p "Press ENTER to continue or Ctrl+C to edit .env first... "
}

# ── Docker build ─────────────────────────────────────────────
build_images() {
  info "Building Docker images (this may take several minutes)..."
  docker compose build --parallel
  success "Images built"
}

# ── Infrastructure bootstrap ─────────────────────────────────
start_infrastructure() {
  info "Starting core infrastructure (PostgreSQL + Redis)..."
  docker compose up -d postgres redis

  info "Waiting for PostgreSQL to be ready..."
  local attempts=0
  until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-fintrackr}" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    [ $attempts -ge 30 ] && die "PostgreSQL did not become ready after 30 attempts"
    echo -n "."
    sleep 2
  done
  echo ""
  success "PostgreSQL is ready"

  info "Waiting for Redis to be ready..."
  attempts=0
  until docker compose exec -T redis valkey-cli -a "${REDIS_PASSWORD:-changeme}" ping >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    [ $attempts -ge 20 ] && die "Redis did not become ready after 20 attempts"
    echo -n "."
    sleep 2
  done
  echo ""
  success "Redis is ready"
}

# ── Database migrations ──────────────────────────────────────
run_migrations() {
  info "Starting MinIO for migration prerequisites..."
  docker compose up -d minio
  sleep 5

  info "Running database migrations..."
  if docker compose run --rm api node dist/scripts/migrate 2>/dev/null; then
    success "Migrations completed"
  else
    warn "Migration script not found or failed — you may need to run manually:"
    warn "  docker compose run --rm api node dist/scripts/migrate"
  fi
}

# ── Database seeding ─────────────────────────────────────────
seed_database() {
  info "Seeding default data (categories, settings)..."
  if docker compose run --rm api node dist/scripts/seed 2>/dev/null; then
    success "Seed completed"
  else
    warn "Seed script not found or failed — you may need to run manually:"
    warn "  docker compose run --rm api node dist/scripts/seed"
  fi
}

# ── Start full stack ─────────────────────────────────────────
start_all_services() {
  info "Starting all services..."
  docker compose up -d
  success "All services started"
}

# ── Ollama model pull ────────────────────────────────────────
pull_ollama_model() {
  local model="${OLLAMA_MODEL:-llama3.2:3b}"
  info "Waiting for Ollama to initialize (this can take up to 2 minutes)..."

  local attempts=0
  until docker compose exec -T ollama ollama list >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    [ $attempts -ge 40 ] && {
      warn "Ollama did not start in time. Pull the model manually:"
      warn "  docker compose exec ollama ollama pull ${model}"
      return 0
    }
    echo -n "."
    sleep 3
  done
  echo ""

  info "Pulling Ollama model: ${model}"
  warn "This may download several GB — be patient on slow connections"
  if docker compose exec ollama ollama pull "${model}"; then
    success "Ollama model '${model}' is ready"
  else
    warn "Ollama model pull failed. Run manually:"
    warn "  docker compose exec ollama ollama pull ${model}"
  fi
}

# ── MinIO bucket init ────────────────────────────────────────
init_minio_bucket() {
  info "Initializing MinIO bucket..."
  if docker compose run --rm minio-init >/dev/null 2>&1; then
    success "MinIO bucket ready"
  else
    warn "MinIO init container failed — bucket may already exist (OK)"
  fi
}

# ── Print summary ────────────────────────────────────────────
print_summary() {
  local domain="${DOMAIN:-localhost}"

  echo ""
  echo -e "${GREEN}${BOLD}=================================================${RESET}"
  echo -e "${GREEN}${BOLD}  FinTrackr is ready!${RESET}"
  echo -e "${GREEN}${BOLD}=================================================${RESET}"
  echo ""
  echo -e "  ${BOLD}Application${RESET}"
  echo -e "  Web App:       http://${domain}"
  echo -e "  API:           http://${domain}/api"
  echo -e "  API Docs:      http://${domain}/api/docs"
  echo ""
  echo -e "  ${BOLD}Monitoring${RESET}"
  echo -e "  Grafana:       http://grafana.${domain}"
  echo -e "  Uptime Kuma:   http://uptime.${domain}"
  echo -e "  Prometheus:    http://${domain}:9090  (internal)"
  echo ""
  echo -e "  ${BOLD}Services${RESET}"
  echo -e "  GlitchTip:     http://errors.${domain}"
  echo -e "  Plausible:     http://analytics.${domain}"
  echo -e "  MinIO Console: http://${domain}/minio-console"
  echo ""
  echo -e "  ${BOLD}Useful commands${RESET}"
  echo -e "  View logs:     docker compose logs -f [service]"
  echo -e "  API logs:      docker compose logs -f api"
  echo -e "  Stop:          docker compose down"
  echo -e "  Update:        docker compose pull && docker compose up -d"
  echo ""
  echo -e "  Grafana credentials are in your .env file (GRAFANA_PASSWORD)"
  echo ""
}

# ── Main ─────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}FinTrackr — First-Time Setup${RESET}"
  echo "================================================="
  echo ""

  # Change to project root (script may be called from anywhere)
  cd "$(dirname "$0")/.."

  # Load .env if it exists (for variable references in this script)
  [ -f .env ] && set -o allexport && source .env && set +o allexport || true

  check_requirements
  setup_env

  # Reload env after generation
  [ -f .env ] && set -o allexport && source .env && set +o allexport || true

  build_images
  start_infrastructure
  run_migrations
  seed_database
  start_all_services
  init_minio_bucket
  pull_ollama_model
  print_summary
}

main "$@"
