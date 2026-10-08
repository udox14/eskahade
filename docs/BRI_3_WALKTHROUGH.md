# BRI-3 — BRIVA Collection Implementation Walkthrough

**Status:** HARDENED & VERIFIED  
**Baseline Dependencies:** `BRI-0 LOCKED`, `BRI-1 LOCKED`, `BRI-2 LOCKED` (Preserved without modification)  
**Readiness:** `BRI-4 READINESS: READY` (Awaiting Reviewer Declaration: `BRI-3 LOCKED`)  
**Deployment Gates & External Verifications:**
- `REMOTE MIGRATION STATE 0182/0183: NOT VERIFIED / UNKNOWN` (Local verification passed, remote D1 execution prohibited until explicitly approved)
- `BRI SANDBOX INTEROPERABILITY: NOT VERIFIED` (Pending BRIAPI sandbox credentials)
- `INBOUND BEARER CONTRACT: NOT VERIFIED AGAINST SANDBOX` (Seam preserved for onboarding)
- `BRI <10s SLA: NOT VERIFIED AGAINST SANDBOX` (Instrumented via `durationMs`, awaiting network benchmark)

---

## 1. Executive Summary & Hardening Scope

Fase **BRI-3 (BRIVA Collection)** mengimplementasikan siklus penerimaan dana pembayaran online Virtual Account resmi BRI (SNAP BI BRIVA Service Code 24 untuk Inquiry dan Service Code 25 untuk Payment Notification) dengan kepatuhan penuh terhadap kontrak SNAP BI v1.0, integritas finansial atomik, serta mitigasi race condition pada level database.

### Invarian dan Prinsip Utama:

1. **Operational Inbound BRIVA Kill Switch (`BRI_BRIVA_INBOUND_ENABLED`)**:
   - Ditambahkan switch operasional khusus inbound yang independen dari `FEATURE_FLAG_BRIVA_ONLINE` dan outbound BRI kill switch.
   - Default produksi: `false` (fail-closed).
   - Server/deployment-controlled strictly via variabel lingkungan; tidak disimpan di D1/app_settings dan tidak ada toggle UI.
   - Ketika OFF: Inquiry dan Payment langsung mengembalikan HTTP 500 General Error (`5002400` / `5002500`) sebelum membaca atau memutasi database. Terbukti menghasilkan nol mutasi pada database (`finance_gateway_events`, `finance_payments`, `finance_allocations`, dan status order tetap `PENDING`).

2. **Diferensiasi Idempotensi Replay vs Tabrakan Identifier (HTTP 409 Conflict)**:
   - **Legitimate Duplicate**: Jika `paymentRequestId`, `trxId`, `virtualAccountNo`, `customerNo`, `partnerServiceId`, `santriId`, `paidAmount`, dan mata uang identik $\to$ mengembalikan HTTP 200 sukses deterministik tanpa mutasi ganda.
   - **Identifier Collision**: Jika `paymentRequestId` atau `trxId` sudah ada tetapi terdapat perbedaan pada nominal, nomor VA, santri, atau ID transaksi $\to$ mengembalikan HTTP 409 `4092500 Conflict` per standar SNAP BI tanpa memutasi transaksi yang sudah ada. Dilengkapi payment fingerprint deterministik (SHA-256 tanpa kredensial/passApp).

3. **Server Configuration Failure adalah 500 General Error, BUKAN 401 Unauthorized**:
   - Kegagalan konfigurasi server (misal: `BRI_INBOUND_MAX_SKEW_SECONDS` belum diset atau invalid pada mode produksi, atau kredensial partner/secret server kosong) mengembalikan HTTP 500 (`5002400` / `5002500` General Error) dengan pesan aman tanpa membocorkan detail server.
   - Error autentikasi dari sisi request bank (timestamp expired, signature salah, token invalid, partner ID mismatch) tetap mengembalikan HTTP 401.

4. **Pembuktian Penuh Financial Atomicity (Obligasi & Uang Jajan)**:
   - Seluruh mutasi pembayaran (gateway event, payment record, metadata rekonsiliasi, order update ke `PAID`, alokasi, cooperative admin fee income, dan wallet ledger untuk `UANG_JAJAN`) dieksekusi dalam satu kesatuan batch database atomik.
   - Teruji dengan kegagalan yang diinjeksikan pada statement terakhir:
     - **Obligation Order**: Seluruh record pembayaran, alokasi, income, event, dan rekonsiliasi bersih; status order tetap `PENDING`; status kewajiban santri tetap `UNPAID` dengan `amount_paid = 0`.
     - **UANG_JAJAN Order**: Seluruh record bersih; status order tetap `PENDING`; saldo dan baris buku besar santri (`finance_wallet_ledger`) tidak berubah sama sekali.

