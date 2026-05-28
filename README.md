# FinTrackr — Self-Hosted Financial Tracker

Aplikasi manajemen keuangan personal dengan arsitektur full-stack self-hosted:
- **Frontend**: Expo (React Native Web) → nginx static
- **Backend**: Go + Gin + GORM (Clean Architecture)
- **Database**: PostgreSQL 16 + pgvector
- **Proxy**: Caddy (HTTP untuk local dev, auto-HTTPS untuk production)
- **Monitoring**: Grafana, Prometheus, Loki, Uptime Kuma

---

## 🚀 Cara Menjalankan (Local Development)

### Prasyarat
- Docker Desktop for Windows
- Git

### Langkah

```powershell
# 1. Buka folder project
cd D:\Project\FinTracker

# 2. Jalankan semua service
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 3. Cek status service
docker compose ps
```

Tunggu semua service status `healthy` (sekitar 1-2 menit pertama kali).

---

## 🌐 Akses Aplikasi

| Service | URL | Keterangan |
|---------|-----|-----------|
| **Web App** | http://localhost | Frontend utama FinTrackr |
| **API** | http://localhost/api | REST API via Caddy |
| **API Direct** | http://localhost:4000/api | REST API langsung (dev) |
| **MinIO Console** | http://localhost:9001 | Object storage admin |
| **Prometheus** | http://localhost:9090 | Metrics |
| **Grafana** | http://localhost:3100 | Dashboard monitoring |
| **Uptime Kuma** | http://localhost:3001 | Status page |
| **GlitchTip** | http://localhost:8000 | Error tracking |

---

## 👤 Akun Demo (Siap Pakai)

| Field | Value |
|-------|-------|
| **Email** | `renaldybaskara6@gmail.com` |
| **Password** | `Admin1234!` |

> 💡 **Daftar akun baru**: Kunjungi http://localhost/register

---

## 🔐 Kredensial Layanan Internal

### PostgreSQL
- **Host**: `localhost:5432`
- **User**: `fintrackr`
- **Password**: lihat `.env` → `POSTGRES_PASSWORD`
- **Database**: `fintrackr`

### MinIO (Object Storage)
- **URL**: http://localhost:9001
- **User**: `minioadmin`
- **Password**: lihat `.env` → `MINIO_SECRET_KEY`

### Grafana
- **URL**: http://localhost:3100
- **User**: `admin`
- **Password**: `admin123`

### Redis
- **Host**: `localhost:6379`
- **Password**: lihat `.env` → `REDIS_PASSWORD`

---

## 📦 Struktur Project

```
FinTracker/
├── apps/
│   ├── api-go/                    # Go backend (Gin + GORM + Clean Architecture)
│   │   ├── cmd/server/main.go     # Entrypoint — wiring semua dependencies
│   │   └── internal/
│   │       ├── domain/
│   │       │   ├── entity/        # Struct GORM (15 tabel)
│   │       │   ├── repository/    # Interface repository (port)
│   │       │   └── usecase/       # Interface use case (port)
│   │       ├── repository/        # GORM implementation
│   │       ├── usecase/           # Business logic
│   │       │   └── email_import_service.go  # Konversi email → transaksi
│   │       ├── delivery/
│   │       │   └── http/
│   │       │       ├── handler/   # Gin handlers
│   │       │       ├── middleware/ # JWT auth, CORS
│   │       │       └── router.go  # Semua route terdaftar di sini
│   │       └── infrastructure/
│   │           ├── config/        # Config loader (.env)
│   │           ├── database/      # Connect + AutoMigrate + Seed
│   │           ├── email/         # SMTP service (dynamic, DB-backed)
│   │           ├── emailparser/   # Parser email bank/ewallet Indonesia
│   │           └── worker/        # Background workers (IMAP + Gmail)
│   └── web/                       # Expo (React Native Web) frontend
├── infra/
│   ├── caddy/                     # Caddyfile (reverse proxy)
│   ├── grafana/                   # Dashboard provisioning
│   ├── loki/                      # Log aggregation config
│   ├── postgres/                  # DB init SQL
│   └── prometheus/                # Metrics scraping config
├── docker-compose.yml             # Base compose (semua services)
├── docker-compose.dev.yml         # Dev overrides (expose ports ke host)
└── .env                           # Environment variables & secrets
```

---

## 🔄 Perintah Berguna

