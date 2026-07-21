# BRD: Savings Goals (Target Tabungan)

> **Dokumen**: Business Requirements Document  
> **Fitur**: Savings Goals — Target Tabungan per Rekening  
> **Versi**: 1.0  
> **Tanggal**: 2026-07-20  
> **Status**: Draft  

---

## 1. Ringkasan Eksekutif

Saku saat ini sudah mendukung **multiple accounts** (bank, credit, investment) dan **budget per kategori**. Namun belum ada mekanisme untuk menetapkan **target tabungan (savings goals)** yang terikat ke rekening tertentu.

Keluarga sering memiliki beberapa rekening dengan tujuan berbeda:
- Rekening A → Dana darurat
- Rekening B → Liburan keluarga
- Rekening C → DP Rumah
- Rekening D → Uang sekolah anak

Fitur **Savings Goals** memungkinkan user menetapkan target nominal + deadline untuk setiap rekening/tujuan, lalu melacak progress secara otomatis berdasarkan transaksi yang masuk.

---

## 2. Latar Belakang & Masalah

### Masalah yang Dihadapi User

| # | Masalah | Dampak |
|---|---------|--------|
| 1 | Tidak tahu apakah tabungan di rekening X sudah cukup untuk tujuan tertentu | Kurang motivasi menabung |
| 2 | Tidak ada visualisasi progress menuju target | Sulit tracking apakah on-track atau behind |
| 3 | Satu rekening bisa punya >1 tujuan (mis. rekening BRI dipakai untuk tabungan DP + dana darurat) | Tidak bisa breakdown per tujuan |
| 4 | Pasangan/keluarga di workspace tidak bisa kolaborasi tracking goal bersama | Masing-masing tidak tahu progress |
| 5 | Tidak ada reminder ketika deadline mendekat tapi progress masih rendah | Terlambat aware |

### Peluang

- Meningkatkan engagement user — dashboard jadi lebih "hidup" dengan progress goals
- Diferensiasi dari tracker biasa yang hanya mencatat pengeluaran
- Cocok untuk konteks keluarga Indonesia: nabung untuk Haji, DP rumah, sekolah anak, dll

---

## 3. Tujuan Fitur

| # | Tujuan | Metrik Keberhasilan |
|---|--------|---------------------|
| 1 | User bisa membuat goals tabungan dengan target nominal & deadline | ≥1 goal dibuat oleh 50% active users dalam 30 hari setelah rilis |
| 2 | Progress ter-track otomatis dari transaksi income ke rekening terkait | 80% goals memiliki progress update otomatis |
| 3 | Visualisasi progress di dashboard | Widget goals muncul di dashboard |
| 4 | Workspace members bisa melihat & berkontribusi ke shared goals | Goals workspace digunakan oleh ≥30% workspace aktif |
| 5 | Notifikasi milestone & deadline | User menerima reminder saat 50%, 80%, 100% tercapai |

---

## 4. Scope

### In Scope (v1)

- CRUD Savings Goals (buat, edit, hapus, lihat)
- Assign goal ke rekening tertentu ATAU tanpa rekening (goal mandiri)
- Target nominal + deadline opsional
- Progress tracking: manual top-up + otomatis dari transaksi income/transfer ke rekening terkait
- Multiple goals per rekening
- Goal status: active, achieved, paused, cancelled
- Progress visualization (progress bar + persentase)
- Widget di dashboard (top 3 goals aktif)
- Workspace shared goals (semua anggota bisa lihat progress)
- Contribution history (siapa menyumbang berapa ke goal)

### Out of Scope (Future)

- Auto-transfer / standing order ke goal (butuh integrasi bank API)
- AI recommendation "berapa seharusnya nabung per bulan"
- Goal template (DP Rumah, Dana Darurat, dll) — bisa ditambah nanti
- Gamification (streak, badge) — fase berikutnya
- Investment goal dengan proyeksi return — terlalu kompleks untuk v1

---

## 5. User Stories

### US-1: Membuat Goal Tabungan

> **Sebagai** user Saku,  
> **Saya ingin** membuat target tabungan dengan nama, nominal target, dan tenggat waktu,  
> **Agar** saya bisa melacak progres menabung untuk tujuan tertentu.