5. **Allowlist & Skema Wire Respons `additionalInfo`**:
   - Skema response selaras penuh dengan kontrak resmi BRIVA SNAP BI v1.0:
     - **Inquiry Response**: hanya field tertera yang diizinkan (`idApp`, `info1`). Field `passApp`, `trxId`, dan field arbitrer lainnya dilarang keras.
     - **Payment Response**: hanya field tertera yang diizinkan (`idApp`, `passApp` wire-only, `info1`). Field `trxId` dan field arbitrer lainnya dilarang keras.
   - Field `trxId` diperlakukan secara eksklusif sebagai metadata identitas transaksi request/rekonsiliasi pada layer authoritative internal, **bukan** direfleksikan ke response `additionalInfo`.
   - **idApp Contract Invariant**: Jika response mengandung `additionalInfo`, `idApp` wajib tersedia. Jika request tidak menyediakan `idApp` dan server env (`BRI_ID_APP`) tidak mengonfigurasinya, sistem **tidak memfabrikasi** nilai `idApp` palsu, melainkan secara fail-safe **meng-omit seluruh `additionalInfo`** (undefined).
   - `passApp` pada pembayaran dikembalikan pada wire response jika diperlukan kontrak, namun disanitasi menjadi `[REDACTED]` pada penyimpanan persisten database (`finance_gateway_events.payload_json`) dan log audit, serta tidak pernah masuk ke error telemetry atau payment fingerprint.

6. **Exact Raw-Body HMAC Signature Preservation**:
   - Body request ditangkap sebagai raw string byte-for-byte melalui `await req.text()` sebelum parsing JSON.
   - Teruji dan terbukti valid memproses payload JSON dengan whitespace, baris baru, indentasi, dan karakter ter-escape.

7. **Exact Public SNAP Callback Path**:
   - Rute publik kanonikal resmi:
     - `/snap/v1.0/transfer-va/inquiry` (`app/snap/v1.0/transfer-va/inquiry/route.ts`)
     - `/snap/v1.0/transfer-va/payment` (`app/snap/v1.0/transfer-va/payment/route.ts`)
   - Seluruh alias lama (`/api/bri/v1.0/...` dan `/api/v1.0/...`) secara ketat di-disable (mengembalikan HTTP 404 fail-closed) di lingkungan produksi.

8. **Inquiry Requirement Contract Seam (`BRI_REQUIRE_PRIOR_INQUIRY_FOR_PAYMENT`)**:
   - Default produksi: fail-closed (HTTP 404 `4042512`) jika belum pernah ada inquiry request yang terekam.
   - Jika flag di-set `false` untuk onboarding direct payment, pembayaran langsung diverifikasi ke VA aktif dan order `PENDING`.
   - Nilai `trxDateTime` yang diterima disimpan eksak, atau disimpan `NULL` jika tidak disediakan (tidak pernah memalsukan waktu server).

9. **Penutupan Race Pre-Read $\to$ Financial Batch (Compare-and-Set Guard)**:
   - Database trigger `trg_finance_payments_briva_guard` (`BEFORE INSERT ON finance_payments`) memvalidasi bahwa order target berstatus `PENDING`. Jika kasir loket CASH membayar atau membatalkan order saat request bank sedang terbang, trigger menggagalkan transaksi (`4042514 Bill already paid`).

10. **PAID != SETTLED**:
    - Status pembayaran dicatat strictly sebagai `PAID`. Transisi ke `SETTLED` hanya terjadi melalui Bank Statement authoritative reconciliation pada fase BRI-4.

---

## 2. Implementation & Test Verification Matrix

