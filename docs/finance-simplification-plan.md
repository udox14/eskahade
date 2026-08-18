# Rencana Penyederhanaan Modul Keuangan Terpusat

Status dokumen: **rencana, belum dieksekusi.** Implementasi menunggu persetujuan.
Tanggal: 18 Agustus 2026. Revisi 2.

Perubahan dari revisi 1, atas keputusan pemilik sistem:
1. **Double-entry dipertahankan penuh.** Yang disederhanakan adalah cara operator
   memakainya, bukan ledger-nya.
2. **Relasi wali–banyak-anak dipertahankan.** Satu wali tetap bisa mengelola
   beberapa santri dengan satu login.
3. **Metode kredensial: QR Code.**

---

## 1. Konfirmasi status go-live

Diverifikasi langsung ke database produksi (bukan dari dokumen), 18 Agu 2026:

```
eskahade-db  → app_settings.finance_legacy_mode
{"new_system_enabled":false,"pilot_asrama":null,
 "legacy_new_writes_disabled":false,"auto_wallet_worker_disabled_cohorts":[]}
```

```
eskahade-finance → jumlah baris          → struktur
finance_journals            0            49 tabel
finance_journal_entries     0            24 trigger
finance_wallet_movements    0
finance_withdrawals         0
finance_student_wallets     0
finance_payment_intents     0
finance_gateway_events      0
finance_payouts             0
finance_payroll_items       0
finance_cash_units          0

finance_bills             612            (semua OPEN, dibuat 16–18 Agu 2026)
student_credentials         2
finance_guardians           2
```

**Sistem belum go-live dan belum pernah ada satu rupiah pun yang bergerak.**
612 tagihan `OPEN` adalah keluaran cron service-billing yang baru di-commit dua hari
lalu dan bisa digenerate ulang; 2 credential + 2 guardian adalah artefak uji.

Pendekatan: **reset skema bersih**, bukan migrasi data. `FINANCE_DB` tetap terpisah
dari `DB`.

> **Gerbang ulang sebelum eksekusi.** Angka di atas dicek ulang tepat sebelum Fase 1.
> Bila `finance_journals`, `finance_wallet_movements`, `finance_withdrawals`, atau
> `finance_payment_intents` sudah tidak nol, **berhenti** dan laporkan — pendekatannya
> berubah total.

---

## 2. Prinsip revisi ini: ledger tetap ketat, operator tidak pernah melihatnya

Beban kerumitan double-entry bagi pengurus non-perbankan **bukan** terletak pada
adanya debit dan kredit. Bebannya terletak pada tiga hal:

1. Operator diminta *memilih akun* saat mencatat sesuatu.
2. Layar utama menampilkan bahasa akuntansi (jurnal, debit, kredit, kode akun).
3. Kalau salah, operator diminta menyusun sendiri jurnal koreksinya.

Ketiganya bisa dihilangkan **tanpa menyentuh ledger sama sekali**. Karena itu
revisi ini:

- **Mempertahankan utuh:** `finance_accounts` (17 akun), `finance_journals`,
  `finance_journal_entries`, `finance_account_balances`, validasi debit=kredit,
  larangan saldo akun negatif, larangan saldo dompet negatif, immutability jurnal
  `POSTED`, dan koreksi lewat jurnal lawan.
- **Menambahkan satu lapisan di atasnya:** katalog resep jurnal (§2.1), sehingga
  tidak ada satu pun titik di aplikasi tempat manusia mengetik kode akun.
- **Menyederhanakan yang di luar ledger:** payroll, payout, rekonsiliasi,
  kredensial, dan membuang fitur kelas bank yang memang tidak dipakai.

Temuan yang mengubah rencana awal saya: **15 dari 17 kode akun benar-benar dipakai
oleh kode** (`1103 Kas Pusat` oleh payout metode tunai, `9999 Suspense` oleh payout
fallback dan pemeriksaan tutup buku di `periods.ts`). Bagan akun bukan bloat, jadi
tidak dipangkas.

Ringkasan angka revisi 2:

| | Sebelum | Sesudah | |
|---|---|---|---|
| Tabel `finance_*` | 49 | 37 | −12 |
| Trigger SQL | 24 | 20 | −4 |
| Baris DDL inti (`0001`) | 862 | ±620 | |
| Kode akun | 17 | 17 | tetap |
| **Titik di aplikasi tempat operator memilih akun** | 4 | **0** | −4 |
| Halaman dashboard keuangan | 15 | 13 | −2 |

Angka trigger sengaja hampir tidak bergerak. Trigger yang tersisa adalah persis
trigger yang menjaga uang: keseimbangan jurnal, saldo tak boleh negatif, limit
penarikan, larangan self-approval. Yang dibuang hanya yang bersifat upacara.

---

## 3. Skema DB: sebelum vs sesudah

### 3.1 Ledger — struktur tetap, pemakaian dibungkus katalog resep

`finance_accounts`, `finance_journals`, `finance_journal_entries`,
`finance_account_balances` **tidak berubah sama sekali**. Trigger berikut
dipertahankan apa adanya:

| Trigger | Fungsi | Status |
|---|---|---|
| `trg_finance_journal_period_open` | tolak posting ke periode tertutup | tetap |
| `trg_finance_entry_draft_only` | entry hanya boleh masuk ke jurnal DRAFT | tetap |
| `trg_finance_entry_no_update` / `no_delete` | entry immutable | tetap |
| `trg_finance_journal_validate_post` | debit=kredit, ≥2 baris, akun & dompet tak negatif | tetap |
| `trg_finance_journal_apply_balances` | materialisasi saldo akun | tetap |
| `trg_finance_journal_posted_immutable` / `no_delete` | jurnal POSTED immutable | tetap |
| `trg_finance_topup_journal_requires_paid_intent` | topup wajib punya intent PAID | tetap |