**Acceptance Criteria:**
- Form berisi: nama goal, target amount, deadline (opsional), rekening terkait (opsional), ikon, warna, deskripsi
- Goal tanpa rekening = "tabungan virtual" (progress 100% manual)
- Goal dengan rekening = progress otomatis dari income ke rekening tersebut
- Validasi: nama wajib, target > 0, deadline harus di masa depan
- Maksimal 20 goals aktif per user

### US-2: Melihat Progress Goal

> **Sebagai** user Saku,  
> **Saya ingin** melihat berapa persen progress setiap goal saya,  
> **Agar** saya tahu mana yang sudah on-track dan mana yang perlu usaha lebih.

**Acceptance Criteria:**
- List goals dengan progress bar, nominal terkumpul vs target
- Sort by: progress %, deadline terdekat, baru dibuat
- Filter: active, achieved, all
- Detail goal: riwayat kontribusi (tanggal, jumlah, sumber)
- Estimasi "target tercapai pada tanggal X" berdasarkan rata-rata kontribusi per bulan

### US-3: Menambah Kontribusi Manual ke Goal

> **Sebagai** user Saku,  
> **Saya ingin** menambah kontribusi manual ke goal,  
> **Agar** progress terupdate meskipun uangnya tidak masuk via transaksi tercatat.

**Acceptance Criteria:**
- Tombol "Tambah Kontribusi" di detail goal
- Input: jumlah, tanggal, catatan (opsional)
- Bisa juga mengurangi (withdraw dari goal) — misal: ambil sebagian dana darurat
- Riwayat kontribusi manual terlihat di history

### US-4: Progress Otomatis dari Transaksi

> **Sebagai** user Saku,  
> **Saya ingin** progress goal ter-update otomatis ketika ada transaksi income ke rekening yang terkait,  
> **Agar** saya tidak perlu input manual setiap kali ada uang masuk.

**Acceptance Criteria:**
- Jika goal terikat ke rekening X, setiap transaksi income/transfer-in ke rekening X otomatis dihitung sebagai progress
- User bisa pilih apakah mau mode "auto-track" (semua income ke rekening) atau "manual only"
- Jika 1 rekening punya >1 goal, income di-split rata ATAU user pilih allocation % per goal
- Transaksi yang sudah dihitung sebagai kontribusi ditandai (tidak double-count)

### US-5: Goal di Workspace

> **Sebagai** owner/admin workspace,  
> **Saya ingin** membuat shared goal yang bisa dilihat semua anggota,  
> **Agar** keluarga bisa menabung bersama untuk tujuan yang sama.

**Acceptance Criteria:**
- Goal bisa dibuat di level workspace (bukan hanya personal)
- Semua workspace members bisa lihat progress
- Contributor+ bisa menambah kontribusi
- Owner/Admin bisa edit/hapus goal
- Activity log mencatat siapa menambah kontribusi berapa

### US-6: Notifikasi Milestone

> **Sebagai** user Saku,  
> **Saya ingin** mendapat notifikasi saat goal mencapai 50%, 80%, dan 100%,  
> **Agar** saya termotivasi dan tahu kapan goal sudah tercapai.

**Acceptance Criteria:**
- Push notification (jika mobile) / in-app notification saat milestone tercapai
- Notifikasi deadline approaching: 30 hari, 7 hari sebelum deadline jika progress < 80%
- Goal otomatis berubah status "achieved" saat current ≥ target
- Celebratory UI saat goal tercapai (confetti / badge)

### US-7: Dashboard Widget

> **Sebagai** user Saku,  
> **Saya ingin** melihat ringkasan goals di dashboard,  
> **Agar** saya aware progress tanpa harus masuk ke halaman goals.

**Acceptance Criteria:**
- Widget menampilkan top 3 goals aktif (by deadline terdekat)
- Compact view: nama + progress bar + "Rp X / Rp Y"
- Tap widget → masuk ke halaman goals
- Bisa di-dismiss jika tidak mau lihat di dashboard

---

## 6. Data Model

### Entity: `SavingsGoal`