| Area | Implementation Details | Verification & Evidence | Status |
| :--- | :--- | :--- | :--- |
| **Inbound Kill Switch** | `BRI_BRIVA_INBOUND_ENABLED` env-only; fail-closed returning 500 General Error before DB touch. | Test Scenario 0 | **VERIFIED** |
| **Collision vs Replay** | Identical payload $\to$ 200 deterministic. Conflicting amount/VA/santri/request $\to$ 409 Conflict. | Test Scenario 12 & 12B | **VERIFIED** |
| **Server Config 500** | Missing/invalid skew in prod or missing credentials $\to$ 500 General Error (no leaks). | Test Scenario 7B | **VERIFIED** |
| **Full Atomicity: Obligasi** | Rollback on last statement leaves order PENDING, obligation UNPAID (0 paid), zero financial rows. | Test Scenario 18A | **VERIFIED** |
| **Full Atomicity: Uang Jajan**| Rollback on last statement leaves order PENDING, zero wallet ledger changes, zero financial rows. | Test Scenario 18B | **VERIFIED** |
| **Allowlist additionalInfo** | `evilField` & `trxId` omitted; Inquiry (`idApp`, `info1`); Payment (`idApp`, `passApp`, `info1`); `passApp` [REDACTED] in DB. | Test Scenario 16 & 16B | **VERIFIED** |
| **Raw-Body HMAC** | Exact byte-for-byte text verification with newlines, spaces, escaped formatting. | Test Scenario 6C | **VERIFIED** |
| **Exact Public SNAP Path** | Canonical endpoints: `/snap/v1.0/transfer-va/inquiry` & `/snap/v1.0/transfer-va/payment`. Old aliases 404 in prod. | Test Scenario 6 & 7 | **VERIFIED** |
| **Inbound SNAP Headers** | Validasi 7 header: `Authorization`, `X-TIMESTAMP`, `X-SIGNATURE`, `Content-Type`, `X-PARTNER-ID`, `CHANNEL-ID`, `X-EXTERNAL-ID`. | Test Scenario 1, 2, 4, 5 | **VERIFIED** |
| **Authorization in HMAC** | Bearer token diekstraksi dan disertakan dalam segment `accessToken` pada HMAC-SHA512 SNAP BI. | Test Scenario 3 | **VERIFIED** |
| **Inquiry Seam Configuration**| Hard matching jika inquiry ada; configurable fail-closed jika inquiry absen via `BRI_REQUIRE_PRIOR_INQUIRY_FOR_PAYMENT`. | Test Scenario 8, 9, 8B | **VERIFIED** |
| **Exact `trxDateTime` Handling**| Disimpan byte-for-byte jika ada, disimpan `NULL` jika absen, tidak pernah difabrikasi. | Test Scenario 17 & 8B | **VERIFIED** |
| **Pre-Read $\to$ Batch Race Guard**| Database trigger `trg_finance_payments_briva_guard` mencegah double payment dengan CASH loket. | Test Scenario 10 | **VERIFIED** |
| **Concurrent Webhook Idempotency**| Concurrency handling dengan `Promise.all`; UNIQUE constraint recovery menghasilkan HTTP 200 deterministik. | Test Scenario 11 & 20 | **VERIFIED** |
| **Strict Money Parser** | Regex `/^\d+\.00$/` IDR murni tanpa floating point. | Test Scenario 13 | **VERIFIED** |
| **VA Identity Trio** | Preservasi leading spaces & leading zeros (`partnerServiceId`, `customerNo`, `virtualAccountNo`). | Test Scenario 14 & 15 | **VERIFIED** |
| **PAID != SETTLED** | Status pembayaran diset strictly `PAID`. | Test Scenario 19 | **VERIFIED** |
| **Remote Migration Gate** | `migrations/0182_*.sql` dan `migrations/0183_*.sql` tidak diaplikasikan ke remote D1 tanpa persetujuan reviewer. | `REMOTE MIGRATION STATE 0182/0183: NOT VERIFIED / UNKNOWN` | **GATED** |

---

## 3. Database Migration Summary

### Migration `0183_briva_collection_metadata.sql`:
- **`finance_briva_inquiries`**: Penyimpanan evidence korelasi inquiry request.
- **`finance_briva_reconciliation_metadata`**: Penyimpanan evidence rekonsiliasi queryable dan immutable untuk fase BRI-4 (`virtual_account_no`, `paid_amount`, `trx_date_time`, `payment_request_id`, `body_hash`).
- **Trigger `trg_finance_payments_briva_guard`**: Hard compare-and-set level database pada `BEFORE INSERT ON finance_payments` untuk menggagalkan transaksi jika pesanan tidak lagi `PENDING` atau telah dibayar tunai.
- **Trigger `trg_finance_orders_prevent_paid_if_not_pending`**: Hard guard level database pada `BEFORE UPDATE OF status ON finance_payment_orders` untuk mencegah transisi ilegal ke `PAID` jika status sebelumnya bukan `PENDING`.

---

## 4. Test Evidence & Verification Run

