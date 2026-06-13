#!/usr/bin/env bash
# ============================================================
# Saku — Deploy to Railway (Scenario 1: Railway PostgreSQL)
# API + PostgreSQL + Redis semuanya di Railway
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}ℹ  ${NC}$*"; }
success() { echo -e "${GREEN}✅ ${NC}$*"; }
warn()    { echo -e "${YELLOW}⚠️  ${NC}$*"; }
error()   { echo -e "${RED}❌ ${NC}$*"; exit 1; }
step()    { echo -e "\n${BOLD}━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ── Prerequisites ─────────────────────────────────────────────
step "Prerequisites"

if ! command -v node &>/dev/null; then
    error "Node.js diperlukan. Install dari https://nodejs.org"
fi

if ! command -v railway &>/dev/null; then
    warn "Railway CLI tidak ditemukan. Menginstall..."
    npm install -g @railway/cli
fi
success "Railway CLI siap"

# ── Login ─────────────────────────────────────────────────────
step "Login ke Railway"
railway login
success "Login berhasil"

# ── Init project ──────────────────────────────────────────────
step "Buat Project"
info "Membuat project Railway baru..."
railway init --name saku-fintracker
success "Project saku-fintracker dibuat"

# ── Tambah PostgreSQL ─────────────────────────────────────────
step "Tambah PostgreSQL"
info "Menambahkan plugin PostgreSQL..."
railway add --plugin postgresql
success "PostgreSQL ditambahkan"

# ── Tambah Redis ──────────────────────────────────────────────
step "Tambah Redis"
info "Menambahkan plugin Redis..."
railway add --plugin redis
success "Redis ditambahkan"

# ── Generate secrets ──────────────────────────────────────────
step "Generate JWT Secrets"
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
success "JWT secrets di-generate"

# ── Set environment variables ──────────────────────────────────
step "Set Environment Variables"

# DATABASE_URL dan REDIS_URL di-inject otomatis via Railway variable references.
# Pastikan di Railway Dashboard → Service Variables sudah ada:
#   DATABASE_URL  = ${{Postgres.DATABASE_URL}}
#   REDIS_URL     = ${{Redis.REDIS_URL}}
railway variables set \
    JWT_SECRET="$JWT_SECRET" \
    JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
    PORT="4000" \
    NODE_ENV="production" \
    TZ="Asia/Jakarta" \
    SELF_HOSTED_MODE="true" \
    DISABLE_TIER_LIMITS="true"

success "Environment variables di-set"

# ── Simpan secrets ke file lokal ──────────────────────────────
SECRETS_FILE=".env.railway.deployed"
cat > "$SECRETS_FILE" << EOF
# ============================================================
# Saku — Railway Deployed Secrets
# Generated: $(date)
# JANGAN commit file ini ke git!
# ============================================================

JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET

# DATABASE_URL dan REDIS_URL di-inject Railway secara otomatis:
#   DATABASE_URL  = \${{Postgres.DATABASE_URL}}
#   REDIS_URL     = \${{Redis.REDIS_URL}}
#   REDIS_PASSWORD= \${{Redis.REDIS_PASSWORD}}

# Opsional — tambahkan manual di Railway Dashboard:
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_CALLBACK_URL=https://YOUR_API.railway.app/api/auth/google/callback
# GOOGLE_GMAIL_CALLBACK_URL=https://YOUR_API.railway.app/api/email-integrations/gmail/callback
# OPENROUTER_API_KEY=
# MIDTRANS_SERVER_KEY=
# MIDTRANS_CLIENT_KEY=
# APP_URL=https://YOUR_APP.vercel.app
EOF

success "Secrets disimpan di $SECRETS_FILE"
warn "Tambahkan $SECRETS_FILE ke .gitignore!"

# ── Konfigurasi Service di Dashboard ──────────────────────────
step "Konfigurasi Railway Dashboard (manual)"
echo ""
echo "  Buka https://railway.app/dashboard → project saku-fintracker"
echo ""
echo "  1. Klik service API → Settings → Source"
echo "     Root Directory : apps/api-go"
echo ""
echo "  2. Settings → Build"
echo "     Dockerfile Path: Dockerfile"
echo ""
echo "  3. Settings → Variables → tambahkan:"
echo "     DATABASE_URL  = \${{Postgres.DATABASE_URL}}"
echo "     REDIS_URL     = \${{Redis.REDIS_URL}}"
echo "     REDIS_PASSWORD= \${{Redis.REDIS_PASSWORD}}"
echo ""
echo "  4. Klik 'Redeploy' setelah selesai"
echo ""

# ── Deploy ────────────────────────────────────────────────────
step "Deploy API"
read -rp "Deploy sekarang via CLI? (y/n): " CONFIRM
if [[ "$CONFIRM" == "y" ]]; then
    railway up --detach
    success "Deploy dimulai!"
    info "Pantau log : railway logs"
    info "Dapatkan URL: railway domain"
else
    info "Jalankan 'railway up' manual saat siap"
fi

# ── Info Vercel ────────────────────────────────────────────────
step "Deploy Frontend ke Vercel"
echo ""
echo "  1. Push repo ini ke GitHub"
echo ""
echo "  2. Buka https://vercel.com/new → Import repo"
echo ""
echo "  3. Konfigurasi project di Vercel:"
echo "     Framework Preset : Other"
echo "     Root Directory   : apps/web"
echo "     Build Command    : (biarkan default — vercel.json sudah ada)"
echo "     Output Directory : dist"
echo ""
echo "  4. Tambahkan Environment Variable:"
echo "     Nama : EXPO_PUBLIC_API_URL"
echo "     Nilai: https://YOUR_RAILWAY_URL/api"
echo "     (ganti YOUR_RAILWAY_URL dengan output 'railway domain')"
echo ""
echo "  5. Klik Deploy"
echo ""
success "Setup Railway DB selesai!"