| Field | Type | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users. Pemilik goal |
| `workspace_id` | UUID? | Nullable. Jika diisi = shared goal workspace |
| `account_id` | UUID? | Nullable. FK → accounts. Rekening yang di-track |
| `name` | string(255) | Nama goal (wajib) |
| `description` | text? | Deskripsi/motivasi |
| `target_amount` | numeric(15,2) | Target nominal (wajib, > 0) |
| `current_amount` | numeric(15,2) | Jumlah terkumpul saat ini. Default 0 |
| `currency` | string(3) | Default "IDR" |
| `icon` | string(50) | Emoji atau icon name. Default "🎯" |
| `color` | string(7) | Hex color. Default "#6B8E6B" (sage) |
| `deadline` | date? | Nullable. Target tanggal tercapai |
| `status` | string(20) | "active" \| "achieved" \| "paused" \| "cancelled" |
| `tracking_mode` | string(20) | "auto" \| "manual". Auto = hitung dari transaksi |
| `achieved_at` | timestamp? | Kapan goal tercapai |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `deleted_at` | timestamp? | Soft delete |

### Entity: `SavingsGoalContribution`

| Field | Type | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `goal_id` | UUID | FK → savings_goals |
| `user_id` | UUID | FK → users. Siapa yang kontribusi |
| `transaction_id` | UUID? | FK → transactions. Null jika kontribusi manual |
| `amount` | numeric(15,2) | Jumlah kontribusi (positif = tambah, negatif = withdraw) |
| `type` | string(20) | "manual" \| "auto" \| "withdraw" |
| `note` | text? | Catatan opsional |
| `contributed_at` | timestamp | Tanggal kontribusi (bisa beda dari created_at) |
| `created_at` | timestamp | |

### Entity: `SavingsGoalAllocation` (untuk multi-goal per rekening)

| Field | Type | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `account_id` | UUID | FK → accounts |
| `goal_id` | UUID | FK → savings_goals |
| `percentage` | numeric(5,2) | Alokasi % income ke goal ini (0-100). Total per account ≤ 100% |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Unique constraint:** `(account_id, goal_id)` — satu goal per rekening hanya punya satu allocation.

---

## 7. API Endpoints

### Goals CRUD

```
GET    /api/savings-goals                    List semua goals user (+ workspace goals)
                                              ?status=active|achieved|paused|cancelled
                                              ?workspaceId=<uuid>
POST   /api/savings-goals                    Buat goal baru
GET    /api/savings-goals/:id                Detail goal + summary kontribusi
PATCH  /api/savings-goals/:id                Edit goal (nama, target, deadline, dll)
DELETE /api/savings-goals/:id                Soft delete goal
PATCH  /api/savings-goals/:id/status         Ubah status (pause, resume, cancel)
```

### Contributions

```
GET    /api/savings-goals/:id/contributions  Riwayat kontribusi goal
                                              ?type=manual|auto|withdraw
                                              ?page&limit
POST   /api/savings-goals/:id/contributions  Tambah kontribusi manual / withdraw
```

### Allocations

```
GET    /api/savings-goals/allocations        List semua alokasi user
PUT    /api/savings-goals/allocations        Set/update alokasi per account-goal
                                              Body: [{accountId, goalId, percentage}]
```

### Dashboard

```
GET    /api/savings-goals/summary            Ringkasan: total target, total terkumpul,
                                              goals on-track vs behind
```

### Workspace Goals

```
GET    /api/workspaces/:id/savings-goals     List goals workspace
POST   /api/workspaces/:id/savings-goals     Buat shared goal (owner/admin only)
```

---

## 8. Business Rules

### BR-1: Perhitungan Progress Otomatis

```
Ketika ada transaksi baru dengan:
  - type = "income" atau "transfer" (masuk)
  - account_id = rekening yang punya goal aktif dengan tracking_mode = "auto"

Maka:
  1. Cek semua goals aktif untuk account tersebut
  2. Jika 1 goal → 100% income masuk ke goal
  3. Jika >1 goals → split berdasarkan allocation %
     - Jika tidak ada allocation → split rata
  4. Buat SavingsGoalContribution record (type = "auto", transaction_id = tx.id)
  5. Update savings_goals.current_amount += kontribusi
  6. Cek apakah current_amount >= target_amount → set status = "achieved"
```