### A. BRI-3 Collection Hardened Test Suite (`scripts/test-bri-collection.cjs`)
```text
=================================================================
BRI-3: RUNNING BRIVA COLLECTION TEST SUITE (20 SCENARIOS)
=================================================================

--- Testing Inbound BRIVA Kill Switch OFF ---
✓ 0. Inbound BRIVA kill switch OFF fail-closed before business processing with zero writes.
--- Testing Authorization Header Validation ---
✓ 1. Missing Authorization rejected.
✓ 2. Malformed Bearer rejected.
--- Testing HMAC Token Segment Inclusion ---
✓ 3. Exact Authorization token included in HMAC string verified.
--- Testing CHANNEL-ID Header Validation ---
✓ 4. Missing CHANNEL-ID rejected.
✓ 5. Wrong CHANNEL-ID rejected.
--- Testing Callback Path Signature Matching ---
✓ 6. Signature for wrong callback path rejected.
--- Testing Exact Raw-Body HMAC with Formatting & Whitespace ---
✓ 6C. Exact raw-body HMAC signature verified with uncompacted whitespaces and newlines.
--- Testing Production Canonical Route Enforcement ---
✓ 7. Non-canonical alias routes (/api/v1.0 and /api/bri/v1.0) unavailable in production.
--- Testing Production Timestamp Skew Configuration Enforcement ---
✓ 7B. Production timestamp skew and server configuration requirements return 500 General Error (no secret leaks).
--- Testing Strict Decimal Money Parser ---
✓ 13. Decimal money strictly parsed without floating point.
--- Testing VA Identity Trio Validation ---
✓ 15. Leading spaces and leading zeros preserved and inquiry resolved successfully.
✓ 14. PartnerServiceId / customerNo / VA mismatch rejected.
--- Testing Inquiry ↔ Payment Correlation ---
✓ 9. Mismatched inquiry/payment rejected.
--- Testing Prior Inquiry Seam Configuration ---
✓ 8B. Prior inquiry seam verified: fail-closed when required, supported when false, omitted trxDateTime is NULL.
--- Testing Concurrent Payment & Persistence ---
✓ 8. Inquiry/payment request ID matching verified.
✓ 11. Two concurrent identical payment webhooks created exactly one financial transaction.
✓ 19. PAID remains strictly not SETTLED.
✓ 16. Secret passApp preserved on wire response, Payment additionalInfo allowlist enforced (trxId and evilField omitted), and strictly [REDACTED] in persistent storage.
--- Testing AdditionalInfo Wire Contract Invariants ---
✓ 16B.1. Inquiry response additionalInfo strictly contains only documented fields (idApp, info1).
✓ 16B.2. Payment response additionalInfo strictly contains only documented fields (idApp, passApp, info1).
✓ 16B.3 & 16B.4. Request additionalInfo.trxId and arbitrary unknown fields strictly dropped.
✓ 16B.5 & 16B.6. passApp wire-only and omitted from DB/log/telemetry/fingerprint verified.
✓ 16B.7. Authoritative server idApp configuration correctly used when request omits it.
✓ 16B.8. Zero fabrication: additionalInfo strictly omitted when idApp cannot be authoritatively resolved.
✓ 17. Durable reconciliation metadata with exact byte-for-byte trxDateTime persisted for BRI-4.
--- Testing Retry with Different X-EXTERNAL-ID ---
✓ 12. Duplicate with new X-EXTERNAL-ID stayed exactly-once.
--- Testing Identifier Collision Detection (HTTP 409) ---
✓ 12B. Identifier collisions returned HTTP 409 Conflict without mutating records.
--- Testing CASH Race & Compare-and-Set Guard ---
✓ 10. CASH mutation between pre-read and batch aborted BRIVA posting (trigger guard verified).
--- Testing Concurrent Uang Jajan Top-up ---
✓ 20. Webhook for UANG_JAJAN concurrently duplicated credited wallet exactly once.
--- Testing Atomic Batch Rollback on Injected Failure (Obligation) ---
✓ 18A. Injected failure at final batch statement for obligation rolled back event, payment, allocation, coop income, rec meta, order, and obligation.
--- Testing Atomic Batch Rollback on Injected Failure (Uang Jajan) ---
✓ 18B. Injected failure at final batch statement for Uang Jajan rolled back event, payment, coop income, rec meta, order, and wallet ledger.

=================================================================
SUCCESS: ALL BRI-3 HARDEST COLLECTION TESTS PASSED!
=================================================================
```

### B. Migration 0183 Standalone Test Suite (`scripts/test-migration-0183.cjs`)
```text
======================================================
SUCCESS: ALL MIGRATION 0183 INVARIANT TESTS PASSED!
======================================================
```

### C. Regression Suites (BRI-2 Core & BRI-1 Foundation)
- `node scripts/test-bri-core.cjs` $\to$ **100% Passed (All hardened security & core adapter tests passed)**
- `node scripts/test-migration-0182.cjs` $\to$ **100% Passed (13 core invariants + 20 regression tests passed)**

### D. TypeScript & Production Build Verification
- `cmd /c npx tsc --noEmit` $\to$ **Exit code: 0 (Zero type errors)**
- `cmd /c npm run build` $\to$ **Exit code: 0 (Compiled successfully in Next.js production mode)**

---

## 5. Declaration of Completion

Seluruh poin perbaikan, hardening, dan penyelarasan kontrak SNAP BI telah diselesaikan sebagai satu paket terpadu. Baseline `BRI-0`, `BRI-1`, dan `BRI-2` tetap terkunci tanpa modifikasi.

**`BRI-4 READINESS: READY`**

Menunggu konfirmasi dan instruksi reviewer:
```text
BRI-3 LOCKED
```
sebelum melanjutkan ke fase **BRI-4 (Recovery, Settlement & Reconciliation)**.
