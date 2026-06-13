#!/usr/bin/env bash
# ============================================================
# Saku — Deploy ke Railway (Scenario 2: Supabase PostgreSQL)
# API + Redis di Railway, PostgreSQL di Supabase (free tier)
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

# ── Panduan setup Supabase ─────────────────────────────────────
step "Setup Supabase Database"
echo ""
echo "  Buat project Supabase terlebih dahulu (jika belum):"
echo ""
echo "  1. Buka https://supabase.com/dashboard → New Project"
echo "  2. Pilih region: Southeast Asia (Singapore)"
echo "  3. Set database password yang kuat"
echo "  4. Tunggu project selesai dibuat (~2 menit)"
echo ""
echo "  Aktifkan pgvector extension:"
echo "  5. Dashboard → Database → Extensions"
echo "     Cari 'vector' → klik Enable"
echo "     ATAU di SQL Editor:"
echo "     CREATE EXTENSION IF NOT EXISTS vector;"
echo ""
echo "  Dapatkan connection string:"
echo "  6. Settings → Database → Connection String → URI"
echo "     Format: postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
echo ""

read -rp "  Masukkan Supabase DATABASE_URL: " SUPABASE_DATABASE_URL

if [[ -z "$SUPABASE_DATABASE_URL" ]]; then
    error "DATABASE_URL tidak boleh kosong"
fi

# Tambahkan sslmode=require jika belum ada (wajib untuk Supabase)
if [[ "$SUPABASE_DATABASE_URL" != *"sslmode"* ]]; then
    if [[ "$SUPABASE_DATABASE_URL" == *"?"* ]]; then
        SUPABASE_DATABASE_URL="${SUPABASE_DATABASE_URL}&sslmode=require"
    else
        SUPABASE_DATABASE_URL="${SUPABASE_DATABASE_URL}?sslmode=require"
    fi
    info "sslmode=require ditambahkan ke DATABASE_URL"
fi

success "Supabase DATABASE_URL diterima"

# ── Login Railway ──────────────────────────────────────────────
step "Login ke Railway"
railway login
success "Login berhasil"

# ── Init project ──────────────────────────────────────────────
step "Buat Project Railway"
railway init --name saku-fintracker
success "Project saku-fintracker dibuat"

# ── Tambah Redis saja (DB ada di Supabase) ────────────────────
step "Tambah Redis"
info "Menambahkan plugin Redis (untuk session/token store)..."
railway add --plugin redis
success "Redis ditambahkan"

# ── Generate secrets ──────────────────────────────────────────
step "Generate JWT Secrets"
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
success "JWT secrets di-generate"

# ── Set environment variables ──────────────────────────────────
step "Set Environment Variables"
railway variables set \
    DATABASE_URL="$SUPABASE_DATABASE_URL" \
    JWT_SECRET="$JWT_SECRET" \
    JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
    PORT="4000" \
    NODE_ENV="production" \
    TZ="Asia/Jakarta" \
    SELF_HOSTED_MODE="true" \
    DISABLE_TIER_LIMITS="true"

success "Environment variables di-set"

# ── Simpan secrets ke file lokal ──────────────────────────────
SECRETS_FILE=".env.supabase.deployed"
cat > "$SECRETS_FILE" << EOF
# ============================================================
# Saku — Supabase + Railway Deployed Secrets
# Generated: $(date)
# JANGAN commit file ini ke git!
# ============================================================

DATABASE_URL=$SUPABASE_DATABASE_URL
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET

# REDIS_URL di-inject Railway secara otomatis:
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

# ── Peringatan Supabase free tier ─────────────────────────────
step "Catatan Supabase Free Tier"
echo ""
warn "Supabase free tier: project PAUSE otomatis setelah 7 hari tidak ada aktivitas"
echo ""
echo "  Solusi untuk mencegah auto-pause:"
echo "  • Upgrade ke Supabase Pro (\$25/bln) — direkomendasikan untuk production"
echo "  • ATAU setup UptimeRobot / health check untuk ping API setiap hari"
echo "    Monitor URL: https://YOUR_RAILWAY_URL/api/health"
echo "  • ATAU gunakan Railway PostgreSQL (Scenario 1) yang tidak auto-pause"
echo ""
success "Setup Supabase + Railway selesai!"