### BR-2: Status Transitions

```
active → achieved    (otomatis saat current >= target, ATAU manual oleh user)
active → paused      (user pause, progress tidak bertambah meski ada income)
active → cancelled   (user cancel, goal ditandai gagal)
paused → active      (user resume)
achieved → active    (user mau naikkan target)
cancelled → active   (user reactivate)
```

### BR-3: Workspace Goal Permissions

| Action | Owner | Admin | Contributor | Viewer |
|--------|-------|-------|-------------|--------|
| Lihat goal | ✅ | ✅ | ✅ | ✅ |
| Buat goal | ✅ | ✅ | ❌ | ❌ |
| Edit goal | ✅ | ✅ | ❌ | ❌ |
| Hapus goal | ✅ | ✅ | ❌ | ❌ |
| Tambah kontribusi | ✅ | ✅ | ✅ | ❌ |
| Withdraw | ✅ | ✅ | ❌ | ❌ |

### BR-4: Batas & Validasi

- Maksimal **20 goals aktif** per user (personal + workspace)
- Maksimal **10 goals aktif** per workspace
- `target_amount` minimum Rp 10.000
- `current_amount` tidak boleh negatif (withdraw ditolak jika > current)
- Deadline tidak boleh di masa lalu saat create (boleh saat edit — untuk yang sudah lewat)
- Total allocation % per account tidak boleh > 100%
- Goal yang sudah "achieved" tidak menerima kontribusi otomatis lagi

### BR-5: Penghapusan Rekening

Jika rekening yang terkait goal dihapus:
- Goal tetap aktif tapi `account_id` → null
- `tracking_mode` otomatis berubah ke "manual"
- Notifikasi ke user: "Rekening X dihapus, goal Y sekarang manual"

### BR-6: Anti-Double Count

- Satu transaksi hanya bisa menjadi kontribusi ke **satu goal** (constraint unique `transaction_id` di contributions)
- Kecuali jika >1 goal per account dengan allocation → split → tetap 1 contribution per goal tapi amount-nya sebagian

---

## 9. UI/UX Wireframe

### 9a. Halaman Goals (Tab Tersembunyi — akses dari Settings/Dashboard)

```
┌─────────────────────────────────────────────────────┐
│  ← Target Tabungan                          [+ Buat] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ 🏠 DP Rumah Baru              Target: Rp 200jt│  │
│  │ ████████████████░░░░░░░░░░░░  68%             │  │
│  │ Rp 136.000.000 / Rp 200.000.000              │  │
│  │ Deadline: Des 2027 · BRI Tabungan             │  │
│  │ 📈 On Track — est. tercapai Nov 2027          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ ✈️ Liburan Jepang             Target: Rp 50jt │  │
│  │ ████████░░░░░░░░░░░░░░░░░░░░  32%             │  │
│  │ Rp 16.000.000 / Rp 50.000.000                │  │
│  │ Deadline: Mar 2027 · Mandiri                  │  │
│  │ ⚠️ Behind — nabung Rp 3.4jt/bln untuk tepat   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ 🛡️ Dana Darurat               Target: Rp 60jt │  │
│  │ ██████████████████████████░░░  87%             │  │
│  │ Rp 52.200.000 / Rp 60.000.000                │  │
│  │ Tanpa deadline · BRI Tabungan                 │  │
│  │ ✅ Hampir tercapai!                            │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [Achieved (2)] ← expandable section                │
│  ┌───────────────────────────────────────────────┐  │
│  │ ✅ 📱 iPhone 16          Tercapai 12 Jun 2026 │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 9b. Detail Goal

```
┌─────────────────────────────────────────────────────┐
│  ← DP Rumah Baru                        [⋮ Menu]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│          🏠                                         │
│    Rp 136.000.000                                   │
│    dari Rp 200.000.000                              │
│                                                     │
│    ████████████████████░░░░░░░░░░  68%              │
│                                                     │
│    Deadline: 31 Des 2027 (17 bulan lagi)            │
│    Rekening: BRI Tabungan                           │
│    Mode: Otomatis                                   │
│    Perlu nabung: ~Rp 3.765.000/bulan                │
│                                                     │
│    [+ Tambah Kontribusi]   [↓ Withdraw]             │
│                                                     │
├── Riwayat Kontribusi ───────────────────────────────┤
│                                                     │
│  20 Jul 2026   +Rp 12.277.937   🤖 Auto (Gaji)     │
│  15 Jul 2026   +Rp 5.000.000    ✋ Manual            │
│  25 Jun 2026   +Rp 12.277.937   🤖 Auto (Gaji)     │
│  10 Jun 2026   −Rp 2.000.000    ↓ Withdraw          │
│  25 Mei 2026   +Rp 12.277.937   🤖 Auto (Gaji)     │
│  ...                                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 9c. Dashboard Widget

