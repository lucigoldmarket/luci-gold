# LUCI GOLD — Product Requirements Document (PRD)

**Versi:** 2.0.0 | **Tanggal:** Juni 2025 | **Status:** DRAFT

Gold Trading Management System — Rebuild v2.0

---

## 1. Ringkasan Eksekutif

LUCI Gold adalah sistem manajemen trading gold berbasis web yang dirancang khusus untuk bisnis jual beli gold di platform G2G dan saluran Direct (Discord). Dokumen ini mendefinisikan seluruh requirement untuk rebuild total dari versi single-file HTML ke aplikasi full-stack yang modern, aman, dan akurat secara kalkulasi.

### 1.1 Masalah yang Diselesaikan

| # | Masalah | Dampak | Prioritas |
|---|---------|--------|-----------|
| 1 | Kalkulasi fee G2G tidak akurat — withdrawal fee tidak ter-hitung dengan benar (ada komponen fixed + persentase per metode penarikan) | Profit calculation salah, bisa merugi tanpa sadar | **KRITIS** |
| 2 | Input data hanya via Google Sheets — tidak ada input langsung di app | Workflow tidak efisien, rawan error manual | TINGGI |
| 3 | Tidak ada sistem autentikasi & role — satu URL terbuka untuk semua | Keamanan data bisnis tidak terjamin | TINGGI |
| 4 | Float money G2G tidak ter-track real-time | Tidak tahu berapa modal yang sedang "mengendap" | TINGGI |
| 5 | Uang pool 1 untuk G2G + Direct — tidak ada alokasi tracking | Sulit optimasi modal | SEDANG |
| 6 | Data hardcoded (nama investor, fee G2G flat) | Tidak fleksibel saat ada perubahan bisnis | SEDANG |

---

## 2. Scope & Tujuan Proyek

### 2.1 Tujuan Utama

- Membangun ulang LUCI Gold sebagai aplikasi full-stack Next.js dengan Supabase sebagai database
- Memperbaiki kalkulator G2G agar 100% akurat termasuk seluruh komponen fee (commission, VAT, withdrawal % + fixed amount)
- Mengimplementasikan sistem autentikasi email dan role-based access control (RBAC)
- Memungkinkan input transaksi langsung dari aplikasi tanpa perlu Google Sheets
- Menyediakan dashboard investor read-only yang informatif
- Tracking modal secara real-time termasuk dana floating di G2G

### 2.2 Out of Scope (v2.0)

- Integrasi API langsung ke G2G platform (data masih input manual)
- Notifikasi otomatis via Telegram/Discord bot
- Mobile app native (iOS/Android) — cukup responsive web
- Multi-game / multi-platform lain di luar G2G dan Direct

---

## 3. User & Role System

### 3.1 Definisi Role

| Role | Deskripsi | Jumlah User | Akses |
|------|-----------|-------------|-------|
| **Admin / Operator** | Pengelola bisnis yang menjalankan trading sehari-hari. Bisa input, edit, hapus semua data transaksi dan melihat semua laporan. | 2 orang (Anda + rekan) | Full access — semua fitur |
| **Investor / Viewer** | Pemilik modal yang hanya perlu melihat laporan keuangan dan profit. Tidak bisa mengubah data apapun. | Tidak dibatasi | Read-only — dashboard, laporan, profit sharing saja |

### 3.2 Permission Matrix

| Fitur | Admin | Investor |
|-------|-------|----------|
| Dashboard & Ringkasan | ✅ Full | ✅ Full |
| Kalkulator G2G & Direct | ✅ Full | ❌ Tidak ada akses |
| Input Transaksi Baru | ✅ | ❌ |
| Edit / Hapus Transaksi | ✅ | ❌ |
| Log Penjualan (detail) | ✅ | ✅ Read-only |
| Rekap Profit Mingguan | ✅ | ✅ Read-only |
| Laporan Profit Sharing | ✅ | ✅ Read-only |
| Kas & Saldo Modal | ✅ | ✅ Read-only |
| Log Operasional (pengeluaran) | ✅ | ✅ Read-only |
| Setting Fee G2G (konfigurasi) | ✅ | ❌ |
| Manajemen User (tambah/hapus) | ✅ Admin saja | ❌ |

---

## 4. Arsitektur Teknis

### 4.1 Tech Stack