```powershell
# ▶️ Start semua service
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# ⏹️ Stop semua service
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# 📋 Lihat status semua container
docker compose ps

# 📝 Lihat logs API (live)
docker logs fintrackr-api-1 -f

# 📝 Lihat logs semua service (live)
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

# 🔨 Rebuild & restart API (setelah perubahan Go code)
docker compose -f docker-compose.yml -f docker-compose.dev.yml build api
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate api

# 🔨 Rebuild & restart Web (setelah perubahan frontend)
docker compose -f docker-compose.yml -f docker-compose.dev.yml build web
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate web

# 🗄️ Masuk ke PostgreSQL shell
docker exec -it fintrackr-postgres-1 psql -U fintrackr -d fintrackr

# 🗑️ Reset semua data (HATI-HATI: hapus seluruh database!)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

---

## 🛠️ Fitur Aplikasi

### 📊 Dashboard
- Ringkasan pendapatan, pengeluaran, dan saldo bersih bulan ini
- **Perbandingan periode sebelumnya** — angka % naik/turun income, expense, net otomatis dihitung
- Breakdown pengeluaran per kategori (pie chart)
- Tren 6 bulan terakhir (bar chart)
- 5 transaksi terbaru

### 💸 Transaksi
- Tambah transaksi **income / expense / transfer**
- Filter berdasarkan tanggal, kategori, tipe, akun
- Pencarian berdasarkan deskripsi/merchant
- `source` field: `manual` | `email` | `import` — tanda dari mana transaksi berasal
- `idempotency_key` — mencegah double-entry jika dikirim dua kali

### 🏦 Akun
- Kelola multiple rekening: **bank · e-wallet · cash · credit card · investasi**
- Track saldo per akun
- `bank_code` digunakan untuk auto-matching email notifikasi bank

### 🏷️ Kategori
- 21 kategori default (income, expense, transfer) — auto-seed saat startup
- Icon dan warna per kategori

### 📉 Budget
- Buat budget bulanan/mingguan/tahunan per kategori
- Monitor progress pengeluaran vs budget
- Status: **ok** → **warning** (80%) → **over** (100%) → **critical** (120%)

---

## 🔐 Autentikasi & Keamanan

### Alur Register & Verifikasi Email

```
User daftar
    │
    ▼
POST /api/auth/register
    │  • Simpan user ke DB (is_email_verified = false)
    │  • Generate token 64-hex (crypto/rand)
    │  • Kirim email verifikasi (via SMTP atau log ke Docker)
    ▼
User klik link di email
    │
    ▼
POST /api/auth/verify-email { token }
    │  • Cari user by email_verification_token
    │  • Set is_email_verified = true
    │  • Hapus token dari DB
    ▼
Akun terverifikasi ✅
```

### Alur Reset Password

```
POST /api/auth/forgot-password { email }
    │  • Selalu return success (tidak bocorkan apakah email terdaftar)
    │  • Generate token 64-hex + waktu expired (1 jam)
    │  • Kirim email link reset
    ▼
POST /api/auth/reset-password { token, newPassword }
    │  • Cari user by token + cek expiry (password_reset_expires > NOW())
    │  • Bcrypt hash password baru
    │  • Hapus token dari DB
    ▼
Password baru aktif ✅
```

### JWT + Refresh Token Rotation

```
Login → Access Token (15 menit) + Refresh Token (7 hari)
    │
    ▼ Access token expired
POST /api/auth/refresh { refreshToken }
    │  • Verifikasi tanda tangan + cek di DB
    │  • Revoke token lama
    │  • Buat token baru (access + refresh)
    ▼
Token baru diberikan (rotation) ✅
```

| Endpoint | Keterangan |
|----------|-----------|
| `POST /api/auth/register` | Daftar + kirim verifikasi email |
| `POST /api/auth/login` | Login email/password |
| `POST /api/auth/refresh` | Refresh access token (rotation) |
| `GET /api/auth/google` | Mulai Google OAuth |
| `GET /api/auth/google/callback` | Callback Google OAuth |
| `POST /api/auth/verify-email` | Verifikasi email via token |
| `POST /api/auth/send-verification` | Kirim ulang email verifikasi |
| `POST /api/auth/forgot-password` | Request reset password |
| `POST /api/auth/reset-password` | Atur password baru |
| `POST /api/auth/change-password` | Ganti password (harus tahu password lama) |
| `GET /api/auth/me` | Info akun saya |
| `POST /api/auth/logout` | Logout (revoke refresh token) |

---

## 🏢 Workspace (Multi-User / Keluarga / Bisnis)

Workspace memungkinkan beberapa user berbagi data keuangan bersama.

### Tier Workspace
| Tier | Keterangan |
|------|-----------|
| `personal` | Hanya untuk diri sendiri |
| `family` | Keuangan keluarga bersama |
| `business` | Keuangan usaha/bisnis |

### Role Hierarki
```
owner (4) > admin (3) > contributor (2) > viewer (1)
```
- **owner** — bisa hapus workspace, ubah semua member, tidak bisa meninggalkan workspace
- **admin** — undang member, ubah role (maksimal setara dengan dirinya sendiri)
- **contributor** — tambah/edit transaksi
- **viewer** — hanya bisa melihat

### Alur Undangan Member

Email yang diundang **tidak harus terdaftar dulu** di FinTrackr. Sistem menyimpan undangan, dan saat orang tersebut register, otomatis langsung bergabung.

```
Skenario A — Email sudah terdaftar:

Admin/Owner → POST /api/workspaces/:id/invites { email, role }
    │  • Generate token undangan (24 jam expired)
    │  • Kirim email undangan
    ▼
User menerima email → klik link → sudah login → redirect ke frontend
    │
    ▼
POST /api/workspaces/invites/accept { token }
    │  • Verifikasi token + cek expiry
    │  • Buat WorkspaceMember record
    │  • Catat di activity log
    ▼
User bergabung ke workspace ✅


Skenario B — Email BELUM terdaftar (baru):

Admin undang "budi@gmail.com" (belum punya akun)
    │  • Undangan tersimpan di DB (status = pending)
    │  • Email dikirim dengan link registrasi + info workspace
    ▼
Budi register dengan email "budi@gmail.com"
    │
    ▼
Sistem Register otomatis:
    │  • Cek: SELECT * FROM workspace_invites
    │          WHERE email = 'budi@gmail.com'
    │          AND status = 'pending'
    │          AND expires_at > NOW()
    │  • Ada 1 undangan ditemukan!
    │  • Buat WorkspaceMember record
    │  • Update invite status = 'accepted'
    │  • Log activity 'member_joined'
    ▼
Budi langsung masuk workspace begitu selesai register ✅
(Tanpa perlu klik accept lagi)
```

### Activity Log
Setiap aksi penting otomatis dicatat: undang member, terima undangan, ubah role, tambah transaksi (dalam konteks workspace), dsb.

| Endpoint | Keterangan |
|----------|-----------|
| `GET /api/workspaces` | List semua workspace saya |
| `POST /api/workspaces` | Buat workspace baru |
| `GET /api/workspaces/:id` | Detail workspace |
| `PATCH /api/workspaces/:id` | Update nama/deskripsi/currency |
| `DELETE /api/workspaces/:id` | Hapus workspace (owner only) |
| `GET /api/workspaces/:id/members` | Daftar anggota |
| `PATCH /api/workspaces/:id/members/:userId` | Ubah role anggota |
| `DELETE /api/workspaces/:id/members/:userId` | Keluarkan anggota |
| `DELETE /api/workspaces/:id/leave` | Keluar dari workspace |
| `POST /api/workspaces/:id/invites` | Undang via email |
| `GET /api/workspaces/:id/invites` | List undangan aktif |
| `DELETE /api/workspaces/:id/invites/:inviteId` | Batalkan undangan |
| `POST /api/workspaces/invites/accept` | Terima undangan (via token) |
| `POST /api/workspaces/invites/decline` | Tolak undangan |
| `GET /api/workspaces/:id/activity` | Activity log |

---

## 📧 Email Integration & Auto-Import Transaksi

Fitur unggulan FinTrackr: **email notifikasi bank/e-wallet otomatis diubah menjadi transaksi**, tanpa perlu input manual.

### Bank & E-Wallet yang Didukung

Ada **2 jenis parser** — hardcoded (built-in) dan DB rules (bisa ditambah dari UI):

#### Built-in (Hardcoded — selalu aktif)

| Lembaga | Domain Pengirim | Tipe Notifikasi |
|---------|----------------|----------------|
| **BCA** | @klikbca.com / @bca.co.id | Debit, Kredit, Transfer |
| **Bank Mandiri** | @bankmandiri.co.id | Debit, Kredit |
| **BRI** | @bri.co.id | Debit, Kredit, Transfer |
| **BNI** | @bni.co.id | Debit, Kredit |
| **GoPay** | @gojek.com / @gopay.co.id | Bayar, Terima, Top-up |
| **OVO** | @ovo.id | Bayar, Terima, Cashback |
| **DANA** | @dana.id | Bayar, Terima |
| **ShopeePay** | @shopee.co.id | Pembayaran, Transfer |
| **Jenius** | @jenius.com / @btpn.com | Bayar, Kirim |
| **Livin' by Mandiri** | livin (via Mandiri) | Semua transaksi |
| **BSI Mobile** | @bankbsi.co.id | Debit, Kredit |
| **CIMB Niaga** | @cimbniaga.co.id | Debit, Kredit |
| **Bank Permata** | @permatabank.com | Debit, Kredit |
| **Flip** | @flip.id | Transfer |
| **LinkAja** | @linkaja.id | Bayar, Terima |
| **Bank Danamon** | @danamon.co.id | Debit, Kredit |
| **Bank BTN** | @btn.co.id | Debit, Kredit |
| **Generic** | *(catch-all)* | Deteksi otomatis pola Rp dari .co.id |

#### DB Rules (Bisa Ditambah dari UI — berlaku Global)

Selain parser built-in, admin bisa menambah bank/ewallet baru **langsung dari Settings** tanpa perlu edit kode atau rebuild Docker:

```
Settings → Parser Rules → Tambah Rule Baru
```

Field yang perlu diisi:

| Field | Contoh | Keterangan |
|-------|--------|-----------|
| **Nama** | `Bank XYZ` | Nama tampil di transaksi |
| **From Patterns** | `@bankxyz.co.id,noreply@xyz` | Domain pengirim (pisah koma) |
| **Subject Patterns** | `transaksi xyz,notifikasi xyz` | Keyword di subject email |
| **Expense Keywords** | `debet,pembayaran,keluar` | Kata penanda pengeluaran |
| **Income Keywords** | `kredit,masuk,diterima` | Kata penanda pemasukan |
| **Body Confirm Keywords** | `bank xyz,pt xyz` | Keyword body opsional (konfirmasi) |
| **Amount Regex** | *(kosong = pakai default Rp)* | Regex custom jika format beda |
| **Priority** | `0` | Lebih kecil = dicek lebih dulu |

**DB rules dievaluasi SEBELUM built-in rules** — bisa digunakan untuk override/perbaiki parser yang ada.

> Format angka Indonesia didukung penuh: `1.500.000,50` → `1500000.50`

### Cara Menghubungkan Email

#### Opsi 1 — Gmail (OAuth2, Direkomendasikan)

```
1. Settings → Email Integration → Tambah Gmail
2. Klik tombol → diarahkan ke Google login
3. Izinkan akses "read-only Gmail"
4. Callback otomatis menyimpan token OAuth ke database
5. Worker mulai polling inbox tiap 5 menit
```

> OAuth token disimpan terenkripsi di DB, **tidak pernah tampil di response API**.

#### Opsi 2 — IMAP (Outlook, Yahoo, Mail lainnya)

```
POST /api/email-integrations/imap
Body:
{
  "email": "kamu@outlook.com",
  "imapHost": "outlook.office365.com",
  "imapPort": 993,
  "imapUser": "kamu@outlook.com",
  "imapPassword": "app-password-kamu"
}
```

Sistem akan **test koneksi TCP** dulu sebelum menyimpan — jika IMAP server tidak bisa dihubungi, request ditolak dengan error yang jelas.

**Pengaturan IMAP umum:**
| Provider | Host | Port | SSL |
|----------|------|------|-----|
| Gmail | `imap.gmail.com` | `993` | ✅ TLS |
| Outlook/Hotmail | `outlook.office365.com` | `993` | ✅ TLS |
| Yahoo | `imap.mail.yahoo.com` | `993` | ✅ TLS |

---

### 🔄 Alur Lengkap Email Auto-Import

Berikut adalah perjalanan sebuah email notifikasi bank dari inbox hingga menjadi transaksi di FinTrackr:

```
┌─────────────────────────────────────────────────────────────────┐
│  SERVER STARTUP                                                  │
│                                                                  │
│  main.go membaca semua active email integrations dari DB         │
│  → Spawn 1 goroutine per integrasi IMAP                         │
│  → Spawn 1 goroutine per integrasi Gmail                        │
└─────────────────┬───────────────────────────────────────────────┘
                  │ setiap 5 menit
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  POLLING (IMAP Worker / Gmail Worker)                            │
│                                                                  │
│  IMAP:                                                          │
│    • Dial IMAP server (TLS port 993, atau STARTTLS port 143)    │
│    • Login dengan kredensial tersimpan                           │
│    • SELECT INBOX                                               │
│    • SEARCH UNSEEN SINCE <last_sync_at>                         │
│    • FETCH envelope + body (max 50 email per siklus)            │
│                                                                  │
│  Gmail:                                                         │
│    • Build OAuth2 client dari access_token + refresh_token       │
│    • Call Gmail API: messages.list?q=after:<epoch> is:unread    │
│    • Fetch full message per ID (format=full)                    │
│    • Decode base64 body parts (text/plain + text/html)          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  DEDUPLICATION                                                   │
│                                                                  │
│  Cek message_id yang sudah ada di DB (FindMessageIDsSince)      │
│  → Email yang sudah pernah diproses dilewati                    │
│  → Sisanya di-INSERT dengan ON CONFLICT DO NOTHING              │
│     (proteksi ganda jika ada race condition)                    │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  STORE: email_messages (parse_status = "pending")               │
│                                                                  │
│  Setiap email disimpan dengan:                                  │
│  • message_id  — ID unik dari IMAP UID atau Gmail message ID    │
│  • from        — alamat pengirim                                │
│  • subject     — subjek email                                   │
│  • body_text   — plain text body                                │
│  • body_html   — HTML body (fallback)                           │
│  • received_at — waktu email diterima                           │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  EMAIL PARSER (emailparser.Parse)                                │
│                                                                  │
│  Coba setiap parser secara berurutan:                           │
│  1. Cek Matches(from, subject, body) — apakah email ini dari   │
│     bank/ewallet yang dikenal?                                  │
│     • Cek domain pengirim: "bca.co.id", "gopay.co.id", dsb     │
│     • Cek keyword di subject: "transaksi", "debit", "notif"    │
│  2. Parser pertama yang cocok → jalankan Parse()               │
│     • Ekstrak amount dengan regex (format Indonesia: 1.500.000) │
│     • Ekstrak merchant/toko dari body                           │
│     • Ekstrak nomor rekening (last 4 digit biasanya)           │
│     • Tentukan type: income | expense | transfer                │
│     • Ekstrak tanggal transaksi                                 │
│  3. Jika tidak ada yang cocok → status = "skipped"             │
└─────────────────┬───────────────────────────────────────────────┘
                  │ ParseResult.Matched = true
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  ACCOUNT MATCHING                                                │
│                                                                  │
│  Cari akun user yang paling cocok (prioritas):                 │
│  1. Exact match nomor rekening (last 4 digit)                  │
│     "xxxx-1234" cocok dengan account.account_number "1234"     │
│  2. Bank code match                                             │
│     parsed.Bank = "BCA" cocok dengan account.bank_code = "BCA" │
│  3. Akun default user (is_default = true)                      │
│  4. Tidak ada → account_id = NULL (bisa di-assign manual)      │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  AUTO-KATEGORISASI                                               │
│                                                                  │
│  Hanya untuk transaksi expense:                                 │
│  • Cocokkan merchant/description dengan nama kategori           │
│  • Contoh: "Indomaret" → kategori "Belanja"                    │
│  • Jika tidak cocok → category_id = NULL (isi manual nanti)    │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  CREATE TRANSACTION                                              │
│                                                                  │
│  INSERT INTO transactions:                                      │
│  • type         — income | expense | transfer                   │
│  • amount       — nilai transaksi                               │
│  • date         — dari parser, fallback ke received_at          │
│  • account_id   — hasil account matching                        │
│  • category_id  — hasil auto-kategorisasi                      │
│  • source       = "email"  ← tanda otomatis dari email         │
│  • external_id  = message_id (untuk referensi)                 │
│  • idempotency_key = "email:{userID}:{messageID}"              │
│    → Unique constraint → double import IMPOSSIBLE               │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  UPDATE email_messages                                           │
│                                                                  │
│  parse_status   = "imported"                                    │
│  transaction_id = UUID transaksi yang baru dibuat              │
│  imported_at    = NOW()                                         │
│  parsed_bank    = "BCA"                                         │
│  parsed_type    = "expense"                                     │
│  parsed_amount  = 150000                                        │
│  parsed_merchant = "Indomaret Cipete"                          │
└─────────────────────────────────────────────────────────────────┘

