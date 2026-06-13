# Deploy Saku — Quick Start (~25 menit)

> First-time deployment guide. Untuk detail lengkap lihat [SOP.md](./SOP.md).

---

## Step 1 — Buat Akun (jika belum punya)

| Platform | Link | Waktu |
|---|---|---|
| GitHub | https://github.com/signup | 2 menit |
| Railway | https://railway.app (login with GitHub) | 1 menit |
| Vercel | https://vercel.com (login with GitHub) | 1 menit |

---

## Step 2 — Push Code ke GitHub

```bash
git add .
git commit -m "chore: add deployment config"
git push origin main
```

Jika belum ada remote:
```bash
# Buat repo baru di github.com/new (set Private), lalu:
git remote add origin https://github.com/USERNAME/fintracker.git
git push -u origin main
```

---

## Step 3 — Pilih Skenario Database

**Rekomendasi: Skenario 2 (Supabase)** — database gratis selamanya.

| | Skenario 1 | Skenario 2 ⭐ Rekomendasi |
|---|---|---|
| Database | Railway PostgreSQL | Supabase (free) |
| Estimasi biaya | ~$5–7/bln | ~$0–3/bln |
| Script | `deploy/1-railway-db.sh` | `deploy/2-supabase-db.sh` |

---

## Step 4 — Setup Supabase (Skenario 2)

1. Buka https://supabase.com → **New Project**
2. Region: **Southeast Asia (Singapore)**
3. Set password database yang kuat → **Create project**
4. Tunggu ~2 menit hingga project ready

**Aktifkan pgvector:**
- Database → Extensions → cari **"vector"** → Enable

**Ambil connection string:**
- Settings → Database → Connection String → **URI** → Copy

```
Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

---

## Step 5 — Jalankan Deploy Script

Buka terminal (Git Bash / WSL di Windows):

```bash
cd /path/to/FinTracker

# Skenario 2 (Supabase):
bash deploy/2-supabase-db.sh

# Skenario 1 (Railway DB):
bash deploy/1-railway-db.sh
```

Script otomatis: login Railway → buat project → tambah Redis → generate JWT secrets → set env vars.

Jawab pertanyaan script:
- Masukkan Supabase DATABASE_URL (dari Step 4)
- Deploy sekarang? → ketik `y`

---

## Step 6 — Konfigurasi Railway Dashboard (wajib)

Buka https://railway.app/dashboard → project **saku-fintracker** → klik service API:

```
Settings → Source:
  Root Directory   =  apps/api-go

Settings → Build:
  Dockerfile Path  =  Dockerfile

Settings → Variables → tambahkan 2 variabel:
  REDIS_URL        =  ${{Redis.REDIS_URL}}
  REDIS_PASSWORD   =  ${{Redis.REDIS_PASSWORD}}
```

Klik **Deploy** → tunggu ~3 menit.

---

## Step 7 — Dapatkan Railway API URL

```bash
railway domain
# Output: https://saku-fintracker-xxxx.railway.app
```

Test:
```bash
curl https://YOUR-URL.railway.app/api/health
# ✅ {"status":"ok"}
```

---

## Step 8 — Deploy Frontend ke Vercel

1. Buka https://vercel.com/new → **Import** repo GitHub
2. Isi konfigurasi:

```
Root Directory    :  apps/web
Framework Preset  :  Other
Build Command     :  (auto dari vercel.json — biarkan kosong)
Output Directory  :  dist
```

3. **Environment Variables** (wajib sebelum deploy):

```
Key   : EXPO_PUBLIC_API_URL
Value : https://YOUR-URL.railway.app/api
```

4. Klik **Deploy** → tunggu ~2 menit.

---

## Step 9 — Verifikasi

```bash
# API health
curl https://YOUR-API.railway.app/api/health
# ✅ {"status":"ok"}

# Cek migration DB di log Railway
railway logs | grep -E "✅|❌"
# ✅ Database connected
# ✅ Database migrated
# ✅ Default categories ready
```

Buka https://YOUR-APP.vercel.app → coba **Register** akun baru.

---

## Ringkasan Estimasi Waktu

| Step | Estimasi |
|---|---|
| Buat akun (1) | 5 menit |
| Push ke GitHub (2) | 2 menit |
| Setup Supabase (4) | 5 menit |
| Jalankan script (5) | 5 menit |
| Konfigurasi Railway (6) | 3 menit |
| Deploy Railway otomatis | 3 menit |
| Setup Vercel (8) | 3 menit |
| **Total** | **~25 menit** |

---

## Environment Variables Opsional (setelah deploy berjalan)

Tambahkan di Railway Dashboard → Service → Variables:

```bash
# Login Google + Gmail integration
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_CALLBACK_URL=https://YOUR-API.railway.app/api/auth/google/callback
GOOGLE_GMAIL_CALLBACK_URL=https://YOUR-API.railway.app/api/email-integrations/gmail/callback

# AI merchant categorization
OPENROUTER_API_KEY=sk-or-v1-xxx

# Email SMTP (tanpa ini, email di-log ke stdout Railway)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx

# Frontend URL (untuk CORS dan redirect OAuth)
APP_URL=https://YOUR-APP.vercel.app
```

---

## Troubleshooting Cepat

| Masalah | Solusi |
|---|---|
| API tidak start | Cek `railway logs` — kemungkinan env var missing |
| CORS error di frontend | Set `APP_URL` di Railway Variables ke URL Vercel |
| Supabase connection refused | Project paused → buka Supabase dashboard → Restore |
| Frontend error API | Cek `EXPO_PUBLIC_API_URL` di Vercel → Redeploy |

Untuk detail lengkap: [SOP.md](./SOP.md)