| Layer | Teknologi | Justifikasi |
|-------|-----------|-------------|
| Frontend | Next.js 14+ (App Router) | SSR/SSG, routing mudah, React ecosystem, Vercel deploy |
| Styling | Tailwind CSS + shadcn/ui | Utility-first, konsisten, komponen siap pakai |
| Backend / API | Next.js API Routes + Server Actions | Full-stack dalam satu repo, tidak perlu server terpisah |
| Database | Supabase (PostgreSQL) | Relasional cocok untuk transaksi, Row Level Security, Auth bawaan |
| Auth | Supabase Auth (Email + Password) | Terintegrasi dengan DB, RLS per user/role |
| State Management | Zustand / React Query (TanStack Query) | Ringan, caching data dari Supabase |
| Charts | Recharts atau Chart.js | Mempertahankan visual dari versi lama |
| Deployment | Vercel (frontend) + Supabase (backend) | Free tier cukup untuk scale bisnis ini |
| Dev Tool | Claude Code (CLI) | Agentic coding untuk development lebih cepat |

### 4.2 Skema Database (Supabase)

#### Tabel: `transactions`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | uuid (PK) | Auto-generated |
| `created_at` | timestamptz | Waktu input |
| `transaction_date` | date | Tanggal transaksi |
| `channel` | enum: g2g \| direct | Platform penjualan |
| `game_name` | text | Nama game (e.g. FFXIV, WoW) |
| `gold_amount` | numeric | Jumlah gold yang diperjualbelikan |
| `buy_price_idr` | numeric | Harga beli per unit dari Telegram (IDR) |
| `sell_price_idr` | numeric | Harga jual per unit ke G2G/Direct (IDR) |
| `commission_fee_pct` | numeric | Fee komisi G2G % saat transaksi (snapshot) |
| `status` | enum: pending \| completed \| cancelled | Status transaksi (G2G butuh waktu 3-7 hari) |
| `settled_at` | timestamptz | Kapan dana cair (completed) |
| `profit_idr` | numeric | Profit bersih IDR (dihitung otomatis) |
| `notes` | text | Catatan tambahan |
| `created_by` | uuid (FK → users) | Admin yang input |
| `week_number` | int | Nomor minggu (untuk rekap) |

#### Tabel: `withdrawals`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | uuid (PK) | |
| `withdrawal_date` | date | Tanggal penarikan dari G2G |
| `amount_usd` | numeric | Nominal yang ditarik (USD) |
| `method` | text | Metode: DOKU Bank Transfer, PayPal, dll |
| `withdrawal_fee_pct` | numeric | Persentase fee withdrawal (snapshot saat itu) |
| `withdrawal_fee_fixed_idr` | numeric | Biaya tetap withdrawal (misal IDR 19,999) |
| `amount_received_idr` | numeric | Jumlah diterima setelah semua fee |
| `notes` | text | |

#### Tabel: `operational_expenses`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | uuid (PK) | |
| `expense_date` | date | |
| `category` | text | Pokok Bulanan \| Operasional Bisnis \| Lain-lain |
| `description` | text | Keterangan pengeluaran |
| `amount_idr` | numeric | Nominal IDR |
| `week_number` | int | |
| `expense_type` | enum: rutin \| non-rutin | |

**→ CATATAN PENTING:** Operational expenses di-track terpisah. Apakah ini dipotong langsung dari profit sebelum dibagi ke investor, atau hanya reporting saja? **PERLU KLARIFIKASI AGUS** (lihat Bab 11)

#### Tabel: `capital_log`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | uuid (PK) | |
| `log_date` | date | |
| `type` | enum: topup \| withdrawal \| profit_inject \| expense | Jenis perubahan modal |
| `amount_idr` | numeric | Perubahan (+ atau -) |
| `description` | text | |
| `balance_after` | numeric | Saldo setelah perubahan (computed) |

#### Tabel: `fee_config`