Status akhir email_message:
  "pending"  → belum diproses
  "imported" → berhasil jadi transaksi ✅
  "skipped"  → tidak cocok parser manapun (skip_reason tersimpan)
  "failed"   → parser cocok tapi error saat parse/insert
```

### 🔁 Manual Sync & Reprocess

**Sync manual** — picu polling langsung tanpa menunggu 5 menit:
```
POST /api/email-integrations/:id/sync
```

**Reprocess** — coba ulang email yang gagal/skip:
```
POST /api/email-messages/:id/reprocess
```
Berguna jika: parser diperbarui, atau akun bank baru ditambahkan (sehingga account matching bisa berhasil).

### Endpoint Email Messages

| Endpoint | Keterangan |
|----------|-----------|
| `GET /api/email-messages` | List semua email yang diproses |
| `GET /api/email-messages?status=failed` | Filter by status |
| `GET /api/email-messages?integrationId=uuid` | Filter by integrasi |
| `GET /api/email-messages/:id` | Detail satu email |
| `POST /api/email-messages/:id/reprocess` | Coba ulang parse + import |
| `DELETE /api/email-messages/:id` | Hapus record (transaksi tidak ikut terhapus) |

### Endpoint Email Integration

| Endpoint | Keterangan |
|----------|-----------|
| `GET /api/email-integrations` | List semua integrasi |
| `POST /api/email-integrations/imap` | Hubungkan via IMAP |
| `GET /api/email-integrations/gmail/auth` | Mulai OAuth Gmail |
| `GET /api/email-integrations/gmail/callback` | Callback OAuth Gmail |
| `DELETE /api/email-integrations/:id` | Putuskan integrasi |
| `PATCH /api/email-integrations/:id/toggle` | Aktif / nonaktif |
| `POST /api/email-integrations/:id/sync` | Paksa sync sekarang |

---

## ⚙️ Pengaturan Sistem (dari UI — tanpa edit .env!)

Semua konfigurasi SMTP bisa diubah langsung dari halaman **Settings** di frontend tanpa perlu restart server.

### Bagaimana Dynamic SMTP Bekerja

```
Request kirim email masuk
    │
    ▼
