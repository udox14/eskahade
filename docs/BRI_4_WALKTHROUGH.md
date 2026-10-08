# Walkthrough BRI-4: Recovery, Settlement & Rekonsiliasi (Harden Final)

## Ringkasan Eksekutif

Fase **BRI-4 — Recovery, Settlement & Reconciliation** telah diselesaikan dan diperketat secara menyeluruh sebagai **SATU PAKET** berdasarkan audit kontrak resmi BRIAPI / SNAP BI v2.1, seluruh invariant arsitektural pada [AGENTS.md](file:///c:/DATA/Codes/eskahade/AGENTS.md), serta [BRI_INTEGRATION_PRD.md](file:///c:/DATA/Codes/eskahade/docs/BRI_INTEGRATION_PRD.md).

Fase ini mematuhi prinsip fundamental perbankan:
1. **`PAID != SETTLED`**: Pembayaran berstatus `PAID` secara mutlak mustahil bertransisi ke `SETTLED` tanpa bukti item settlement riil yang merujuk pada mutasi `CREDIT` Rekening Koran Bank BRI dengan `currency = 'IDR'`.
2. **`UNKNOWN != FAILED`**: Transaksi dengan status unknown tidak dianggap gagal atau dibatalkan sepihak; tidak ada *blind retry*.
3. **No Cross-Product Assumptions**: Sistem **tidak mengasumsikan** bahwa `detailData.transactionId` pada Rekening Koran sama dengan `trxId` pembayaran BRIVA tanpa bukti kontrak onboarding resmi (`CONTRACT_TBD`).
4. **Strong Statement Identity != Payment Identity**: Keberadaan `transactionId` bank hanya memvalidasi identitas baris mutasi (`identity_strength = STRONG`), bukan bukti kecocokan pembayaran. Transisi `SETTLED` tetap mensyaratkan `match_strength = AUTHORITATIVE_EXACT`.
5. **No Student Inference from Statement Remark Regex**: Public Bank Statement SNAP BI v2.1 tidak menyediakan field `virtualAccountNo` atau `customerNo`. Pencocokan regex nomor VA dari kolom berita mutasi diklasifikasikan sebagai `CANDIDATE`. Mutasi kredit tanpa order diposisikan sebagai `UNIDENTIFIED_BANK_CREDIT` (diantrekan ke rekonsiliasi dengan `payment_id = NULL`), tanpa membuat data `finance_payments` fiktif (`BANK_STATEMENT_STUDENT_AUTO_IDENTITY = 'CONTRACT_TBD'`).
6. **4041401 BUKAN Empty Success**: Respons `2001400` dengan `detailData: []` adalah empty fetch sukses (kursor maju); sedangkan `4041401` (Transaction Not Found) adalah provider rejection (status `FAILED`, nol settlement, kursor ditahan).

---

## 1. Service Code Resmi 14 & Outcome Policy

Official BRI Bank Statement SNAP BI v2.1 menggunakan **Service Code 14** (Mutasi Rekening / Account Statement). Seluruh referensi terhadap Service Code 73 telah dihapus.

### Matriks Kode Respon Resmi Service Code 14 (`BRI_BANK_STATEMENT_POLICY`)

| Response Code | Deskripsi Resmi BRI | Klasifikasi Transport & Outcome | Status Fetch DB | Perilaku Kursor | Aksi Sistem |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `2001400` + items | Successful | Sukses (`outcomeKnown: true`) | `COMPLETED` | Maju (`cursor_advanced = 1`) | Ingest transaksi, dedup & jalankan matching engine |
| `2001400` + `[]` | Successful Empty Data | Sukses (`outcomeKnown: true`) | `COMPLETED` | Maju (`cursor_advanced = 1`) | Catat log audit, nol mutasi baru |
| `4001401` | Invalid Field Format | Terminal Rejection (`outcomeKnown: true`) | `FAILED` | Tahan (`cursor_advanced = 0`) | Catat log audit, perbaiki format payload |
| `4001402` | Invalid Mandatory Field | Terminal Rejection (`outcomeKnown: true`) | `FAILED` | Tahan (`cursor_advanced = 0`) | Catat log audit, pastikan field wajib terisi |
| `4011400` | Unauthorized | Auth Failure (`outcomeKnown: false`) | `FAILED` | Tahan (`cursor_advanced = 0`) | Invalidasi cache token B2B, re-authenticate |
| `4041401` | Transaction Not Found | Terminal Rejection (`outcomeKnown: true`) | `FAILED` | Tahan (`cursor_advanced = 0`) | Provider failure / data tidak ditemukan; nol settlement |
| `4091400` | Conflict | Terminal Rejection (`outcomeKnown: true`) | `FAILED` | Tahan (`cursor_advanced = 0`) | Catat investigasi konflik |
| `5001400` | General Error | Suspend / Investigate (`outcomeKnown: false`) | `FAILED` | Tahan (`cursor_advanced = 0`) | Zero blind retry, tahan kursor |
| `5041400` | Gateway Timeout | Pending / Suspend (`outcomeKnown: false`) | `FAILED` | Tahan (`cursor_advanced = 0`) | Zero blind retry, tahan kursor |

---

## 2. Pemisahan Identitas: Fetch `referenceNo` vs Transaction `transactionId`

Top-level `referenceNo` pada respons SNAP BI Bank Statement adalah referensi penarikan (*fetch reference*). Referensi ini dapat berbeda pada setiap penarikan yang saling tumpang tindih (*overlapping fetches*).

### Model Pemisahan Data:
1. **`finance_bri_statement_fetches`**:
   - Menyimpan `fetch_reference_no` secara eksklusif sebagai metadata penarikan API.
   - Tidak pernah dijadikan kunci deduplikasi baris transaksi mutasi.
2. **`finance_bri_statement_transactions`**:
   - Menyimpan bukti transaksi murni per baris:
     - `transaction_id`: Nullable (mengikuti kontrak resmi di mana `transactionId` opsional).
     - `transaction_date_raw`: Tanggal waktu transaksi dari bank.
     - `type_raw`: Teks tipe asli dari bank.
     - `type_normalized`: Nilai kanonikal (`CREDIT` | `DEBIT`).
     - `amount_raw`: Nominal string desimal dari bank (`"153000.00"`).
     - `amount`: Nominal integer Rupiah tervalidasi (`153000`).
     - `currency`: Mata uang (`IDR`).
     - `remark` & `remark_custom`: Catatan mutasi dari bank.
     - `start_balance_raw` & `end_balance_raw`: Bukti saldo awal/akhir bila tersedia.
     - `raw_evidence_hash`: Hash SHA-256 dari seluruh payload baris transaksi.

---

## 3. Kekuatan Identitas & Deduplikasi Non-Destruktif (WEAK Identity)

Karena `transactionId` bersifat opsional pada spesifikasi SNAP BI Bank Statement:

### A. STRONG Identity
- Aktif jika `transactionId` disediakan oleh bank.
- `identity_strength = 'STRONG'`
- `dedup_key = sha256("STRONG|" + accountNo + "|" + transactionId)`
- **Keunikan Basis Data**: Ditegakkan dengan partial unique index:
  ```sql
  CREATE UNIQUE INDEX uq_bri_stmt_tx_strong_dedup
  ON finance_bri_statement_transactions(dedup_key)
  WHERE identity_strength = 'STRONG';
  ```

### B. WEAK Identity & Non-Destructive Dedup
- Aktif jika bank tidak menyediakan `transactionId`.
- `identity_strength = 'WEAK'`
- `dedup_key = sha256("WEAK|" + accountNo + "|" + trxDateTimeRaw + "|" + typeNormalized + "|" + amountRaw + "|" + currency + "|" + remark + ...)`
- `weak_fingerprint = sha256(...)` disimpan untuk keperluan audit dan pengelompokan.
- **Prinsip Non-Destruktif**: Tidak ada constraint `UNIQUE` tabel penuh pada baris WEAK. Jika terdapat mutasi berulang tanpa `transactionId` (misalnya dua transfer Rp100.000 pada detik yang sama):
  - Keduanya disimpan utuh sebagai baris terpisah (nol kehilangan bukti mutasi bank).
  - Ditandai sebagai `match_status = 'AMBIGUOUS'`.
  - Mutlak **dilarang auto-settle** dan tidak digabungkan secara destruktif (*never destructive-merged*).

---

## 4. Parser Strict Type (CREDIT / DEBIT) & Currency Hard Guard

### A. Strict Type Parser
- Fungsi `normalizeStatementType` hanya menerima kata utuh:
  - `"CREDIT"` / `"credit"` $\to$ `'CREDIT'`
  - `"DEBIT"` / `"debit"` $\to$ `'DEBIT'`
- Singkatan seperti `"CR"`, `"DB"`, `"DR"` **secara mutlak ditolak** (*fail-closed* via `STATEMENT_TYPE_ERROR`).
- Kolom tabel diverifikasi dengan constraint:
  ```sql
  CHECK (type_normalized IN ('CREDIT', 'DEBIT'))
  ```

### B. Currency Hard Guard
- Seluruh mutasi rekening, item settlement, dan batch settlement **wajib** menggunakan mata uang Rupiah:
  ```sql
  CHECK (currency = 'IDR')
  ```
- Mutasi atau item dengan mata uang non-IDR ditolak seketika oleh database trigger dan validasi service.

---

## 5. Collection Account Binding

- Konfigurasi otoritatif Koperasi: `BRI_COLLECTION_ACCOUNT_NO`.
- Wajib terdefinisi (*fail-closed*) pada lingkungan produksi (`NODE_ENV === 'production'`).
- Permintaan penarikan mutasi (`fetchBankStatement`) memvalidasi nomor rekening target terhadap rekening collection yang terdaftar; selisih memicu `CONFIG_ERROR`.
- Database trigger `trg_finance_bri_settlement_items_guard` menegakkan bahwa nomor rekening pada batch settlement wajib sama persis dengan nomor rekening transaksi mutasi bank terkait.

---

## 6. Provenance Settlement yang Ditegakkan Basis Data

Pencatatan item settlement pada tabel `finance_bri_settlement_items` mewajibkan metadata asal-usul (*provenance*):

1. **`match_strength`**:
   - `AUTHORITATIVE_EXACT`: Mutasi dengan bukti relasi lintas produk yang telah dikonfirmasi kontrak resmi.
   - `MANUAL_RESOLVED`: Resolusi manual oleh operator berwenang atas kasus rekonsiliasi.
   - Nilai `CANDIDATE`, `AMBIGUOUS`, atau `NO_MATCH` diblokir oleh trigger `trg_finance_bri_settlement_items_guard`.
2. **Audit Trail `MANUAL_RESOLVED`**:
   - Jika `match_strength = 'MANUAL_RESOLVED'`, trigger database mewajibkan:
     - `reconciliation_item_id` terisi (menunjuk kasus rekonsiliasi aktif);
     - `resolved_by` terisi (identitas pengguna yang bertanggung jawab);
     - `resolution_notes` terisi (alasan manual override);
     - `resolved_at` terisi (stempel waktu penyelesaian).
3. **Database Trigger Enforcement**:
   - `trg_finance_payments_prevent_invalid_settled`: Memverifikasi bahwa transisi pembayaran ke `SETTLED` memiliki item settlement dengan `match_strength IN ('AUTHORITATIVE_EXACT', 'MANUAL_RESOLVED')`, `currency = 'IDR'`, dan mutasi bank berstatus `CREDIT`.

---

## 7. Isolasi Kontrak Lintas Produk & Student Auto-Identity Seam

### A. Isolasi Kontrak Lintas Produk
```
BANK_STATEMENT_TRANSACTION_ID ↔ BRIVA_TRX_ID = CONTRACT_TBD
```
- Keberadaan `transactionId` dari bank hanya memvalidasi baris mutasi (`identity_strength = STRONG`).
- Tidak boleh diasumsikan sama dengan `trxId` BRIVA tanpa verifikasi onboarding resmi.
- Matching engine mengklasifikasikan pencocokan tanpa bukti resmi sebagai `CANDIDATE` (dilarang *auto-settle*).

### B. Student Auto-Identity Seam
```
BANK_STATEMENT_STUDENT_AUTO_IDENTITY = 'CONTRACT_TBD'
```
- Spesifikasi resmi BRI Bank Statement SNAP BI v2.1 tidak menyediakan field `virtualAccountNo` atau `customerNo`.
- Ekstraksi regex nomor VA dari kolom berita mutasi (`remark`) hanya bernilai heuristik `CANDIDATE`.
- Jika mutasi bank masuk tanpa order aktif:
  - **UNIDENTIFIED_BANK_CREDIT**: Masuk antrean `finance_reconciliation_items` (`payment_id = NULL`), **nol pembuatan record `finance_payments` fiktif**.
  - **KNOWN_STUDENT**: Hanya dapat dicatat sebagai `PAID + UNALLOCATED` melalui input operator berwenang secara eksplisit (`santriId`, `recordedBy`, `resolutionNotes`), menghasilkan `match_strength = 'MANUAL_RESOLVED'`.

---

## 8. Pemulihan Webhook & CASH Race Protection

Layanan `recoverMissedPaymentFromStatement` memulihkan transaksi yang kehilangan webhook secara atomik dalam 1 unit `batch()`.

### Proteksi CASH Race Condition:
- Jika wali santri telah membayar secara **CASH di loket pesantren**, order berstatus `CANCELLED` atau `REPLACED`.
- Mutasi bank yang datang belakangan untuk order yang telah `CANCELLED` **diblokir dari alokasi otomatis** untuk mencegah pembayaran ganda (*double allocation*).
- Kasus dicatat di `finance_bri_recovery_queue` dengan status `DISCREPANCY` (`reason = 'ORDER_STATUS_NOT_PENDING'`).

---

## 9. Konvergensi Callback / Statement

Dua urutan kedatangan data diverifikasi menghasilkan kondisi finansial yang identik:
1. **Urutan A (Callback tiba lebih dulu $\to$ Rekening Koran tiba belakangan)**:
   - Callback BRIVA membuat 1 pembayaran `PAID`, 1 alokasi, 1 pendapatan admin / kredit dompet.
   - Rekening Koran tiba belakangan: mencocokkan pembayaran dan mengeksekusi transisi ke `SETTLED`.
   - Hasil akhir: 1 Payment (`SETTLED`), 1 Allocation, 1 Admin Income, 1 Settlement.
2. **Urutan B (Pemulihan Rekening Koran lebih dulu $\to$ Callback terlambat tiba)**:
   - Pemulihan statement membuat 1 pembayaran `SETTLED`, 1 alokasi, 1 pendapatan admin / kredit dompet.
   - Callback terlambat tiba: mendeteksi order sudah `PAID` dan mengembalikan replay idempoten tanpa duplikasi.
   - Hasil akhir: **Identik persis dengan Urutan A**, nol duplikasi mutasi dompet dan nol duplikasi admin koperasi.

---

## 10. Status Inquiry Seam (Typed TBD)

Untuk mencegah pembuatan respon HTTP palsu atau kode status rekaan:
- Nilai `"4999999"` dihapus sepenuhnya.
- Mengembalikan objek bertipe kanonikal:
  ```typescript
  export const BRIVA_STATUS_INQUIRY_CONTRACT_STATE = 'BRIVA_STATUS_INQUIRY_CONTRACT_TBD' as const
  ```
- Respon:
  ```json
  {
    "status": "BRIVA_STATUS_INQUIRY_CONTRACT_TBD",
    "message": "BRIVA TRANSACTION STATUS INQUIRY CONTRACT: TBD / BLOCKED BY BRI CONTRACT"
  }
  ```

---

## 11. Hasil Pengujian Lengkap (`test-bri-settlement.cjs`)

Seluruh skenario pengujian komprehensif lolos 100%:

```
=================================================================
BRI-4: RUNNING HARDENED RECOVERY, SETTLEMENT & RECONCILIATION TESTS
=================================================================

--- 1. Testing Official Service Code 14 & Outcome Policy ---
✓ 1.1: 2001400 official success code registered.
✓ 1.2: 5041400 official pending code registered.
✓ 1.3: Obsolete Service Code 73 removed and rejected.
✓ 1.4: Operational outbound kill switch enforced.
✓ 1.5: Official POST /snap/v2.1/bank-statement with 2001400 and 9-digit External-ID verified.
✓ 1.6: Successful empty detailData handled safely without error.
✓ 1.7: 4041401 Transaction Not Found treated as provider failure (FAILED, cursor_advanced=0).

--- 2. Testing Statement Dedup, Identity Strength & Immutability ---
✓ 2.1: Top-level fetch referenceNo stored strictly on fetch record.
✓ 2.2: Same transaction from two fetches with different top-level referenceNo dedups correctly.
✓ 2.3: Strong identity verified when transactionId is present.
✓ 2.4: Weak identity verified when transactionId is absent.
✓ 2.5: Strict type parser: exact CREDIT/DEBIT accepted; abbreviations CR, DB, DR fail-closed.
✓ 2.6: Raw statement evidence immutability verified (UPDATE and DELETE blocked).
✓ 2.7: Totals mismatch marks fetch as DISCREPANCY and blocks cursor advance.
✓ 2.8: Non-destructive WEAK dedup: both identical weak lines preserved and marked AMBIGUOUS.

--- 3. Testing Matching Engine & Cross-Product Contract Isolation ---
✓ 3.1: Bank Statement transactionId not assumed equal to BRIVA trxId (classified as CANDIDATE).
✓ 3.2: Multiple candidate payments with identical amounts classify as AMBIGUOUS.
✓ 3.3: Debit/DEBIT transaction classified as IGNORED_DEBIT and never settles.
✓ 3.4: Authoritative match verified when explicit cross-product link is confirmed.
✓ 3.5: BANK_STATEMENT_STUDENT_AUTO_IDENTITY is CONTRACT_TBD; VA regex match is strictly CANDIDATE.

--- 4. Testing Atomic Settlement & Database Hard Guards ---
✓ 4.1: Direct PAID -> SETTLED without settlement item blocked by database trigger.
✓ 4.2: Settlement item guard blocks settlement against DEBIT transaction.
✓ 4.3: Valid atomic settlement (item first -> payment SETTLED) succeeded.
✓ 4.3b-d: Settlement provenance guards (CANDIDATE rejection, MANUAL_RESOLVED requirements, currency) verified.
✓ 4.4: 1-to-1 unique constraints prevent double claim of statement transaction.
✓ 4.5: Settlement items immutability verified (UPDATE and DELETE blocked).

--- 5. Testing Missed-Webhook Recovery & CASH Race Protection ---
✓ 5.1: Missed-webhook recovery materialized allocations, income, and settled atomically.
✓ 5.2: Repeated recovery is idempotent.
✓ 5.3: CASH race protection verified: cancelled order blocks automated statement allocation and flags DISCREPANCY.
✓ 5.4: UANG_JAJAN missed-webhook recovery credited wallet exactly once.

--- 6. Testing Unallocated & Unidentified Credit Flow ---
✓ 6.1: Unidentified bank credit queued to reconciliation items with zero fake finance_payments.
✓ 6.2: Known-student no-order credit recorded as PAID + UNALLOCATED with zero admin fee.

--- 7. Testing Callback / Statement Convergence ---
✓ 7.1: Sequence A (Callback first -> Statement later) settled cleanly.
✓ 7.2: Sequence B (Statement first -> Late callback later) resulted in identical state with zero duplication.

--- 8. Testing Status Inquiry Seam & Reconciliation Session ---
✓ 8.1: Status inquiry abstraction returns typed TBD state without fake response codes.
✓ 8.2: Reconciliation session with discrepancies marked DISCREPANCY_OPEN.
✓ 8.3: Reconciliation session with zero discrepancies marked BALANCED.

=================================================================
SUCCESS: ALL 23 HARDENED BRI-4 TESTS PASSED COMPLETELY!
=================================================================
```

---

## 12. Hasil Verifikasi Regresi Komprehensif

| Test Suite / Verifikasi | Target | Hasil |
| :--- | :--- | :--- |
| `scripts/test-migration-0184.cjs` | 14 Invariant Database Settlement, Immutability & Hard Guards | **PASSED (14/14)** |
| `scripts/test-bri-settlement.cjs` | 23 Skenario Hardened Recovery, Settlement & Reconciliation | **PASSED (23/23)** |
| `scripts/test-bri-collection.cjs` | Baseline BRI-3 (BRIVA Collection) | **PASSED** |
| `scripts/test-migration-0183.cjs` | Baseline Migrasi 0183 | **PASSED** |
| `scripts/test-bri-core.cjs` | Baseline BRI-2 (Core Adapter & Crypto) | **PASSED** |
| `scripts/test-migration-0182.cjs` | Baseline Migrasi 0182 (33 Invariants + Regression) | **PASSED (33/33)** |
| `node ./node_modules/typescript/bin/tsc --noEmit` | TypeScript Strict Compilation Check | **PASSED (0 error)** |
| `cmd /c "npm run build"` | Next.js Production Turbopack Build | **PASSED (Exit code 0)** |
| `git diff --check` | Formatting & Whitespace Audit | **PASSED (Clean)** |

---

## 13. Deklarasi Status Formal

```
REMOTE MIGRATION STATE 0182/0183/0184: NOT VERIFIED / UNKNOWN
BRI BANK STATEMENT SANDBOX INTEROPERABILITY: NOT VERIFIED
BRIVA TRANSACTION STATUS INQUIRY CONTRACT: TBD / BLOCKED BY BRI CONTRACT
BANK_STATEMENT_STUDENT_AUTO_IDENTITY: CONTRACT_TBD
```

---

## 14. Gerbang Penyelesaian (Completion Gate)

Sesuai instruksi dan panduan tata kelola:
- Tidak ada migrasi remote yang dieksekusi.
- Modul BRI-5 (QLola non-STP distribution) **TIDAK** dimulai.
- Seluruh pekerjaan fase BRI-4 telah selesai sebagai satu paket dan berhenti di sini menunggu deklarasi resmi dari reviewer:
  > `BRI-4 LOCKED`