Tabel konfigurasi fee G2G yang bisa diubah admin, tidak hardcoded.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | uuid (PK) | |
| `seller_rank` | text | uncommon \| rare \| epic \| legendary \| normal \| common |
| `commission_pct` | numeric | Persentase komisi (e.g. 7.99 untuk Uncommon) |
| `vat_pct` | numeric | VAT lokal jika berlaku (e.g. 11% untuk Indonesia) |
| `withdrawal_method` | text | DOKU Bank Transfer \| DOKU Wallet \| PayPal \| dll |
| `withdrawal_fee_pct` | numeric | Persentase withdrawal fee (e.g. 1.99 untuk Uncommon) |
| `withdrawal_fee_fixed` | numeric | Biaya tetap dalam mata uang lokal (e.g. IDR 19999) |
| `currency` | text | IDR \| USD \| dll |
| `is_active` | boolean | Konfigurasi yang sedang digunakan |
| `updated_at` | timestamptz | |

---

## 5. Kalkulator Trading — Core Feature

Ini adalah fitur yang paling kritis dan paling sering digunakan. Kalkulator harus 100% akurat dan transparan menampilkan setiap komponen biaya.

### 5.1 Struktur Fee G2G Aktual (Hasil Riset)

Berdasarkan dokumentasi resmi G2G (diakses Juni 2025), berikut adalah struktur fee lengkap.

#### A. Commission Fee (per transaksi)

| Seller Rank | Comm Fee (In-Game Currency) | Comm Fee (Account Service) |
|-------------|------------------------------|---------------------------|
| Normal | 9.99% | 12.99% |
| Common | 8.99% | 11.99% |
| **Uncommon ← (Anda)** | **7.99%** | **10.99%** |
| Rare | 6.99% | 9.99% |
| Epic | 5.99% | 8.99% |
| Legendary | 4.99% | 7.99% |

**→ Rank Anda saat ini: Uncommon = 7.99% untuk In-Game Currency (gold)**

**→ VAT Indonesia (PPN 11%) dikenakan atas commission fee → Total efektif: 7.99% × 1.11 = 8.87%**

#### B. Withdrawal Fee (per penarikan ke IDR)

| Metode Withdrawal | Fee Uncommon/Rare/Epic | Komponen Fixed |
|-------------------|------------------------|----------------|
| DOKU Bank Transfer (IDR) | 1.99% | + IDR 19,999 |
| DOKU Wallet (IDR) | 1.99% | + IDR 19,999 |
| Store Credit (IDR) | 0% | Gratis |

**→ Inilah sumber ketidakakuratan hitungan lama — IDR 19,999 fixed per penarikan tidak dihitung**

**→ Semakin kecil nominal yang ditarik, semakin besar proporsi IDR 19,999 terhadap total**

**→ Minimum withdrawal: IDR 148,000 | Maksimum: IDR 5,000,000,000 per transaksi**

### 5.2 Formula Kalkulasi G2G (DIPERBAIKI)

#### Arah 1: Dari Harga Beli → Hitung Harga Posting G2G

**Variabel input:**
- `buy_price` = harga beli per gold dari Telegram (IDR)
- `target_margin` = margin profit yang diinginkan (%) — default 0.6%
- `comm_fee` = 7.99% (Uncommon, bisa diubah di setting)
- `vat` = 11% (PPN)
- `withdrawal_fee_pct` = 1.99% (DOKU, bisa diubah)
- `withdrawal_fee_fixed` = IDR 19,999
- `gold_volume` = jumlah gold dalam transaksi ini (untuk alokasi fixed fee)

**Formula:**

```
effective_comm = comm_fee × (1 + vat)  →  7.99% × 1.11 = 8.87%

fixed_fee_per_gold = withdrawal_fee_fixed / gold_volume

total_cost_pct = effective_comm + withdrawal_fee_pct  →  8.87% + 1.99% = 10.86%

min_sell_price = ceil( (buy_price × (1 + target_margin) + fixed_fee_per_gold) / (1 - total_cost_pct) )
```

#### Arah 2: Dari Harga Kompetitor → Hitung Maks Harga Beli Farmer

```
net_receive_per_gold = competitor_price × (1 - effective_comm - withdrawal_fee_pct) - fixed_fee_per_gold

max_buy_price = floor( net_receive_per_gold / (1 + target_margin) )

profit_per_gold = net_receive_per_gold - buy_price

profit_pct = profit_per_gold / competitor_price × 100
```

**Catatan penting untuk implementasi:**

- Fixed fee IDR 19,999 harus dibagi ke seluruh gold dalam transaksi tersebut untuk mendapat biaya per unit
- Kalkulator harus menampilkan BREAKDOWN lengkap: comm fee, VAT, withdrawal %, withdrawal fixed, profit bersih
- Semua fee rate diambil dari tabel fee_config di Supabase, bukan hardcoded

