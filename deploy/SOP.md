# SOP Deployment — Saku (FinTracker)

> Standard Operating Procedure untuk deploy, update, dan migrasi database.
> Berlaku untuk: Railway API + Vercel Frontend (2 skenario database).

---

## Daftar Isi

1. [Arsitektur Deployment](#1-arsitektur-deployment)
2. [Prerequisites](#2-prerequisites)
3. [First-Time Setup](#3-first-time-setup)
4. [Database Migration](#4-database-migration)
5. [Deploy Update (Rutin)](#5-deploy-update-rutin)
6. [Deploy Frontend (Vercel)](#6-deploy-frontend-vercel)
7. [Verifikasi Post-Deploy](#7-verifikasi-post-deploy)
8. [Rollback](#8-rollback)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Arsitektur Deployment

```
┌─────────────────────────────────────────────────────────────┐
│  User Browser                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
          ┌─────────────────▼──────────────────┐
          │        Vercel (Frontend)            │
          │   Expo Web (Static Export)          │
          │   apps/web → dist/                  │
          └─────────────────┬──────────────────┘
                            │ API calls → EXPO_PUBLIC_API_URL
          ┌─────────────────▼──────────────────┐
          │       Railway (API + Redis)         │
          │   Go 1.22 + Gin, port 4000          │
          │   Background workers (Gmail/IMAP)   │
          │   apps/api-go/ (Dockerfile)         │
          └──────────┬──────────────────────────┘
                     │
         ┌───────────┴──────────────┐
         │                          │
  ┌──────▼──────┐            ┌──────▼──────┐
  │  Skenario 1 │            │  Skenario 2 │
  │  Railway    │            │  Supabase   │
  │  PostgreSQL │            │  PostgreSQL │
  │  (plugin)   │            │  (free tier)│
  └─────────────┘            └─────────────┘
```

**Catatan Penting:**
- `EXPO_PUBLIC_API_URL` di-bake ke JS bundle saat build — wajib di-set di Vercel **sebelum** build pertama
- Background workers (Gmail polling, IMAP) berjalan di dalam API container Railway — tidak perlu service terpisah
- `database.AutoMigrate()` berjalan otomatis setiap API startup — tidak ada file migration manual

---

## 2. Prerequisites

| Tool | Versi | Install |
|------|-------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| Railway CLI | latest | `npm install -g @railway/cli` |
| Git | any | https://git-scm.com |
| pnpm | ≥ 8 | `npm install -g pnpm` |

Verifikasi:
```bash
node --version      # v18+
railway --version   # 3.x.x
git --version
pnpm --version
```

---

## 3. First-Time Setup

### Skenario 1 — Railway PostgreSQL

```bash
bash deploy/1-railway-db.sh
```

Script ini otomatis:
1. Install Railway CLI (jika belum ada)
2. `railway login` → buka browser untuk auth
3. Buat project `saku-fintracker`
4. Tambah plugin PostgreSQL + Redis
5. Generate JWT secrets
6. Set environment variables
7. Guide konfigurasi di Railway Dashboard

Setelah script selesai, lakukan **manual** di Railway Dashboard:

```
project saku-fintracker → service API
  Settings → Source → Root Directory   : apps/api-go
  Settings → Build  → Dockerfile Path  : Dockerfile
  Settings → Variables → tambahkan:
    DATABASE_URL   = ${{Postgres.DATABASE_URL}}
    REDIS_URL      = ${{Redis.REDIS_URL}}
    REDIS_PASSWORD = ${{Redis.REDIS_PASSWORD}}
```

Kemudian klik **Deploy**.

---

### Skenario 2 — Supabase PostgreSQL

**Step 1: Buat project Supabase**
1. Buka https://supabase.com/dashboard → **New Project**
2. Region: **Southeast Asia (Singapore)**
3. Catat database password
4. Tunggu ~2 menit hingga project ready

**Step 2: Aktifkan pgvector**
```sql
-- Jalankan di Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```
Atau: Dashboard → Database → Extensions → cari `vector` → Enable

**Step 3: Dapatkan connection string**
```
Settings → Database → Connection String → URI
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Step 4: Jalankan script**
```bash
bash deploy/2-supabase-db.sh
# Script akan meminta Supabase DATABASE_URL
```

---

## 4. Database Migration

### Cara Kerja (GORM AutoMigrate)

Saku menggunakan **GORM AutoMigrate** — migrasi berjalan **otomatis saat API startup**:

```go
// apps/api-go/internal/infrastructure/database/database.go
func AutoMigrate(db *gorm.DB) error {
    return db.AutoMigrate(
        &entity.User{},
        &entity.Transaction{},
        // ... semua entity
    )
}
```

**Jaminan AutoMigrate:**
- ✅ Tambah tabel baru
- ✅ Tambah kolom baru (dengan default value)
- ✅ Tambah index baru
- ✅ Ubah ukuran kolom (misal size:100 → size:255)
- ❌ **TIDAK** hapus kolom yang sudah ada
- ❌ **TIDAK** rename kolom
- ❌ **TIDAK** hapus tabel

### Tipe Perubahan & Risikonya

| Jenis Perubahan | Risiko | Strategi |
|----------------|--------|----------|
| Tambah tabel baru | ✅ Aman | Deploy langsung |
| Tambah kolom nullable / dengan default | ✅ Aman | Deploy langsung |
| Tambah kolom NOT NULL tanpa default | ⚠️ Medium | Baca [Multi-Step](#multi-step-untuk-kolom-not-null) |
| Rename kolom | ❌ Breaking | Baca [Breaking Change](#breaking-change) |
| Hapus kolom | ❌ Breaking | Baca [Breaking Change](#breaking-change) |
| Ubah tipe kolom | ❌ Breaking | Baca [Breaking Change](#breaking-change) |

---

### Smooth Migration — Deploy Normal (99% kasus)

Railway menggunakan **rolling deployment**:

```
Timeline:
  t=0    Container baru mulai build
  t=30s  Container baru start → AutoMigrate() berjalan
           → Tabel/kolom baru ditambahkan ke DB
  t=35s  Health check: GET /api/health → 200 OK ✅
  t=36s  Traffic dialihkan ke container baru
  t=37s  Container lama di-stop
```

**Ini aman karena:**
1. AutoMigrate hanya menambah, tidak menghapus
2. Container lama tidak tahu kolom baru → diabaikan (GORM SELECT hanya kolom yang dikenal)
3. Container baru sudah siap sebelum container lama berhenti

**Alur deploy normal:**
```bash
git add .
git commit -m "feat: tambah fitur X"
git push origin main
# Railway auto-detect push → trigger deploy otomatis
```

Railway otomatis deploy setiap push ke branch yang dikonfigurasi (default: `main`).

---

### Multi-Step untuk Kolom NOT NULL

Jika perlu tambah kolom NOT NULL **tanpa** default value:

**❌ Jangan ini (akan error):**
```go
// Langsung tambah NOT NULL tanpa default
type User struct {
    PhoneNumber string `gorm:"not null"` // ← BREAKING jika ada row existing
}
```

**✅ Lakukan 3 deploy terpisah:**

**Deploy 1** — Tambah kolom nullable dulu:
```go
type User struct {
    PhoneNumber *string `gorm:"size:20"` // nullable
}
```
```bash
git commit -m "feat: tambah kolom phone_number (nullable)"
git push
# Tunggu deploy selesai dan verified
```

**Deploy 2** — Isi data untuk row existing (jika perlu):
```sql
-- Jalankan manual di Railway/Supabase SQL console
UPDATE users SET phone_number = '' WHERE phone_number IS NULL;
```

**Deploy 3** — Ubah ke NOT NULL:
```go
type User struct {
    PhoneNumber string `gorm:"not null;default:'';size:20"`
}
```
```bash
git commit -m "feat: phone_number menjadi required"
git push
```

---

### Breaking Change (Rename / Hapus Kolom)

GORM tidak auto-migrate rename/drop. Harus dilakukan **manual**:

**Step 1** — Deploy kode baru (kode bisa handle kolom lama DAN baru):
```go
// Transisi: baca dari old_column, tulis ke new_column
```

**Step 2** — Jalankan SQL manual:

**Railway:**
```bash
# Connect ke Railway PostgreSQL
railway connect postgresql
```
```sql
-- Rename kolom
ALTER TABLE transactions RENAME COLUMN old_name TO new_name;

-- Hapus kolom (pastikan sudah tidak dipakai)
ALTER TABLE users DROP COLUMN IF EXISTS deprecated_field;
```

**Supabase:**
```sql
-- Jalankan di Supabase SQL Editor
ALTER TABLE transactions RENAME COLUMN old_name TO new_name;
```

**Step 3** — Deploy kode final (hapus handling kolom lama).

---

### Cek Status Migrasi

Setelah deploy, verifikasi migrasi berhasil:

```bash
# Cek log Railway untuk output AutoMigrate
railway logs --tail 100 | grep -i "migrat\|error\|fatal"

# Pastikan tidak ada error migration
# Output normal:
# ✅ Database migrated
# ✅ Default categories ready
```

**Railway PostgreSQL — cek tabel:**
```bash
railway connect postgresql
```
```sql
-- Lihat semua tabel
\dt

-- Cek kolom tabel tertentu
\d users
\d transactions
\d user_subscriptions
```

**Supabase — cek di dashboard:**
```
Database → Table Editor → pilih tabel yang berubah
```

---

## 5. Deploy Update (Rutin)

### Persiapan Sebelum Deploy

```bash
# 1. Pastikan branch main up-to-date
git checkout main
git pull origin main

# 2. Jalankan test (jika ada)
cd apps/api-go && go build ./... && go test ./...

# 3. Check tipe perubahan DB (lihat entity files)
git diff HEAD~1 -- apps/api-go/internal/domain/entity/
```

Tentukan kategori perubahan:
- Tidak ada perubahan entity → **Deploy langsung**
- Ada tambah kolom/tabel dengan default → **Deploy langsung**
- Ada kolom NOT NULL baru → **Ikuti [Multi-Step](#multi-step-untuk-kolom-not-null)**
- Ada rename/drop → **Ikuti [Breaking Change](#breaking-change)**

---

### Deploy API (Railway)

Railway auto-deploy saat push ke `main` jika **Auto Deploy** diaktifkan:

```bash
git push origin main
```

Atau trigger manual:
```bash
railway up --detach
```

**Monitor progress:**
```bash
# Tail logs real-time
railway logs

# Cek status deployment
railway status
```

**Verifikasi sukses:**
```bash
curl https://YOUR_API.railway.app/api/health
# Expected: {"status":"ok","version":"1.0.0","environment":"production"}
```

---

### Timeline Deploy Railway

```
git push origin main
      │
      ▼ (Railway detects push ~5s)
[Build]  Docker build dari apps/api-go/Dockerfile
         golang:1.22-alpine build → binary ~15-30s
      │
      ▼
[Start]  Container baru start
         → godotenv.Load()
         → config.Load()
         → database.Connect()
         → database.AutoMigrate()   ← MIGRATION TERJADI DI SINI
         → SeedDefaultCategories()
         → ... semua repository, usecase, handler
         → background workers start
         → r.Run(":4000")
      │
      ▼ (~30-45s setelah start)
[Health] GET /api/health → 200 OK ✅
      │
      ▼
[Switch] Traffic dialihkan ke container baru
[Stop]   Container lama di-stop

Total waktu: ~2-3 menit dari git push
```

---

## 6. Deploy Frontend (Vercel)

### Setup Pertama

1. Push repo ke GitHub
2. Buka https://vercel.com/new → Import repo
3. Konfigurasi:

```
Framework Preset : Other
Root Directory   : apps/web
Build Command    : (auto-detect dari vercel.json)
Output Directory : dist
```

4. **Environment Variables** (wajib):

| Key | Value |
|-----|-------|
| `EXPO_PUBLIC_API_URL` | `https://YOUR_API.railway.app/api` |

> ⚠️ `EXPO_PUBLIC_API_URL` di-bake ke bundle JS saat build.
> Jika URL API berubah, **wajib rebuild** frontend.

5. Klik **Deploy**

---

### Update Frontend (Rutin)

Vercel otomatis deploy saat push ke `main`:

```bash
git push origin main
# Vercel dan Railway keduanya trigger deploy bersamaan
```

**Jika hanya frontend yang berubah** — tidak ada downtime, Vercel atomic deploy.

**Jika API URL berubah:**
1. Update `EXPO_PUBLIC_API_URL` di Vercel Dashboard → Settings → Environment Variables
2. Trigger redeploy: Deployments → klik deployment terbaru → **Redeploy**

---

### Build Time Variable

`EXPO_PUBLIC_API_URL` adalah **build-time variable**, bukan runtime:

```typescript
// Di kode frontend:
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api'
// Nilai ini di-replace saat `expo export` — BUKAN saat runtime browser
```

**Implikasi:** Jika Railway API URL berubah, harus redeploy frontend.

---

## 7. Verifikasi Post-Deploy

### Checklist Setelah Deploy

```bash
# ── API Health ──────────────────────────────────────────────
curl https://YOUR_API.railway.app/api/health
# ✅ {"status":"ok","version":"1.0.0"}

# ── Database (cek AutoMigrate sukses) ───────────────────────
railway logs | grep -E "✅|❌|migrat|fatal"
# ✅ Database connected
# ✅ Database migrated
# ✅ Default categories ready

# ── Auth endpoint ────────────────────────────────────────────
curl -X POST https://YOUR_API.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrongpass"}'
# ✅ {"message":"invalid email or password","statusCode":401}
# (bukan 500 = DB connection ok)

# ── Frontend ─────────────────────────────────────────────────
curl https://YOUR_APP.vercel.app
# ✅ HTML response (bukan error)
```

### Verifikasi Database Migration

```bash
# Railway PostgreSQL
railway connect postgresql

# Supabase: buka SQL Editor di dashboard
```

```sql
-- Cek semua tabel ada
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected tables (17 tabel):
-- accounts, bank_parser_rules, budgets, categories, category_rules,
-- email_integrations, email_messages, payment_orders, refresh_tokens,
-- subscriptions, system_settings, transaction_audit_logs, transactions,
-- user_subscriptions, users, workspace_activity_logs, workspace_invites,
-- workspace_members, workspaces

-- Cek tidak ada error di data kategori default
SELECT COUNT(*) FROM categories WHERE is_default = true;
-- ✅ Expected: 21 (5 income + 12 expense + 4 transfer)
```

---

## 8. Rollback

### Rollback API (Railway)

Railway menyimpan history deployment. Rollback ke versi sebelumnya:

**Via Dashboard:**
```
Railway Dashboard → project → service API
→ Deployments tab
→ Klik deployment sebelumnya
→ "Rollback to this deployment"
```

**Via CLI:**
```bash
# Lihat deployment history
railway deployments

# Rollback ke deployment tertentu
railway rollback <DEPLOYMENT_ID>
```

**Estimasi waktu rollback:** ~2-3 menit (sama dengan deploy normal)

---

### Rollback Database

> ⚠️ **GORM AutoMigrate tidak bisa di-rollback otomatis.**
> Kolom/tabel yang sudah ditambahkan tetap ada setelah rollback kode.

**Ini biasanya AMAN** karena:
- Kode lama mengabaikan kolom yang tidak dikenalnya
- GORM hanya SELECT kolom yang ada di struct

**Jika benar-benar perlu rollback schema** (kasus ekstrem):

```sql
-- Hapus kolom yang baru ditambahkan
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS new_column;

-- Hapus tabel yang baru dibuat
DROP TABLE IF EXISTS payment_orders;
DROP TABLE IF EXISTS user_subscriptions;
```

**Kapan perlu rollback schema:**
- Hanya jika kolom baru menyebabkan constraint violation di kode lama
- Biasanya tidak perlu — kode lama tidak tahu kolom baru

---

### Rollback Frontend (Vercel)

```
Vercel Dashboard → project → Deployments
→ Klik deployment yang stabil
→ "..." menu → "Promote to Production"
```

Instant — tidak ada build ulang.

---

## 9. Troubleshooting

### API tidak start / crash loop

```bash
railway logs --tail 200
```

**Error: `required environment variable not set: DATABASE_URL`**
→ Set `DATABASE_URL` di Railway Dashboard → Service → Variables

**Error: `failed to connect to database`**
→ Cek DATABASE_URL valid, cek Railway PostgreSQL plugin sudah running
→ Supabase: pastikan project tidak dalam status "paused"

**Error: `Auto-migration failed`**
→ Lihat error detail di log
→ Kemungkinan: kolom NOT NULL baru tanpa default, tipe data konflik
→ Jalankan SQL manual untuk fix sebelum deploy ulang

---

### Frontend tidak bisa akses API (CORS error)

Pastikan `APP_URL` di Railway Variables sudah di-set ke Vercel URL:
```
APP_URL = https://YOUR_APP.vercel.app
```

Cek CORS middleware:
```go
// apps/api-go/internal/delivery/http/middleware/cors_middleware.go
// Allow origin = cfg.AppURL
```

---

### Supabase auto-pause

Supabase free tier pause project setelah 7 hari tidak aktif.

**Gejala:** `connection refused` atau timeout ke database

**Solusi cepat:**
1. Buka Supabase Dashboard → project → klik **Restore**
2. Tunggu ~30 detik

**Solusi permanen (gratis):**
Setup UptimeRobot (https://uptimerobot.com) → monitor `https://YOUR_API.railway.app/api/health` setiap 24 jam.
Ini cukup untuk menjaga Supabase tetap aktif.

---

### Railway service sleep (Hobby plan)

Railway Hobby plan tidak sleep. Jika container stop tidak terduga:

```bash
# Cek status
railway status

# Restart manual
railway up --detach
```

---

### Background workers tidak jalan (Gmail/IMAP)

Worker berjalan sebagai goroutine dalam API container. Cek log:

```bash
railway logs | grep -i "gmail\|imap\|worker"
# ✅ [GmailWorker] started N new Gmail integration(s)
# ✅ [IMAPWorker] polling...
```

Jika tidak ada log worker → kemungkinan container crash saat startup, cek error di atas.

---

## Ringkasan Perintah Penting

```bash
# Deploy API
git push origin main

# Monitor logs
railway logs

# Health check
curl https://YOUR_API.railway.app/api/health

# Connect ke database
railway connect postgresql          # Railway DB
# Supabase: gunakan SQL Editor di dashboard

# Rollback
railway rollback <DEPLOYMENT_ID>

# Force redeploy
railway up --detach
```

---

*SOP ini berlaku untuk deployment production Saku (FinTracker).*
*Update dokumen ini setiap ada perubahan arsitektur significant.*