Alur dua tahap `DRAFT → POSTED` juga dipertahankan. Itu bukan kerumitan bagi
operator — ia tidak pernah terlihat, dan di SQLite memang tidak ada cara lain
memvalidasi keseimbangan sebelum baris anaknya ada.

**Yang baru: `lib/finance/postings.ts`** — katalog resep jurnal, satu-satunya tempat
di seluruh aplikasi yang menyebut kode akun.

```ts
// Bahasa bisnis di kiri, akuntansi di kanan. Operator hanya melihat yang kiri.
export const RESEP = {
  TOPUP_WALI: {
    label: 'Wali isi saldo',
    debit: '1102',            // Clearing Gateway
    credit: '2101',           // Titipan Wali
    wallet: { kind: 'TITIPAN', arah: '+' },
  },
  ALOKASI_SPP: {
    label: 'Bayar tagihan SPP',
    debit: '2101',            // Titipan Wali berkurang
    credit: '4101',           // Pendapatan SPP
    wallet: [{ kind: 'TITIPAN', arah: '-' }, { kind: 'SPP', arah: '+' }],
  },
  TARIK_JAJAN_LOKET: {
    label: 'Ambil uang jajan di loket',
    debit: '2105', credit: '1104',
    wallet: { kind: 'JAJAN', arah: '-' },
  },
  // ... satu entri per kejadian bisnis, ±18 entri total
} as const
```

Konsekuensi konkret:

- `lib/finance/wallet.ts` hari ini punya `DESTINATION_ACCOUNT` sendiri;
  `payouts.ts` punya fungsi `payableAccount()` sendiri; `payroll.ts`, `payments.ts`,
  `settlement.ts`, `withdrawal.ts` masing-masing menuliskan kode akun inline.
  **Empat definisi terpencar itu digabung jadi satu katalog.**
- Halaman `ledger/actions.ts` hari ini memungkinkan bendahara menyusun jurnal manual
  baris per baris dengan memilih kode akun. **Layar itu diganti**: bendahara memilih
  dari daftar resep berlabel bahasa Indonesia, mengisi nominal dan keterangan.
  Jurnal manual bebas-akun hanya tersisa untuk peran auditor, di balik satu layar
  terpisah yang jarang dibuka.

**UI: dua lapis tampilan.** Halaman `ledger/` diganti `transaksi/`:

- *Lapis operasional (default, dilihat semua pengurus):* tabel bahasa manusia —
  Tanggal · Santri/Pihak · Jenis · Masuk/Keluar · Nominal · Saldo. Tidak ada kata
  "debit", "kredit", atau kode akun di layar ini.
- *Lapis akuntansi (tombol "Lihat jurnal", hanya bendahara & auditor):* jurnal asli
  dengan pasangan debit–kredit, untuk audit dan tutup buku.

Laporan bulanan memakai `finance_account_balances` dan agregasi per akun — tetap
seimbang secara struktural, tapi disajikan dengan label bahasa Indonesia
("Pendapatan SPP", "Utang Pengelola Makan"), bukan kode.

**Koreksi transaksi.** `reverseJournal` yang ada dipertahankan (jurnal lawan,
alasan wajib ≥10 karakter, satu reversal per jurnal). Yang berubah hanya
pembungkusnya: operator menekan "Batalkan transaksi", mengisi alasan, dan sistem
menyusun jurnal lawannya sendiri. Operator tidak pernah menyusun jurnal koreksi
secara manual.

Perubahan skema di area ini: **nihil.**

### 3.2 Periode & tutup buku

`finance_periods` dipertahankan. Yang dihapus hanya persyaratan dua approval
untuk membuka kembali periode tertutup:

- **Dihapus:** tabel `finance_period_reopen_approvals` + trigger
  `trg_finance_period_reopen_two_approvals`.
- **Diganti kolom** di `finance_periods`: `reopened_at`, `reopened_by`,
  `reopen_approved_by`, `reopen_reason` (wajib terisi, divalidasi aplikasi).

Satu approval + alasan tercatat, sesuai brief.

### 3.3 Dompet santri — struktur tetap, satu SQL rumit dihilangkan

`finance_student_wallets` dan `finance_wallet_movements` dipertahankan, termasuk
seluruh trigger penjaganya (`validate`, `no_update`, `no_delete`). `wallet_kind`
tetap `TITIPAN, SPP, USPP, NON_SPP, MAKAN, LAUNDRY, JAJAN`.

Satu perbaikan teknis: `trg_finance_journal_apply_wallets` saat ini berisi ±20 baris
subquery berkorelasi hanya untuk mengisi `balance_before`/`balance_after` ketika satu
jurnal punya beberapa pergerakan pada dompet yang sama. Kasus itu tidak pernah
terjadi — setiap resep jurnal menyentuh tiap dompet paling banyak sekali. Dengan
menambahkan:

```sql
CREATE UNIQUE INDEX uq_finance_wallet_movement_per_journal
  ON finance_wallet_movements(journal_id, santri_id, wallet_kind);
```

perhitungan `balance_before`/`balance_after` runtuh menjadi ekspresi empat baris.
Perilakunya identik; yang hilang hanya SQL yang tidak ada yang bisa membacanya.

### 3.4 Kredensial santri — QR Code, satu metode

```sql
-- Sebelum
mode TEXT CHECK (mode IN ('RFID','QR','HYBRID','BOTH_TRANSITION')),
transition_from TEXT, transition_to TEXT, transition_ends_at TEXT,

-- Sesudah
mode TEXT NOT NULL DEFAULT 'QR' CHECK (mode = 'QR'),
```

Keputusan: **QR Code.** Tiga kolom transisi dihapus. `student_credentials.credential_kind`
dipersempit menjadi `QR_STATIC` saja; status `SUSPENDED_BY_POLICY` dibuang dari CHECK
(hanya dipakai mekanisme transisi). Seluruh logika "scan pertama setelah batas waktu
menyelesaikan transisi secara atomik" di `lib/finance/credentials.ts` dihapus.