### 5.3 Formula Kalkulasi Direct (Discord)

Untuk penjualan direct ke buyer, tidak ada fee platform G2G. Yang ada hanya fee payment method jika pembayaran via metode tertentu.

#### Arah 1: Dari Harga Beli → Harga Min Tawar ke Buyer

```
payment_fee = fee metode pembayaran yang dipakai (misal QRIS, transfer, dsb)

min_offer = ceil( buy_price × (1 + target_margin) / (1 - payment_fee) )
```

#### Arah 2: Dari Penawaran Buyer → Maks Harga Beli

```
max_buy_price = floor( offer_price × (1 - payment_fee) × (1 - target_margin) )

profit_per_gold = offer_price × (1 - payment_fee) - buy_price
```

### 5.4 Kalkulator Profit Sharing

```
ops_share = total_profit × ops_percentage

investor_total = total_profit - ops_share

per_investor = investor_total / jumlah_investor
```

Persentase dan jumlah investor bisa diubah di setting admin.

**→ PERTANYAAN:** Apakah operational_expenses dipotong SEBELUM atau SESUDAH profit sharing? **PERLU KLARIFIKASI AGUS**

---

## 6. Fitur-Fitur Aplikasi

### 6.1 Autentikasi & Onboarding

- Login via email + password (Supabase Auth)
- Tidak ada self-registration — admin yang menambahkan user baru
- Setelah login, redirect sesuai role: Admin → Dashboard penuh, Investor → Dashboard read-only
- Lupa password via email reset (Supabase built-in)
- Session persists (auto-login kalau tidak logout)

### 6.2 Dashboard Utama

- Hero stats: Total Modal, Float G2G, Kas Tersedia, Profit Bulan Ini
- Chart profit mingguan (line chart)
- Tabel transaksi terbaru (5-10 item)
- Status modal: berapa di kas, berapa floating di G2G, berapa di Direct belum cair
- Quick action buttons (khusus Admin): + Transaksi G2G, + Transaksi Direct, + Penarikan

### 6.3 Input Transaksi (Admin Only)

#### Form Transaksi G2G

- Tanggal transaksi
- Game name
- Jumlah gold
- Harga beli per unit (IDR)
- Harga jual per unit (IDR & USD — konversi otomatis berdasarkan kurs yang diinput)
- Kurs USD/IDR saat transaksi
- Auto-kalkulasi profit bersih setelah semua fee (real-time, transparan)
- Status: Pending (belum cair) / Completed (sudah cair)
- Catatan

#### Form Transaksi Direct

- Tanggal transaksi
- Game name
- Jumlah gold
- Harga beli per unit (IDR)
- Harga jual per unit ke buyer (IDR)
- Metode pembayaran buyer + fee
- Auto-kalkulasi profit — LANGSUNG masuk modal (Direct = instant)
- Catatan (nama buyer Discord, dsb)

### 6.4 Manajemen Modal & Float Tracking

Ini adalah fitur baru yang tidak ada di versi lama. Satu pool modal, tapi dengan tracking alokasi:

- **Kas Liquid** = modal yang siap digunakan transaksi baru
- **Float G2G** = uang yang sudah terjual tapi belum cair (transaksi pending)
- **Float Direct** = profit direct yang belum ditransfer ke kas (jika relevan)

Logika:
- Setiap transaksi G2G baru: kurangi kas, tambah float G2G
- Saat transaksi G2G completed: kurangi float G2G, tambah kas + profit
- Setiap transaksi Direct: tidak mengubah kas (beli langsung → jual → profit masuk kas)
- Log penarikan G2G: kurangi saldo G2G dengan biaya withdrawal yang akurat

### 6.5 Rekap & Laporan

- **Rekap Mingguan:** profit per minggu, jumlah transaksi, total volume gold, breakdown G2G vs Direct
- **Log Penjualan:** tabel semua transaksi dengan filter tanggal, channel, status, game
- **Profit Sharing:** kalkulasi distribusi ke operasional dan per investor, per minggu
- **Kas & Saldo:** grafik aliran kas, total modal berputar, total revenue, total pengeluaran
- **Log Operasional:** semua pengeluaran operasional + kategori + chart breakdown