```
┌── 🎯 Target Tabungan ──────────────── Lihat Semua → ┐
│                                                      │
│  🏠 DP Rumah        ██████████░░░░  68%  Rp 136jt   │
│  ✈️ Liburan Jepang  ████░░░░░░░░░░  32%  Rp 16jt    │
│  🛡️ Dana Darurat    █████████████░  87%  Rp 52.2jt  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 10. Integrasi dengan Fitur Existing

### 10a. Integrasi dengan Email Auto-Import

Ketika `EmailImportService.ProcessMessage()` berhasil membuat transaksi income:

```
ProcessMessage() → Create Transaction (income)
                 → [NEW] goalService.ProcessIncomingTransaction(tx)
                       → Find active goals for tx.AccountID with tracking_mode="auto"
                       → Calculate allocation per goal
                       → Create GoalContribution records
                       → Update goal current_amount
                       → Check milestone notifications
```

### 10b. Integrasi dengan Dashboard

- Endpoint `GET /api/dashboard/summary` ditambah field `goalsProgress`:
  ```json
  {
    "totalIncome": 15000000,
    "totalExpense": 8000000,
    "netBalance": 7000000,
    "goalsProgress": {
      "totalGoals": 3,
      "onTrack": 2,
      "behind": 1,
      "totalTarget": 310000000,
      "totalCurrent": 204200000,
      "overallPercent": 65.9
    }
  }
  ```

### 10c. Integrasi dengan Workspace

- Shared goals muncul di workspace activity log
- Kontribusi anggota terlihat di workspace activity

---

## 11. Notifikasi & Alert

| Event | Channel | Pesan |
|-------|---------|-------|
| Goal 50% tercapai | In-app | "🎯 {nama} sudah 50%! Lanjutkan!" |
| Goal 80% tercapai | In-app | "🔥 {nama} sudah 80%! Sedikit lagi!" |
| Goal 100% tercapai | In-app + banner | "🎉 Selamat! {nama} tercapai!" |
| 30 hari sebelum deadline, progress < 80% | In-app | "⏰ {nama} deadline 30 hari lagi, masih {x}%" |
| 7 hari sebelum deadline, progress < 90% | In-app | "⚠️ {nama} deadline minggu depan!" |
| Kontribusi workspace member | In-app (other members) | "💰 {member} menambah Rp X ke {goal}" |

> **v1**: Notifikasi in-app saja (banner/toast). Push notification ditambah di fase berikutnya.

---

## 12. Estimasi Kompleksitas

### Backend (Go)

| Komponen | Effort |
|----------|--------|
| Entity + Migration | 1 hari |
| Repository layer | 1 hari |
| UseCase (CRUD + progress calculation) | 2 hari |
| Handler + Routes | 1 hari |
| Integration dengan EmailImportService | 1 hari |
| Unit tests | 1 hari |
| **Subtotal** | **7 hari** |

### Frontend (Expo/React Native Web)

| Komponen | Effort |
|----------|--------|
| Goals list screen | 1 hari |
| Goal detail screen | 1.5 hari |
| Create/Edit goal form | 1 hari |
| Contribution modal | 0.5 hari |
| Dashboard widget | 1 hari |
| Allocation settings | 1 hari |
| API hooks + state | 0.5 hari |
| **Subtotal** | **6.5 hari** |

### Total Estimasi: ~13.5 hari kerja (2.5 minggu)

---

## 13. Risiko & Mitigasi

| # | Risiko | Impact | Mitigasi |
|---|--------|--------|----------|
| 1 | Performance: goal progress hitung dari semua transaksi setiap kali | High | Simpan `current_amount` sebagai denormalized field, update incremental saat ada kontribusi baru |
| 2 | Race condition: 2 transaksi income masuk bersamaan | Medium | Use DB transaction + row lock pada goal saat update current_amount |
| 3 | User confused: auto-tracking tapi rekening juga dipakai untuk expense | Low | Hanya hitung income/transfer-in, bukan net balance. Jelaskan di UI |
| 4 | Multi-goal allocation kompleks untuk user awam | Medium | Default: split rata. Advanced allocation di "Settings" bukan di create form |
| 5 | Goal achieved tapi uang dipakai → current turun di bawah target | Medium | Status "achieved" sticky — tidak revert otomatis. User bisa manual reactivate |

---

## 14. Dependensi

| Dependensi | Status | Blocker? |
|------------|--------|----------|
| Account entity sudah ada (bank, credit, investment) | ✅ Sudah ada | Tidak |
| Transaction entity dengan account_id | ✅ Sudah ada | Tidak |
| Workspace + member roles | ✅ Sudah ada | Tidak |
| Email auto-import pipeline | ✅ Sudah ada | Tidak |
| In-app notification system | ❌ Belum ada | Tidak — milestone tracking bisa jadi log dulu, notif ditambah setelahnya |

---

## 15. Future Enhancements (v2+)

- **Goal Templates**: Preset goals populer (Dana Darurat = 6x pengeluaran bulanan, DP Rumah = 20% harga, dll)
- **Smart Suggestions**: AI recommend target berdasarkan income pattern
- **Recurring Contribution Reminder**: "Sudah nabung bulan ini?"
- **Goal Sharing**: Share progress ke luar workspace (social, keluarga besar)
- **Gamification**: Streak menabung, badge "Konsisten 6 Bulan", leaderboard workspace
- **Auto-adjust Target**: Jika income turun, suggest perpanjang deadline
- **Investment Goals**: Track portfolio value + projected returns (integrasi dengan account type "investment")

---

## 16. Approval

| Peran | Nama | Status |
|-------|------|--------|
| Product Owner | — | ⬜ Pending |
| Tech Lead | — | ⬜ Pending |
| Designer | — | ⬜ Pending |

---

*Dokumen ini akan di-update setelah review & approval.*


---

## 9b. Multi-Source Savings (Sumber Tabungan Beragam)

### Latar Belakang

Keluarga Indonesia sering mendiversifikasi tabungan mereka ke berbagai jenis aset — tabungan bank, emas, reksadana, saham, dan crypto — terutama untuk goal jangka panjang seperti DP Rumah atau Dana Pendidikan Anak. Fitur multi-source memungkinkan user melacak kontribusi dari berbagai sumber aset dalam satu goal.

### Source Types yang Didukung

| Source Type | Ikon | Tracking Mode | Keterangan |
|---|---|---|---|
| `saving_account` | 💰 | Auto / Manual | Rekening bank — satu-satunya yang bisa auto-track |
| `stocks` | 📈 | Manual | Saham (user update market value secara berkala) |
| `gold` | 🪙 | Manual | Emas fisik/digital (Antam, Pegadaian, Tokopedia Emas) |
| `reksadana` | 📊 | Manual | Reksadana (Bibit, Bareksa, dll) |
| `crypto` | ₿ | Manual | Cryptocurrency (Bitcoin, ETH, dll) |
| `deposit` | 🏦 | Manual | Deposito berjangka |
| `cash` | 💵 | Manual | Tunai |
| `other` | 📦 | Manual | Lainnya |

### Business Rules Multi-Source

**BR-7: Multiple Sources per Goal**
- Satu goal bisa memiliki 1 atau lebih sumber tabungan
- Hanya source type `saving_account` yang bisa mode "auto" (terkait account_id)
- Semua source type lain selalu "manual"
- Total progress goal = jumlah dari semua sumber
- User bisa tambah/hapus sumber kapan saja

**BR-8: Kontribusi dengan Source Type**
- Setiap kontribusi (manual/auto) HARUS memiliki `source_type` dan `source_name`
- Untuk auto-tracking: source_type otomatis = "saving_account", source_name = nama rekening
- Untuk manual: user pilih source type saat menambah kontribusi
- Withdraw juga harus specify dari source mana

**BR-9: Breakdown per Source**
- Goal detail menampilkan breakdown: berapa persen kontribusi dari tiap source
- User bisa melihat total per source type
- Ini membantu user memahami diversifikasi tabungan mereka

### Perubahan Data Model

**Entity: `SavingsGoalSource` (baru)**

| Field | Type | Keterangan |
|-------|------|------------|
| `id` | UUID | Primary key |
| `goal_id` | UUID | FK → savings_goals |
| `source_type` | string(20) | "saving_account" \| "stocks" \| "gold" \| "crypto" \| "reksadana" \| "deposit" \| "cash" \| "other" |
| `source_name` | string(255) | Nama sumber (mis. "BRI Tabungan ••4521", "Stockbit", "Antam 5gr") |
| `tracking_mode` | string(20) | "auto" \| "manual" |
| `account_id` | UUID? | Nullable. FK → accounts. Hanya untuk saving_account dengan auto |
| `current_amount` | numeric(15,2) | Subtotal terkumpul dari source ini |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Perubahan Entity: `SavingsGoalContribution`**

Tambah field:
| Field | Type | Keterangan |
|-------|------|------------|
| `source_id` | UUID | FK → savings_goal_sources. Kontribusi ini dari source mana |

### UI/UX Wireframe Multi-Source

**9b-1. Form Create/Edit Goal — Bagian Sumber**

```
┌─────────────────────────────────────────────────────┐
│  Sumber tabungan                                    │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ 💰 Tabungan  │ BRI ••4521         │ Otomatis │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │ 📈 Saham     │ Stockbit            │ Manual  │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │ 🪙 Emas      │ Antam 5gr           │ Manual  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [+ Tambah sumber]                                  │
│                                                     │
│  ℹ️ Hanya rekening bank bisa otomatis.              │
│  Sumber lain perlu update manual berkala.           │
└─────────────────────────────────────────────────────┘
```

**9b-2. Add Contribution Modal — Pilih Source**

```
┌─────────────────────────────────────────────────────┐
│  Tambah Kontribusi          DP Rumah Baru           │
│                                                     │
│  Kontribusi ke:                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │💰Bank│ │📈Saham│ │🪙Emas │ │📊Reksa│ │₿Crypto│   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
│  (active)                                           │
│                                                     │
│  Jumlah: Rp 5.000.000                              │
│  Tanggal: 20 Jul 2026                              │
│  Catatan: Transfer dari gaji Juli                   │
│                                                     │
│  [Simpan Kontribusi]                                │
└─────────────────────────────────────────────────────┘
```

**9b-3. Goal Detail — Breakdown Sumber**

```
┌─────────────────────────────────────────────────────┐
│  🏠 DP Rumah Baru              Target: Rp 200jt    │
│  ████████████████████░░░░░░░░░░  68%               │
│  Rp 136.000.000 / Rp 200.000.000                   │
│                                                     │
│  ── Breakdown Sumber ───────────────────────────    │
│                                                     │
│  💰 Tabungan (BRI)     Rp 80.000.000    59%  ████  │
│  📈 Saham (Stockbit)   Rp 35.000.000    26%  ███   │
│  🪙 Emas (Antam)       Rp 15.000.000    11%  ██    │
│  📊 Reksadana (Bibit)  Rp  6.000.000     4%  █     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### API Endpoints Tambahan

```
GET    /api/savings-goals/:id/sources        List semua source untuk goal
POST   /api/savings-goals/:id/sources        Tambah source baru
PATCH  /api/savings-goals/:id/sources/:sid   Edit source (nama, dll)
DELETE /api/savings-goals/:id/sources/:sid   Hapus source
```