Yang **tetap** karena menyangkut keamanan uang anak di bawah umur:
token QR disimpan terenkripsi dengan `FINANCE_ENCRYPTION_KEY`, pencocokan tetap lewat
HMAC, token mentah tidak pernah dikirim ke client saat export kartu, dan credential
berstatus `LOST`/`REVOKED` tidak pernah bisa diaktifkan kembali.

`mode` disimpan sebagai kolom (bukan dihapus) supaya penambahan RFID di kemudian hari
tidak butuh migrasi ulang — cukup melonggarkan satu CHECK.

Cetak kartu (`finance_credential_batches`, `finance_credential_batch_items`,
`app/api/finance/credentials/cards/route.ts`, PDF A4 8 kartu CR80 per lembar)
dipertahankan utuh; jalur RFID di dalamnya dihapus.

### 3.5 Wali — relasi banyak anak **dipertahankan**

Revisi dari rencana awal. `finance_guardians` dan `finance_guardian_students`
**tetap ada dengan relasi many-to-many**, sehingga satu wali dengan tiga anak tetap
punya satu login dan tombol "ganti santri" di portal ortu tetap berfungsi.

Yang disederhanakan hanya tingkat akses berjenjang:

```sql
-- Sebelum
access_level TEXT NOT NULL DEFAULT 'VIEW'
  CHECK (access_level IN ('PRIMARY_FINANCE','VIEW','NOTIFY')),
CREATE UNIQUE INDEX uq_finance_primary_guardian
  ON finance_guardian_students(santri_id) WHERE access_level='PRIMARY_FINANCE';

-- Sesudah — kolom dihapus; setiap wali yang tertaut punya hak penuh atas santrinya
```

Alasan: tiga tingkat akses berarti pengurus harus memutuskan, per pasangan
wali–santri, siapa yang boleh membayar dan siapa yang hanya melihat. Itu keputusan
yang tidak punya dasar operasional di pesantren ini dan hampir pasti diisi asal.
Menautkan atau melepas wali dari santri adalah kendali yang cukup, dan itu keputusan
yang pengurus memang paham.

`relationship` (ayah/ibu/paman) tetap ada sebagai keterangan.

**Tidak ada file portal ortu yang dihapus.** `switch-actions.ts` dan
`_switch-student-button.tsx` dipertahankan.

### 3.6 Payroll guru — dari presensi-per-sesi ke potongan alfa/badal

**Dihapus:** `finance_payroll_policies` (versi kebijakan, `threshold_percent`,
`substitute_percent`, `default_session_rate_rupiah`) dan `finance_teaching_attendance`
(absensi per sesi + verifikasi per baris + lock periode).

```sql
CREATE TABLE finance_teacher_compensation (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  monthly_salary_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (monthly_salary_rupiah>=0),
  alfa_deduction_per_day_rupiah  INTEGER NOT NULL DEFAULT 0 CHECK (alfa_deduction_per_day_rupiah>=0),
  badal_deduction_per_day_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (badal_deduction_per_day_rupiah>=0),
  created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(teacher_id, effective_from)
);

CREATE TABLE finance_payroll_periods (
  id TEXT PRIMARY KEY, period_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','DIHITUNG','DISETUJUI','DIBAYAR')),
  approved_by TEXT, approved_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE finance_payroll_items (
  id TEXT PRIMARY KEY,
  payroll_period_id TEXT NOT NULL REFERENCES finance_payroll_periods(id),
  teacher_id TEXT NOT NULL,
  monthly_salary_rupiah INTEGER NOT NULL DEFAULT 0,
  alfa_days  INTEGER NOT NULL DEFAULT 0 CHECK (alfa_days>=0),
  badal_days INTEGER NOT NULL DEFAULT 0 CHECK (badal_days>=0),
  deduction_rupiah INTEGER NOT NULL DEFAULT 0,
  net_rupiah INTEGER NOT NULL CHECK (net_rupiah>=0),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'DIHITUNG'
    CHECK (status IN ('DIHITUNG','DISETUJUI','DIBAYAR','GAGAL')),
  payout_id  TEXT REFERENCES finance_payouts(id),
  journal_id TEXT REFERENCES finance_journals(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(payroll_period_id, teacher_id)
);
```

Rumus tunggal, tanpa mode kebijakan:
```
potongan = alfa_days × alfa_per_hari + badal_days × badal_per_hari
bersih   = max(0, gaji_bulanan − potongan)
```
Guru yang dibayar penuh: biarkan kedua tarif potongan `0`. Operator hanya mengetik
dua angka per guru per bulan.

Akrual payroll tetap masuk ledger lewat resep `PAYROLL_AKRUAL`
(debit `5102` Beban Payroll, kredit `2104` Utang Payroll) — persis seperti sekarang,
hanya sumber angkanya yang disederhanakan.

### 3.7 Pencairan (payout) — maker-checker-executor → maker-checker

| | Sebelum | Sesudah |
|---|---|---|
| Status | `DRAFT, SUBMITTED, CHECKED, EXECUTING, PROVIDER_SUCCESS, RECONCILED, FAILED, CANCELLED` | `DRAFT, DIAJUKAN, DISETUJUI, DIBAYAR, GAGAL, DIBATALKAN` |
| Peran | `maker_id`, `checker_id`, `executor_id` | `maker_id`, `checker_id` |
| Trigger | 3 | 1 |
| Cooling period | 24 jam sebelum rekening bisa dipakai | dihapus |

`trg_finance_payout_no_self_check` **dipertahankan** (disederhanakan: hanya cek
`maker_id <> checker_id`). Itu satu-satunya kendali nyata pada uang keluar dan mudah
dipahami: yang minta bukan yang setuju. Peran executor dihapus — setelah `DISETUJUI`,
checker yang sama menekan bayar.