DynamicSMTPService.resolve()
    │
    ├─ Baca system_settings dari DB
    │   smtp.host, smtp.port, smtp.user, smtp.pass, smtp.from, smtp.enabled
    │
    ├─ Fallback ke environment variable jika key tidak ada di DB
    │   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
    │
    └─ Jika enabled = false atau semua kosong → cetak ke log (dev mode)
         "📧 [DEV] Email to: xxx Subject: yyy"
```

Konfigurasi SMTP disimpan di tabel `system_settings` (key-value store) dengan UPSERT — aman dijalankan berulang kali.

### Langkah Setup Gmail SMTP dari UI:

1. Buka http://localhost → login
2. Tab **Pengaturan** → **Konfigurasi Email (SMTP)**
3. Isi form:
   - **Host**: `smtp.gmail.com`
   - **Port**: `587`
   - **Email / Username**: email Gmail kamu
   - **Password**: Gmail **App Password** (bukan password biasa!)
   - **Nama Pengirim**: `FinTrackr`
4. Klik **Simpan Pengaturan**
5. Test dengan klik **Tes Kirim Email**

**Cara buat Gmail App Password:**
1. https://myaccount.google.com → Security → 2-Step Verification → aktifkan
2. Security → App Passwords → buat baru ("FinTrackr Mail")
3. Salin 16-karakter → paste ke kolom Password di Settings

| Endpoint | Keterangan |
|----------|-----------|
| `GET /api/settings/smtp` | Lihat config (password ditampilkan sebagai `hasPass: true`) |
| `PUT /api/settings/smtp` | Simpan config baru |
| `POST /api/settings/smtp/test` | Kirim email tes ke alamat tertentu |

---

## 🏗️ Arsitektur Backend (Clean Architecture)

```
┌──────────────────────────────────────────────────────┐
│   Delivery Layer (HTTP / Gin)                         │
│   handler/, middleware/, router.go                    │
│   ↕ hanya kenal interface usecase                    │
├──────────────────────────────────────────────────────┤
│   Use Case Layer (Business Logic)                     │
│   auth, account, transaction, workspace,              │
│   email_import_service, email_integration             │
│   ↕ hanya kenal interface repository                 │
├──────────────────────────────────────────────────────┤
│   Domain Layer (Entities + Ports)                     │
│   entity/, domain/repository/, domain/usecase/        │
│   zero framework dependencies                         │
├──────────────────────────────────────────────────────┤
│   Infrastructure Layer                                │
│   repository/ (GORM) · email/ (SMTP) ·               │
│   emailparser/ (regex) · worker/ (goroutines)         │
└──────────────────────────────────────────────────────┘
```

### Database Tables (16 Tabel)

| Tabel | Keterangan | Terkait |
|-------|-----------|---------|
| `users` | Akun pengguna, token verifikasi, reset password | — |
| `refresh_tokens` | JWT refresh token store (rotasi) | users |
| `accounts` | Rekening user (bank_code untuk email matching) | users |
| `categories` | 21 default + custom, icon + warna | users |
| `category_rules` | Rules auto-kategorisasi | categories |
| `transactions` | Semua transaksi, source field, idempotency_key | accounts, categories |
| `transaction_audit_logs` | Riwayat perubahan transaksi | transactions |
| `budgets` | Budget per kategori, progress tracking | categories |
| `subscriptions` | Langganan/recurring expenses | — |
| `workspaces` | Workspace multi-user | users |
| `workspace_members` | Keanggotaan + role | workspaces, users |
| `workspace_invites` | Token undangan + expiry | workspaces |
| `workspace_activity_logs` | Audit trail semua aksi workspace | workspaces |
| `system_settings` | Key-value store config (SMTP, dsb) | — |
| `email_integrations` | Koneksi Gmail/IMAP + OAuth tokens + LastSyncAt | users |
| `email_messages` | Pipeline email: pending→parsed→imported | email_integrations |
| `bank_parser_rules` | Parser rules dari UI (global, berlaku semua user) | — |

### Background Workers

Saat server startup, **2 worker** diluncurkan sebagai goroutine terpisah:

```
main.go
├── IMAPWorker.Start()
│   └── Untuk setiap IMAP integration aktif di DB:
│       └── goroutine pollLoop() → poll tiap 5 menit
│
└── GmailWorker.Start()
    └── Untuk setiap Gmail integration aktif di DB:
        └── goroutine pollLoop() → poll tiap 5 menit