### 6.6 Kalkulator (Halaman Tersendiri)

- Kalkulator G2G: Arah 1 (beli → posting) dan Arah 2 (kompetitor → maks beli)
- Kalkulator Direct: Arah 1 (beli → min tawar) dan Arah 2 (tawar buyer → maks beli)
- Kalkulator Profit Sharing: simulasi distribusi profit
- Semua kalkulator menampilkan breakdown fee yang lengkap dan transparan
- Tombol "Gunakan sebagai Transaksi" — klik langsung buka form input dengan nilai terisi

### 6.7 Setting & Konfigurasi (Admin Only)

- Kelola fee G2G: ubah rank, commission %, VAT %, withdrawal method & fee — semua disimpan di DB
- Kelola profit sharing: ubah % operasional, tambah/hapus investor
- Manajemen user: tambah user baru (investor/admin), reset password, nonaktifkan user
- Konfigurasi modal awal (set saldo kas, set floating G2G jika ada saldo lama)

---

## 7. Panduan UI/UX

### 7.1 Design Language

- Pertahankan dark gold aesthetic dari versi lama — ini sudah bagus dan berkarakter
- Color palette: obsidian (#0A0A0B), gold (#C9A84C), gold-light (#E8C96B), success (#52C97A), danger (#E05252)
- Typography: Cormorant Garamond (serif, untuk heading/angka besar) + Inter (sans, untuk body/UI)
- Component library: shadcn/ui sebagai base, dikustomisasi dengan gold theme

### 7.2 Layout & Navigasi

- Desktop: Sidebar floating (seperti versi lama) — collapse/expand
- Mobile: Bottom navigation bar iOS-style (seperti versi lama) + top nav bar
- Responsive breakpoints: 480px (small mobile), 900px (mobile/desktop split), 1200px (tablet)
- Topbar: nama halaman + badge live/offline + tanggal + avatar user + logout

### 7.3 UX Kritis

- Kalkulator: hasil kalkulasi real-time (onChange, bukan onSubmit) — seperti versi lama
- Form transaksi: preview profit real-time sebelum simpan
- Status AMAN/RUGI di kalkulator dengan warna dan ikon yang jelas
- Loading states dan skeleton UI saat fetch data
- Toast notification untuk aksi berhasil/gagal
- Konfirmasi dialog untuk hapus data
- Investor view: sembunyikan semua elemen admin (tombol input, setting, kalkulator)

---

## 8. Alur Bisnis & User Stories

### 8.1 Alur G2G (Paling Umum)

1. Admin buka Kalkulator G2G
2. Input: harga beli dari Telegram + harga kompetitor di G2G + jumlah gold
3. Sistem tampilkan: harga posting minimum, maks beli farmer, estimasi profit dengan breakdown fee
4. Admin deal dengan farmer di Telegram
5. Admin input transaksi baru — status: Pending, kas berkurang
6. Gold terkirim, listing di G2G
7. 3–7 hari: buyer di G2G konfirmasi, status jadi Completed, float G2G berkurang, saldo G2G naik
8. Admin input withdrawal — saldo G2G dikurangi withdrawal fee yang akurat (% + fixed IDR 19,999)
9. Dana masuk rekening, kas naik

### 8.2 Alur Direct (Discord)

1. Ada buyer Discord tawar sekian IDR/unit
2. Admin buka Kalkulator Direct
3. Input harga tawar buyer + jumlah gold + metode bayar
4. Sistem tampilkan: harga maks beli farmer, estimasi profit
5. Admin deal farmer di Telegram, bayar modal
6. Gold kirim ke buyer, buyer bayar
7. Admin input transaksi Direct — profit LANGSUNG tambah ke kas (instan)

### 8.3 Alur Investor Melihat Laporan

1. Investor login dengan email mereka
2. Langsung masuk Dashboard read-only
3. Bisa navigasi ke: Log Penjualan, Rekap Mingguan, Profit Sharing, Kas & Saldo
4. Tidak bisa akses: Kalkulator, Input Transaksi, Setting
5. Semua data real-time dari Supabase

---

## 9. Rencana Migrasi dari Versi Lama

### 9.1 Data yang Perlu Dimigrasi

- Data historis dari Google Sheets: ekspor ke CSV, kemudian import ke Supabase
- Mapping kolom Sheets → skema Supabase baru (perlu review manual untuk memastikan konsistensi)
- Fee config lama: masukkan ke tabel fee_config sebagai baseline
- Saldo modal awal: input manual via halaman Setting → Konfigurasi Modal

### 9.2 Hal yang Tidak Dimigrasi

- UI komponen HTML lama — semua dibuat ulang dengan Next.js + shadcn/ui
- Logika kalkulasi lama yang salah — diganti dengan formula baru yang akurat
- Hardcoded names & fee rates — dipindah ke DB yang dinamis

---

## 10. Roadmap Pengembangan

| Fase | Scope | Estimasi | Output |
|------|-------|----------|--------|
| **Fase 0**<br>Persiapan | • Setup Supabase project & schema<br>• Setup Next.js + Tailwind + shadcn/ui<br>• Setup auth & RLS<br>• Deploy ke Vercel (staging) | 3–5 hari | Project foundation siap, login berfungsi |
| **Fase 1**<br>Core Calculator | • Kalkulator G2G dengan formula baru (akurat)<br>• Kalkulator Direct<br>• Tabel fee_config di DB<br>• Setting fee di UI | 3–5 hari | Kalkulator 100% akurat, fee dari DB |
| **Fase 2**<br>Transaksi & Modal | • Form input transaksi G2G & Direct<br>• Modal tracking (kas, float G2G)<br>• Form withdrawal dengan fee akurat<br>• Log transaksi (tabel + filter) | 5–7 hari | Bisa input transaksi, modal ter-track |
| **Fase 3**<br>Dashboard & Laporan | • Dashboard utama (hero stats, charts)<br>• Rekap mingguan<br>• Profit sharing kalkulasi + laporan<br>• Log operasional<br>• Kas & Saldo halaman | 5–7 hari | Semua laporan berfungsi |
| **Fase 4**<br>Investor & Polish | • Role investor (read-only view)<br>• Manajemen user di admin setting<br>• UI polish, mobile responsiveness<br>• Migrasi data dari Sheets<br>• Testing & bug fix | 4–6 hari | Production ready |

**→ Total estimasi: 20–30 hari kerja tergantung intensitas development dengan Claude Code**

---

## 11. Pertanyaan Terbuka & Hal yang Perlu Dikonfirmasi

SEBELUM mulai build, Agus perlu klarifikasi ini:

| # | Pertanyaan | Jawaban | Status |
|---|-----------|---------|--------|
| 1 | Apakah operational expenses itu dipotong SEBELUM atau SESUDAH profit sharing ke investor? | Dipotong SEBELUM | ✅ |
| 2 | Metode withdrawal? | DOKU Bank Transfer | ✅ |
| 3 | Semua transaksi dalam mata uang apa? | IDR (tidak ada USD) | ✅ |
| 4 | Apakah ada game lain atau hanya satu? | 1 game | ✅ |
| 5 | Profit sharing default? | Input manual, bisa dikarang | ✅ |
| 6 | Profit Direct langsung masuk atau pending? | Bisa langsung atau pending | ✅ |

---

## 12. Kesimpulan & Next Steps

PRD ini mendefinisikan rebuild LUCI Gold dari single-file HTML ke aplikasi full-stack yang proper. Poin-poin kritis yang harus diselesaikan sebelum mulai coding:

1. **Operational expenses:** dipotong SEBELUM profit sharing ✅
2. **Withdrawal:** DOKU Bank Transfer ✅
3. **Semua transaksi dalam IDR** (tidak ada USD) ✅
4. **1 game untuk v2.0** ✅
5. **Profit sharing:** default di setting, bisa diubah ✅
6. **Profit Direct:** bisa langsung atau pending ✅

### Next Steps (Siap Build!)

1. **Setup Supabase project** — buat akun di supabase.com (free tier cukup)
2. **Setup Vercel account** untuk deployment
3. **Install Claude Code:** `npm install -g @anthropic-ai/claude-code`
4. **Mulai Fase 0:** project initialization + database schema setup
5. **Start building dengan Claude Code** — fase per fase sesuai roadmap (20–30 hari kerja)

---

**⬡ LUCI Gold v2.0 ⬡**

PRD ini adalah dokumen hidup — akan diperbarui seiring development berlangsung.