Dihapus: `trg_finance_payout_recipient_ready`, `trg_finance_payout_insert_recipient_ready`,
kolom `finance_recipients.usable_after`, status `FROZEN`. Nomor rekening tetap
terenkripsi.

### 3.8 Rekonsiliasi bank — import otomatis → checklist manual

**Dihapus:** `finance_reconciliation_imports` (file-hash, parsing) dan
`finance_bank_transactions` (auto-matching per baris).

```sql
CREATE TABLE finance_reconciliation_checks (
  id TEXT PRIMARY KEY,
  period_key TEXT NOT NULL,
  bank_account_label TEXT NOT NULL,
  system_total_rupiah INTEGER NOT NULL,       -- dari finance_account_balances
  statement_total_rupiah INTEGER NOT NULL,    -- diketik operator dari rekening koran
  difference_rupiah INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COCOK','SELISIH','DIJELASKAN')),
  note TEXT,
  checked_by TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(period_key, bank_account_label)
);
```

Sistem menampilkan saldo akun `1101 Rekening Utama` per akhir bulan, operator
mengetik saldo rekening koran, sistem menghitung selisih. Selisih ≠ 0 wajib diberi
catatan penjelasan sebelum periode boleh ditutup.

### 3.9 Dihapus total

| Tabel | Alasan |
|---|---|
| `finance_break_glass` | akses darurat admin teknis |
| `finance_staff_mfa` | MFA/WebAuthn staf |
| `finance_staff_sessions` | session 8 jam terpisah dari session aplikasi |
| `finance_auth_attempts` | rate-limit login terpisah |
| `finance_outbox` | belum ada satu pun consumer |
| `finance_incident_modes` | mode darurat + approval workflow terpisah |
| `finance_incident_receipts` | kuitansi mode darurat |
| `finance_period_reopen_approvals` | reopen cukup 1 approval → jadi kolom |
| `finance_payroll_policies` | versi kebijakan payroll |
| `finance_teaching_attendance` | presensi per sesi |
| `finance_reconciliation_imports` | import rekening koran otomatis |
| `finance_bank_transactions` | auto-matching per baris |
| `finance_staff_snapshots` | nama staf bisa di-resolve saat render |

13 tabel dihapus, 1 ditambah (`finance_reconciliation_checks`) → **49 menjadi 37.**

### 3.10 Dipertahankan utuh

`finance_accounts`, `finance_journals`, `finance_journal_entries`,
`finance_account_balances`, `finance_periods`, `finance_student_wallets`,
`finance_wallet_movements`, `finance_guardians`, `finance_guardian_students`,
`finance_bills`, `finance_allocations`, `finance_allocation_bill_items`,
`finance_service_tariffs`, `finance_service_arrears_historis`,
`finance_service_bill_skip`, `finance_payment_intents`, `finance_gateway_events`,
`finance_student_security` (PIN), `finance_withdrawal_limits` (**tetap 3 limit:
harian/mingguan/bulanan**), `finance_cash_units`, `finance_cash_unit_operators`,
`finance_cash_shifts`, `finance_withdrawals`, `student_credentials`,
`finance_credential_policy`, `finance_credential_batches`,
`finance_credential_batch_items`, `finance_recipients`, `finance_payouts`,
`finance_audit_log`, `finance_settings`, `finance_student_snapshots`,
`finance_teacher_snapshots`.

`trg_finance_withdrawal_validate` dipertahankan **utuh tanpa perubahan** — shift
terbuka, operator cocok, cap per transaksi, kelipatan denominasi, saldo cukup, dan
ketiga limit harian/mingguan/bulanan. Ia yang menegakkan limit secara atomik terhadap
race dua loket; tidak boleh dipindah ke lapisan aplikasi.

### 3.11 Trigger sesudah: 24 → 20

**Dibuang (4):** `trg_finance_period_reopen_two_approvals`,
`trg_finance_payout_recipient_ready`, `trg_finance_payout_insert_recipient_ready`,
dan satu trigger transisi kredensial di `0002`.

**Disederhanakan (2):** `trg_finance_journal_apply_wallets` (±20 baris → ±4),
`trg_finance_payout_no_self_check` (buang cek executor).

**Tetap apa adanya (18):** seluruh penjaga ledger, dompet, tagihan, dan penarikan.

---

## 4. Daftar file: dihapus / disederhanakan / dipertahankan

### 4.1 Migrasi

| Aksi | File |
|---|---|
| Arsipkan | `migrations-finance/0001`–`0009` → `migrations-finance/_archive/` (referensi, tidak dijalankan lagi) |
| Tulis baru | `migrations-finance/0001_finance_core.sql` — ±620 baris; ledger disalin apa adanya dari `0001` lama, sisanya hasil §3 |
| Tulis baru | `migrations-finance/0002_demo_sandbox_reset.sql` — port dari `0004` lama |
| Tulis baru | `scripts/reset-finance-db.sql` — `DROP TABLE IF EXISTS` untuk 49 tabel lama |
| Sesuaikan | `migrations/0120_finance_application_bridge.sql` — verifikasi tidak menyentuh tabel yang dihapus |

### 4.2 `lib/finance/` — 44 file

**Dihapus (2):** `incidents.ts` (mode insiden), `reconciliation.ts` (import + auto-match).

**Ditulis baru (2):**
- `postings.ts` — katalog resep jurnal, ±18 entri. **Satu-satunya file yang menyebut kode akun.**
- `reconciliation-check.ts` — checklist bulanan, ±60 baris (menggantikan 90 baris auto-match).