```

Ketika integration baru ditambahkan via API, worker bisa di-trigger manual via `/sync` endpoint. Saat server restart, worker otomatis membaca ulang semua integrasi aktif dari DB.

---

## ⚠️ Troubleshooting

### Service tidak healthy
```powershell
docker compose ps                        # cek status semua
docker logs fintrackr-api-1              # cek log API
docker logs fintrackr-caddy-1            # cek log proxy
```

### Port sudah dipakai
Edit `docker-compose.dev.yml` → ubah port di bagian `ports:`.

### Login gagal dari browser
Pastikan API berjalan: `docker compose ps` → `fintrackr-api-1` harus `(healthy)`.

### Email verifikasi tidak sampai
1. Cek SMTP sudah dikonfigurasi: Settings → Konfigurasi Email
2. Jika belum, cek log untuk token verifikasi:
   ```powershell
   docker logs fintrackr-api-1 | Select-String "EMAIL"
   ```
3. Atau gunakan endpoint langsung:
   ```
   POST /api/auth/verify-email
   Body: { "token": "<token dari log>" }
   ```

### Email bank tidak ter-import otomatis
1. Pastikan integrasi aktif: `GET /api/email-integrations` → `is_active: true`
2. Cek email messages: `GET /api/email-messages?status=skipped` — lihat `skip_reason`
3. Cek log worker: `docker logs fintrackr-api-1 | Select-String "Worker"`
4. Coba manual sync: `POST /api/email-integrations/:id/sync`
5. Jika ada failed messages, coba reprocess: `POST /api/email-messages/:id/reprocess`

### Gmail OAuth gagal
1. Pastikan `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` sudah diset di `.env`
2. Pastikan `GOOGLE_CALLBACK_URL` sesuai dengan yang terdaftar di Google Console
3. Untuk local dev, callback URL: `http://localhost:4000/api/email-integrations/gmail/callback`