**Ditulis ulang (5):**
- `payroll.ts` (141 → ±70) — buang kalkulasi sesi, policy, attendance
- `payouts.ts` (163 → ±110) — buang executor + cooling period; `payableAccount()` pindah ke `postings.ts`
- `access.ts` (99 → ±60) — buang break-glass; `FinancePermission` jadi `VIEW|CREATE|CHECK|CONFIGURE`
- `credentials.ts` (159 → ±100) — QR saja, buang seluruh jalur RFID & transisi
- `snapshots.ts` (68 → ±45) — buang staff snapshot

**Disesuaikan ringan — pakai `postings.ts`, berhenti menulis kode akun inline (7):**
`wallet.ts` (buang `DESTINATION_ACCOUNT`), `withdrawal.ts`, `payments.ts`,
`settlement.ts`, `portal-confirm.ts`, `periods.ts` (reopen 1 approval),
`portal-guardian-sync.ts` (buang `access_level`)

**Dipertahankan utuh (15):**
`ledger.ts` (**logika tidak disentuh** — satu-satunya perubahan: konstanta
`ACCOUNT_IDS` dipindah ke `postings.ts` lalu di-import kembali; `postJournal`,
`prepareJournalStatements`, `prepareWalletStatements`, `validateJournal`,
`reverseJournal` tidak berubah satu baris pun),
`reversals.ts`, `banks.ts`, `bulk.ts`, `credential-batches.ts`, `encryption.ts`,
`errors.ts`, `exemptions.ts`, `idempotency.ts`, `santri-search.ts`,
`scanner-client.ts`, `service-tariffs.ts`, `billing.ts`, `service-billing.ts`,
`spp-billing-sync.ts`, `portal-bills-sync.ts`, `portal-history.ts`

**Ditambahkan ke daftar kerja (4)** — sebelumnya keliru saya masukkan "utuh":
- `types.ts` — union `AccountCode` pindah ke `postings.ts` (lihat T3), sisanya
  membuang tipe yang tabelnya hilang
- `dashboard.ts` — query yang menyentuh outbox/insiden/rekonsiliasi lama
- `work-counts.ts` — hitungan antrean insiden & rekonsiliasi hilang
- **`demo-seed.ts` (185 baris) — ini pekerjaan nyata, bukan "seperlunya".**
  File ini menyentuh **49 nama tabel**, 13 di antaranya dibuang rencana ini
  (`finance_break_glass`, `finance_staff_mfa`, `finance_staff_sessions`,
  `finance_auth_attempts`, `finance_outbox`, `finance_incident_modes`,
  `finance_incident_receipts`, `finance_period_reopen_approvals`,
  `finance_payroll_policies`, `finance_teaching_attendance`,
  `finance_reconciliation_imports`, `finance_bank_transactions`,
  `finance_staff_snapshots`). Praktis ditulis ulang. Ikut pula
  `0002_demo_sandbox_reset.sql` (port dari `0004`), yang saat ini menghapus baris
  dengan cara menonaktifkan trigger `no_delete` — mekanisme itu tetap dipakai karena
  jurnal & pergerakan dompet tetap immutable.

**Zona hati-hati, disentuh terakhir (3):**
`gateway/duitku.ts`, `gateway/index.ts`, `disbursement/duitku.ts` — lihat Fase 5.

### 4.3 `app/dashboard/keuangan-terpusat/`

**Dihapus (6 file, 2 halaman):**
`break-glass/{page.tsx,actions.ts,_break-glass-client.tsx}`,
`insiden/{page.tsx,actions.ts,_incident-client.tsx}`

**Dirombak (3 halaman):**
- `ledger/` → **`transaksi/`** — dua lapis tampilan (§3.1). Penyusun jurnal manual
  bebas-akun dipindah ke sub-layar auditor.
- `payroll/` — UI absensi per sesi diganti tabel "guru | gaji | hari alfa | hari badal | potongan | bersih"
- `payout/` — 3 langkah jadi 2 (Ajukan → Setujui & Bayar)

**Disesuaikan ringan (7):** `kredensial/` (QR saja, buang pilihan mode & transisi),
`operasi/`, `kontrol/` (buang panel insiden & break-glass), `alokasi/`, `loket/`,
`unit-kas/`, `page.tsx`, `_components/finance-nav.tsx` (buang 2 menu, rename 1)

**Dipertahankan utuh (3):** `konfirmasi-spp/`, `konfirmasi-non-spp/`, `tarif-layanan/`

### 4.4 `app/portal-ortu/(app)/keuangan/`

**Tidak ada file yang dihapus** (revisi dari rencana awal).
**Disesuaikan (3):** `actions.ts`, `page.tsx`, `tagihan-actions.ts` — buang cabang
`access_level`; wali yang tertaut selalu punya hak penuh.
**Dipertahankan utuh (14):** termasuk `switch-actions.ts`,
`_switch-student-button.tsx`, `_limit-modal.tsx` (3 limit oleh wali tetap ada),
`_topup-modal.tsx`, `_pin-modal.tsx`.

### 4.5 API, worker, lain-lain

| File | Aksi |
|---|---|
| `app/api/finance/gateway/duitku/callback/route.ts` | **logika tidak disentuh** |
| `app/api/finance/gateway/duitku/payout-callback/route.ts` | idem |
| `app/api/finance/credentials/cards/route.ts` | buang jalur RFID |
| `workers/uang-jajan-auto.ts` | verifikasi; kemungkinan tidak berubah |
| `workers/service-billing-auto.ts` | disesuaikan bila menyentuh tabel yang hilang |
| `lib/pimpinan/keuangan.ts` | disesuaikan — label akun bahasa Indonesia |
| `lib/uang-jajan/auto-potong.ts` | verifikasi pembacaan `finance_legacy_mode` |
| `scripts/test-finance-invariants.mjs` | ditulis ulang (§6) |
| `docs/finance-centralized-rollout.md` | ditulis ulang — runbook lama menyebut MFA, break-glass, cooling period, HYBRID |
| `docs/finance-env.example` | buang secret yang tak terpakai |

---

## 5. Urutan pengerjaan

Prinsip: **Duitku terakhir.** Semua yang lain harus stabil dan lulus uji dulu, supaya
kalau ada masalah di gateway penyebabnya tidak tercampur dengan puluhan perubahan lain.

### Fase 0 — Pengamanan
1. Cek ulang gerbang go-live §1. Berhenti bila sudah ada data uang.
2. Export `eskahade-finance` dan `eskahade-demo-finance` ke `.sql`, simpan di luar repo.
3. Branch `feat/finance-simplification`. Tidak di-merge ke `main` sampai Fase 6 lulus.
4. `new_system_enabled` tetap `false` selama seluruh pengerjaan.

#### 5.0.1 Aturan eksekusi migrasi — pelajaran dari insiden 0007

Ini risiko terbesar rencana ini, dan **bukan hipotetis**: 16 Agu 2026 migrasi `0007`
dijalankan ke `FINANCE_DB` produksi lewat `wrangler d1 execute --file`. `DROP TABLE
finance_bills` sukses, `ALTER TABLE finance_bills_new RENAME TO finance_bills` tidak
sempat commit, dan tabel `finance_bills` **hilang dari skema produksi** sampai
dipulihkan manual lewat `0009`. Dua trigger sempat "menggantung" karena
`CREATE TRIGGER` di SQLite tidak memvalidasi tabel yang hanya disebut di body-nya.

Rencana ini melakukan hal yang **jauh lebih besar** dari `0007`: `DROP` 49 tabel lalu
membangun ulang ±620 baris DDL. Tanpa aturan eksplisit, kegagalan separuh jalan akan
meninggalkan skema yang rusak sebagian dan sulit didiagnosis. Karena itu:

- **Satu langkah = satu file = satu `--file`.** Jangan pernah `--command` berisi
  banyak statement: wrangler/D1 memecah teks `--command` berdasarkan titik koma
  secara naif, sehingga body trigger yang berisi banyak `;` di dalam `BEGIN…END`
  pecah jadi fragmen dan gagal dengan "incomplete input".
- **Pecah jadi berkas berurut, bukan satu berkas raksasa:**
  ```
  0001a_drop_legacy.sql      -- DROP TRIGGER (semua) lalu DROP TABLE (49)
  0001b_core_ledger.sql      -- accounts, journals, entries, balances, periods + trigger
  0001c_wallet.sql           -- wallets, movements + trigger
  0001d_billing.sql          -- bills, allocations, service_* + trigger
  0001e_credential_loket.sql -- credentials, security, limits, cash units, withdrawals + trigger
  0001f_payout_payroll.sql   -- recipients, payouts, payroll, reconciliation_checks + trigger
  0001g_support.sql          -- audit_log, settings, snapshots + seed akun & settings
  ```
  **Urutan wajib: seluruh `DROP TRIGGER` sebelum `DROP TABLE` mana pun**, supaya tidak
  ada trigger menggantung seperti insiden `0009`.
- **Urutan lingkungan: D1 lokal → `DEMO_FINANCE_DB` → `FINANCE_DB`.** Produksi
  disentuh paling akhir, setelah demo terbukti bersih.
- **Verifikasi setelah tiap berkas**, bukan cuma di akhir:
  ```sql
  SELECT type, COUNT(*) FROM sqlite_master WHERE name LIKE 'finance_%'
     OR name='student_credentials' GROUP BY type;
  ```
  Jumlah tabel harus 37 dan trigger 20 setelah `0001g`. Kalau meleset, berhenti.
- **Kriteria berhenti:** kalau satu berkas gagal separuh, jangan jalankan berkas
  berikutnya. Pulihkan dari export Fase 0 langkah 2, jangan menambal manual.

### Fase 1 — Skema baru + katalog resep
5. Tulis `0001_finance_core.sql` baru (ledger disalin apa adanya) + `reset-finance-db.sql`.
6. Tulis `lib/finance/postings.ts`; pindahkan seluruh kode akun yang tersebar ke sana.
7. Sesuaikan `wallet.ts`, `withdrawal.ts`, `payouts.ts`, `payroll.ts`, `payments.ts`,
   `settlement.ts` agar memakai katalog. `ledger.ts` tidak disentuh.
8. **Gerbang:** uji T1–T5 lulus di D1 lokal. Belum menyentuh UI.

### Fase 2 — Pembuangan fitur
9. Hapus break-glass, MFA/session/auth-attempts, outbox, mode insiden.
10. Sederhanakan `access.ts`; hapus 2 halaman dashboard + entri navigasi.
11. Kredensial jadi QR-only; hapus jalur RFID di lib, UI, dan route kartu.
12. Buang cooling period rekening; reopen periode jadi 1 approval; buang `access_level`.
13. **Gerbang:** `npx tsc --noEmit` bersih, `npm run build` lulus.

### Fase 3 — Penyederhanaan modul
14. Payroll: skema + `payroll.ts` + UI. Uji T8.
15. Payout: maker-checker 2 peran + UI. Uji T7.
16. Rekonsiliasi: checklist bulanan + UI baru.
17. **Gerbang:** T1–T8 lulus, build lulus.

### Fase 4 — Lapisan tampilan (inti dari "mudah dilaksanakan user")

> **Peringatan urutan.** Fase ini adalah **satu-satunya fase yang benar-benar
> menjawab tujuan proyek** — menurunkan kompleksitas ke level yang bisa dioperasikan
> pengurus. Fase 1–3 semuanya kerja di balik layar yang tidak akan terasa oleh
> pengurus. Menaruhnya paling akhir berarti kalau tenaga/waktu habis di tengah jalan,
> justru bagian yang paling penting yang tidak jadi. Dan fase ini juga bagian yang
> **paling sedikit dirinci** di rencana ini — belum ada rancangan layar, daftar kolom,
> atau alur klik.
>
> Dua cara mengurangi risikonya, pilih satu sebelum Fase 1 dimulai:
> **(a)** rancang layar `transaksi/` dulu di awal (sekadar sketsa kolom & alur), supaya
> Fase 1–3 tahu bentuk akhirnya; atau
> **(b)** naikkan Fase 4 menjadi setelah Fase 2, sebelum payroll/payout dirombak.
> Rekomendasi saya: **(a)** — lebih murah, dan tidak mengacak urutan gerbang uji.