### Reset semua data
```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```
Database dan default categories dibuat ulang otomatis.

---

## 🔑 API Health Check

```
GET http://localhost/api/health
GET http://localhost:4000/api/health  (langsung, dev only)
```

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "environment": "development"
}
```

---

## 🗺️ API Route Reference (Lengkap)

### Authentication
```
POST   /api/auth/register                  Daftar + kirim verifikasi email
POST   /api/auth/login                     Login email/password
POST   /api/auth/refresh                   Refresh access token (rotation)
GET    /api/auth/google                    Mulai Google OAuth
GET    /api/auth/google/callback           Callback Google OAuth
POST   /api/auth/verify-email              Verifikasi email via token
POST   /api/auth/forgot-password           Request link reset password
POST   /api/auth/reset-password            Set password baru via token
--- Protected (perlu Bearer token) ---
GET    /api/auth/me                        Info akun saya
POST   /api/auth/logout                    Logout (revoke refresh token)
POST   /api/auth/send-verification         Kirim ulang email verifikasi
POST   /api/auth/change-password           Ganti password (perlu password lama)
```

### Transaksi
```
GET    /api/transactions                   List transaksi (filter: type/date/category/account/search)
POST   /api/transactions                   Tambah transaksi manual
GET    /api/transactions/:id               Detail transaksi
PATCH  /api/transactions/:id               Edit transaksi
DELETE /api/transactions/:id               Hapus (soft delete)
```

### Akun
```
GET    /api/accounts                       List rekening aktif
POST   /api/accounts                       Tambah rekening
PATCH  /api/accounts/:id                   Edit rekening
DELETE /api/accounts/:id                   Nonaktifkan rekening
```

### Kategori
```
GET    /api/categories                     List semua kategori
POST   /api/categories                     Buat kategori baru
PATCH  /api/categories/:id                 Edit kategori
DELETE /api/categories/:id                 Hapus kategori
```

### Budget
```
GET    /api/budgets                        List budget
POST   /api/budgets                        Buat budget baru
GET    /api/budgets/subscriptions          List langganan/recurring
PATCH  /api/budgets/:id                    Edit budget
DELETE /api/budgets/:id                    Hapus budget
```

### Dashboard
```
GET    /api/dashboard/summary              Ringkasan + perbandingan periode sebelumnya
GET    /api/dashboard/category-breakdown   Breakdown per kategori (pie chart data)
GET    /api/dashboard/monthly-trend        Tren 6 bulan (bar chart data)
```

### Workspace
```
GET    /api/workspaces                     List workspace saya
POST   /api/workspaces                     Buat workspace baru
GET    /api/workspaces/:id                 Detail workspace
PATCH  /api/workspaces/:id                 Edit workspace
DELETE /api/workspaces/:id                 Hapus workspace (owner only)
GET    /api/workspaces/:id/members         Daftar anggota
PATCH  /api/workspaces/:id/members/:uid    Ubah role anggota
DELETE /api/workspaces/:id/members/:uid    Keluarkan anggota
DELETE /api/workspaces/:id/leave           Keluar dari workspace
POST   /api/workspaces/:id/invites         Undang anggota via email
GET    /api/workspaces/:id/invites         List undangan aktif
DELETE /api/workspaces/:id/invites/:iid    Batalkan undangan
POST   /api/workspaces/invites/accept      Terima undangan (via token)
POST   /api/workspaces/invites/decline     Tolak undangan
GET    /api/workspaces/:id/activity        Activity log workspace
```

### Email Integration
```
GET    /api/email-integrations             List semua integrasi
POST   /api/email-integrations/imap        Hubungkan via IMAP
GET    /api/email-integrations/gmail/auth  Mulai OAuth Gmail
GET    /api/email-integrations/gmail/callback  Callback OAuth Gmail
DELETE /api/email-integrations/:id         Putuskan integrasi
PATCH  /api/email-integrations/:id/toggle  Aktif / nonaktif
POST   /api/email-integrations/:id/sync    Paksa sync sekarang
```

### Email Messages (Inbox Pipeline)
```
GET    /api/email-messages                 List semua email diproses
                                           ?status=pending|parsed|imported|skipped|failed
                                           ?integrationId=<uuid>
                                           ?page=1&limit=20
GET    /api/email-messages/:id             Detail satu email + hasil parse
POST   /api/email-messages/:id/reprocess   Coba ulang parse + import
DELETE /api/email-messages/:id             Hapus record (transaksi tidak terhapus)
```

### Settings
```
GET    /api/settings/smtp                  Lihat konfigurasi SMTP
PUT    /api/settings/smtp                  Simpan konfigurasi SMTP baru
POST   /api/settings/smtp/test             Kirim email tes

GET    /api/settings/parser-rules          List semua parser rules (termasuk nonaktif)
GET    /api/settings/parser-rules/active   List rules yang aktif saja
POST   /api/settings/parser-rules          Tambah parser rule baru
PATCH  /api/settings/parser-rules/:id      Edit parser rule
PATCH  /api/settings/parser-rules/:id/toggle  Aktif / nonaktif
DELETE /api/settings/parser-rules/:id      Hapus parser rule
```

---

*FinTrackr v1.0.0 · Go + Expo + PostgreSQL · Self-Hosted*