18. Halaman `transaksi/` dua lapis; layar jurnal manual bebas-akun dipindah ke auditor.
19. Dashboard & laporan bulanan berlabel bahasa Indonesia.
20. **Gerbang:** telusuri seluruh UI keuangan; pastikan nol layar operasional yang
    menampilkan kode akun atau meminta operator memilih akun.

### Fase 5 — Duitku (paling akhir, paling hati-hati)
Aturan fase ini: **jangan menyentuh verifikasi signature, pembentukan
`merchant_order_id`, penanganan replay callback, maupun struktur
`finance_gateway_events` / `finance_payment_intents`.** Karena ledger tidak berubah,
perubahan di sini seharusnya **mendekati nol** — hanya penggantian kode akun inline
dengan resep dari katalog.

21. Ganti titik penyusunan jurnal di `callback/route.ts` dan `payout-callback/route.ts`
    menjadi pemanggilan resep. Diff ditinjau baris per baris.
22. Sesuaikan `payments.ts`, `settlement.ts`, `disbursement/duitku.ts` seperlunya.
23. Uji T9 (idempotency & replay) di sandbox Duitku, **dua kali**: callback ganda
    dengan `event_key` sama, dan `event_key` berbeda tapi `merchant_order_id` sama.
    Keduanya harus menghasilkan tepat satu jurnal.
24. Uji T10 (payout callback) di sandbox.

### Fase 6 — Dokumen & serah terima
25. Tulis ulang `docs/finance-centralized-rollout.md`.
26. Jalankan T1–T11 berurutan di DB demo bersih.
27. Terapkan `reset-finance-db.sql` + `0001` ke `FINANCE_DB` dan `DEMO_FINANCE_DB`.
    **Migrasi dijalankan oleh Anda sendiri**; saya hanya menyiapkan berkasnya.

---

## 6. Cara uji

`scripts/test-finance-invariants.mjs` ditulis ulang: membuat D1 lokal terisolasi,
menerapkan `0001` baru, lalu menjalankan skenario di bawah. Setiap uji memeriksa
**angka saldo akhir**, bukan sekadar "tidak error".

### T1 — Alur inti: tagihan → bayar → dompet → penarikan
```
1. Santri + tagihan SPP Rp 300.000 (OPEN)
2. Topup Rp 500.000 (intent PAID)      → TITIPAN = 500.000
3. Alokasi 300.000 ke SPP              → TITIPAN = 200.000, tagihan PAID
4. Alokasi 200.000 ke JAJAN            → TITIPAN = 0, JAJAN = 200.000
5. Buka shift, tarik 50.000 (PIN benar)→ JAJAN = 150.000
```
**Assert:** `TITIPAN=0`, `JAJAN=150000`, `finance_bills.status='PAID'`,
4 jurnal `POSTED`, dan **untuk setiap jurnal `SUM(DEBIT) = SUM(CREDIT)`**.

### T2 — Ledger tetap seimbang (uji yang dipertahankan dari suite lama)
- Jurnal tidak seimbang ditolak `FINANCE_JOURNAL_UNBALANCED`.
- Jurnal 1 baris ditolak `FINANCE_JOURNAL_MINIMUM_TWO_ENTRIES`.
- `UPDATE`/`DELETE` pada jurnal `POSTED` ditolak `FINANCE_JOURNAL_IMMUTABLE`.
- `UPDATE`/`DELETE` pada entry ditolak `FINANCE_ENTRY_IMMUTABLE`.
- **Assert global di akhir seluruh suite:**
  `SUM(saldo akun ASSET+EXPENSE) = SUM(saldo akun LIABILITY+EQUITY+REVENUE)`.

### T3 — Katalog resep menutup semua jalur
Uji statis: `grep` kode akun 4-digit di seluruh `lib/`, `app/`, `workers/`.
**Assert: satu-satunya file yang cocok adalah `lib/finance/postings.ts`.**
Uji ini yang menjaga agar penyederhanaan tidak bocor kembali seiring waktu.

Catatan pelaksanaan: hari ini kode akun muncul di **10 file**, dan salah satunya
adalah `lib/finance/types.ts` baris 2–5 — union `AccountCode` (`'1101' | '1102' |
… | '9999'`). Union itu **ikut pindah ke `postings.ts`** supaya assert di atas
benar-benar bisa nol-kecuali-satu; `types.ts` cukup me-`re-export` tipenya. Tanpa
langkah ini T3 dijamin gagal sejak hari pertama.

### T4 — Saldo tidak boleh negatif
Tarik 200.000 saat `JAJAN=150.000` → `FINANCE_WALLET_INSUFFICIENT`. Setelah rollback
`JAJAN` **tetap** 150.000; tidak ada baris di `finance_wallet_movements`,
`finance_journal_entries`, maupun `finance_journals`.

### T5 — Koreksi transaksi
Batalkan alokasi dengan alasan ≥10 karakter → 1 jurnal lawan dibuat, `reversal_of_id`
terisi, saldo dompet kembali persis ke nilai sebelumnya, dan **jurnal lawan juga
seimbang**. Membatalkan dua kali ditolak. Alasan <10 karakter ditolak.

### T6 — Limit penarikan (harian / mingguan / bulanan)
Limit `daily=100.000`, `weekly=250.000`, `monthly=400.000`; saldo selalu cukup.
```
a. tarik 60.000 hari ini                              → SUKSES  (harian 60k/100k)
b. tarik 50.000 hari ini                              → TOLAK   DAILY_LIMIT_EXCEEDED
c. tarik 40.000 hari ini                              → SUKSES  (harian tepat 100k)
d. tarik 5.000 hari ini                               → TOLAK   DAILY_LIMIT_EXCEEDED
e. +1 hari, tarik 100.000                             → SUKSES  (mingguan 200k/250k)
f. +1 hari, tarik 60.000                              → TOLAK   WEEKLY_LIMIT_EXCEEDED
g. minggu berikut (bulan sama), tarik 100.000         → SUKSES  (bulanan 300k/400k)
h. hari berbeda, minggu sama, tarik 100.000           → TOLAK   DAILY_LIMIT_EXCEEDED
i. limit NULL                                         → semua lolos selama saldo cukup
```
**Assert:** tiap penolakan tidak meninggalkan baris apa pun;
`SUM(finance_withdrawals)` cocok dengan penurunan saldo `JAJAN`. Batas minggu diuji
khusus untuk Senin–Minggu zona `+7` (titik regresi paling umum).

### T7 — Batas per transaksi & denominasi
Cap 200.000 / denominasi 5.000 → 205.000 ditolak `CAP_EXCEEDED`; 7.500 ditolak
`DENOMINATION`; 5.000 lolos.

### T8 — Payout maker-checker
```
a. maker A ajukan payout MAKAN 5.000.000        → DIAJUKAN
b. A menyetujui sendiri                         → TOLAK FINANCE_SELF_APPROVAL_FORBIDDEN
c. checker B setujui                            → DISETUJUI
d. B tandai dibayar (transfer manual)           → DIBAYAR + 1 jurnal seimbang
                                                  (debit 2102, kredit 1101)
e. tandai dibayar lagi (idempotency sama)       → tetap 1 jurnal
```
**Assert:** tidak ada peran executor di jalur mana pun.

### T9 — Potongan gaji alfa/badal
Guru: `gaji=2.000.000`, `alfa/hari=50.000`, `badal/hari=25.000`.

| Kasus | alfa | badal | potongan | bersih |
|---|---|---|---|---|
| a. hadir penuh | 0 | 0 | 0 | 2.000.000 |
| b. 3 hari alfa | 3 | 0 | 150.000 | 1.850.000 |
| c. 2 badal | 0 | 2 | 50.000 | 1.950.000 |
| d. 3 alfa + 2 badal | 3 | 2 | 200.000 | 1.800.000 |
| e. dibayar penuh (kedua tarif 0) | 5 | 5 | 0 | 2.000.000 |
| f. potongan melebihi gaji | 50 | 0 | 2.500.000 | **0** (tidak negatif) |

**Assert:** setelah `DISETUJUI`, jumlah jurnal `PAYROLL_ACCRUAL` = jumlah guru dengan
`net > 0`, total kredit `2104` = `SUM(net_rupiah)`, guru `net=0` tidak menghasilkan
jurnal.

### T10 — Duitku cash-in: idempotency & replay *(Fase 5)*
```
a. signature valid, event_key X                 → intent PAID, TITIPAN +nominal, 1 jurnal
b. callback identik diulang (event_key X)       → diabaikan, saldo tidak berubah
c. event_key Y, merchant_order_id sama          → diabaikan, saldo tidak berubah
d. signature tidak valid                        → ditolak, nol perubahan
e. callback untuk intent EXPIRED                → ditolak
```
Diuji di sandbox Duitku **dan** sebagai unit test dengan payload tersimpan.

### T11 — Duitku payout callback *(Fase 5)*
Sukses → payout `DIBAYAR`, tepat 1 jurnal. Gagal → `GAGAL`, **nol** jurnal.
Sukses lalu gagal untuk id sama → callback kedua diabaikan.

### T12 — Periode tertutup
Tutup `2026-07`. Posting jurnal `effective_date` Juli → `FINANCE_PERIOD_CLOSED`.
Reopen dengan 1 approval + alasan → posting lolos, `reopen_reason` tercatat.
Reopen tanpa alasan ditolak.

### Uji manual sebelum go-live
Satu siklus penuh dijalankan pengurus di akun demo: sebulan tagihan → wali bayar via
Duitku sandbox → alokasi → penarikan di loket dengan kartu QR → payout ke pengelola
makan → payroll → rekonsiliasi → tutup buku.

**Kriteria lulus khusus revisi ini:** selama seluruh siklus, tidak seorang pun
operator perlu tahu apa itu debit, kredit, atau kode akun. Kalau ada satu layar saja
yang memaksanya, layar itu belum selesai.

### Verifikasi teknis di tiap gerbang
```bash
npm run test:finance && npx tsc --noEmit --pretty false && npm run build
```

---

## 7. Catatan penutup

- Ledger tetap menjadi sumber kebenaran dan tetap seimbang secara struktural.
  Salah kategori tetap tertangkap sistem — ini yang hilang di revisi 1 dan kini kembali.
- Harga yang dibayar: revisi ini lebih besar dari revisi 1 di sisi UI (Fase 4 baru)
  dan lebih kecil di sisi backend (ledger tidak disentuh, `ledger.ts` dan
  `reversals.ts` dipertahankan utuh). Bersihnya kurang lebih setara, dengan hasil
  akhir yang lebih aman.
- Uji **T3** adalah kunci jangka panjang: ia yang mencegah kode akun bocor kembali
  ke lapisan aplikasi enam bulan dari sekarang.
- `FINANCE_DB` tetap terpisah dari `DB`, jadi snapshot santri & guru tetap diperlukan.
- Legacy `santri.saldo_uang_jajan` / `saldo_tabungan` dan
  `migrations/0120_finance_application_bridge.sql` tidak diubah — jalur legacy masih
  satu-satunya yang aktif dan harus tetap utuh.
