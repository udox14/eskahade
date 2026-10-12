# Walkthrough & Verification Report: BRI-1 — Data Model & Duitku Retirement

**Status Fase**: SELESAI (Menunggu Review & Deklarasi `BRI-1 LOCKED`)  
**Tanggal**: 8 Oktober 2026  
**Repository**: `c:\DATA\Codes\eskahade`  
**Baseline**: PRD BRI (`docs/BRI_INTEGRATION_PRD.md`), PRD Keuangan Baru (`docs/SISTEM_KEUANGAN_BARU_PRD.md`), `AGENTS.md`

---

## PEMBERITAHUAN STATUS MIGRASI REMOTE

> [!WARNING]
> **REMOTE MIGRATION STATE: NOT VERIFIED / UNKNOWN**  
> File migrasi `migrations/0182_bri_foundation.sql` telah dirancang secara aditif, idempotensial, dan teruji 100% pada runner SQLite lokal (`scripts/test-migration-0182.cjs`). Namun, verifikasi langsung terhadap skema tabel Cloudflare D1 remote (`d1_migrations` remote) **belum dijalankan / tidak diketahui** pada sesi ini. File migrasi ini siap diaplikasikan ke remote saat proses deploy/cutover disetujui.

---

## 1. Ringkasan Eksekutif Hardening Final BRI-1

Seluruh temuan audit material dan hardening review SQL final telah diselesaikan sebagai **SATU PAKET PERBAIKAN MENYELURUH**:

1. **Integritas Koreksi vs Penyaluran (Distinction Live Reservation vs Already Distributed)**:
   - **Live Bank Reservation (`PENDING_APPROVAL`, `PROCESSING`, `CANCEL_PENDING`)**: Koreksi ditolak jika nominal koreksi akan menyebabkan sisa alokasi efektif lebih kecil dari live reservation (`live_reserved > effective_allocation_after_correction`). Transfer bank yang sedang in-flight tidak boleh menjadi undercollateralized.
   - **Already Distributed (`DISTRIBUTED`)**: Koreksi terhadap alokasi yang dananya sudah final tersalurkan **TIDAK DIBLOKIR**. Fakta historis penyaluran tetap abadi. Porsi yang telah tersalurkan ditandai dengan `is_disbursed_portion = 1` dan menghasilkan kasus pemulihan aktif (`is_recovery_case = 1`, `recovery_amount`, `recovery_status = 'PENDING_RECOVERY'`).
   - Trigger `trg_finance_correction_items_prevent_over_correct` dan modul `lib/finance/corrections.ts` telah disinkronkan secara presisi.
2. **Koreksi Single Active Online Order Index**:
   - Filter indeks unik diubah menjadi `WHERE status = 'PENDING' AND payment_method = 'BRI_VA'`.
   - Status `PAID` terbebas dari kekangan indeks sehingga santri dapat membuat order baru untuk tagihan bulan berikutnya tanpa menghapus atau memodifikasi riwayat `PAID`.
3. **Immutability Item Penyaluran di Seluruh Status Non-DRAFT**:
   - Trigger `trg_finance_dist_items_immutable_on_update` dan `trg_finance_dist_items_immutable_on_delete` mengunci item penyaluran dengan kondisi `(SELECT status FROM finance_distributions WHERE id = OLD.distribution_id) != 'DRAFT'`.
   - Termasuk status terminal (`REJECTED`, `CANCELLED`, `FAILED`), item tidak dapat diedit atau dihapus untuk mencegah manipulasi histori audit.
4. **Header Finansial Instruksi Penyaluran Dibekukan Pasca-Submit**:
   - Trigger `trg_finance_dist_header_financial_fields_immutable` membekukan seluruh kolom identitas finansial instruksi: `recipient_type`, `recipient_id`, `item_type`, `period`, `total_amount`, `method`, `destination_bank`, `destination_account`, dan `account_holder_name` jika `OLD.status != 'DRAFT'`.
5. **State Machine Pembatalan QLola yang Komprehensif**:
   - `DRAFT -> PENDING_APPROVAL | CANCELLED`
   - `PENDING_APPROVAL -> PROCESSING | REJECTED | CANCEL_PENDING | CANCELLED`
   - `PROCESSING -> DISTRIBUTED | FAILED | CANCEL_PENDING`
   - `CANCEL_PENDING -> CANCELLED | DISTRIBUTED | FAILED | PROCESSING` (mendukung skenario jika bank tetap mengeksekusi transfer atau membatalkannya).
   - Seluruh status terminal (`DISTRIBUTED`, `FAILED`, `REJECTED`, `CANCELLED`) bersifat final dan immutable.
6. **Relational Recipient Allowed Methods & Seeding Multi-Vendor**:
   - Dibuat tabel relasional `finance_recipient_allowed_methods` dengan primary key `(recipient_id, method)`.
   - Ditegakkan dengan trigger `trg_finance_dist_enforce_allowed_method` (pada `INSERT`) dan `trg_finance_dist_enforce_allowed_method_update` (pada `UPDATE` selama `DRAFT`).
   - Seluruh vendor katering & laundry migrasi dari `master_jasa` otomatis disemai dengan ketiga metode (`BRI_QLOLA`, `CASH`, `MANUAL_TRANSFER`).
7. **Pencegahan Overlap Biaya Admin Koperasi & Versioning**:
   - Partial unique index `uq_finance_admin_fee_single_open_rule` pada `(applies_to_channel, code) WHERE is_enabled = 1 AND effective_until IS NULL`.
   - Aturan historis tersimpan dalam snapshot order (`cooperative_admin_fee`, `total_charged`), sementara perubahan aturan baru berlaku untuk transaksi masa depan.
8. **Matriks Otorisasi Server-Side Eksak**:
   - **Konfigurasi Biaya Admin Koperasi**: HANYA `'admin'`, `'admin_koperasi'` (menolak `'bendahara'`, `'petugas_koperasi'`).
   - **Pengelolaan Rekening Penerima**: HANYA `'admin'`, `'admin_koperasi'`, `'bendahara'` (menolak `'petugas_koperasi'`).
   - **Pengajuan Penyaluran**: HANYA `'admin'`, `'bendahara'`, `'petugas_koperasi'` (menolak `'admin_koperasi'`).
   - **Penyaluran Cash**: HANYA `'admin'`, `'bendahara'`, `'petugas_koperasi'`.
   - **Penyaluran Manual Transfer**: HANYA `'admin'`, `'bendahara'` (menolak `'petugas_koperasi'`).
   - **Pembatalan Penyaluran**: HANYA `'admin'`, `'bendahara'`.
   - **Pembersihan Total Role `'tester'`**: Dicabut 100% dari seluruh aksi keuangan.

---

## 2. Perubahan Data Model & Skema Database (`migrations/0182_bri_foundation.sql`)

### A. Partial Unique Index Single Active Online Order
```sql
-- Memastikan maksimum 1 order online PENDING per santri.
-- Order berstatus PAID atau EXPIRED tidak mengunci santri untuk transaksi berikutnya.
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_payment_orders_single_active_online
ON finance_payment_orders(santri_id)
WHERE status = 'PENDING' AND payment_method = 'BRI_VA';
```

### B. Tabel Relasional `finance_recipient_allowed_methods` & Trigger Enforce
```sql
CREATE TABLE IF NOT EXISTS finance_recipient_allowed_methods (
    recipient_id TEXT NOT NULL REFERENCES finance_distribution_recipients(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK (method IN ('BRI_QLOLA', 'CASH', 'MANUAL_TRANSFER')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (recipient_id, method)
);

-- Trigger validasi metode penerima saat INSERT
CREATE TRIGGER IF NOT EXISTS trg_finance_dist_enforce_allowed_method
BEFORE INSERT ON finance_distributions
FOR EACH ROW
WHEN NEW.recipient_id IS NOT NULL
BEGIN
  SELECT
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM finance_recipient_allowed_methods
        WHERE recipient_id = NEW.recipient_id AND method = NEW.method
      ) THEN
        RAISE(ABORT, 'ABORT: Metode penyaluran tidak diizinkan untuk penerima ini.')
    END;
END;

-- Trigger validasi metode penerima saat UPDATE di status DRAFT
CREATE TRIGGER IF NOT EXISTS trg_finance_dist_enforce_allowed_method_update
BEFORE UPDATE OF method, recipient_id ON finance_distributions
FOR EACH ROW
WHEN NEW.recipient_id IS NOT NULL AND OLD.status = 'DRAFT'
BEGIN
  SELECT
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM finance_recipient_allowed_methods
        WHERE recipient_id = NEW.recipient_id AND method = NEW.method
      ) THEN
        RAISE(ABORT, 'ABORT: Metode penyaluran tidak diizinkan untuk penerima ini.')
    END;
END;
```

### C. Trigger Immutability Item Penyaluran (Seluruh Non-DRAFT Termasuk Terminal)
```sql
CREATE TRIGGER IF NOT EXISTS trg_finance_dist_items_immutable_on_update
BEFORE UPDATE ON finance_distribution_items
FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN (
        SELECT status FROM finance_distributions WHERE id = OLD.distribution_id
      ) != 'DRAFT' THEN
        RAISE(ABORT, 'ABORT: Item penyaluran bersifat immutable dan tidak boleh diubah setelah pengajuan (hanya boleh diubah saat DRAFT).')
    END;
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_dist_items_immutable_on_delete
BEFORE DELETE ON finance_distribution_items
FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN (
        SELECT status FROM finance_distributions WHERE id = OLD.distribution_id
      ) != 'DRAFT' THEN
        RAISE(ABORT, 'ABORT: Item penyaluran bersifat immutable dan tidak boleh dihapus setelah pengajuan (hanya boleh dihapus saat DRAFT).')
    END;
END;
```

### D. Trigger Freeze Header Finansial Instruksi Penyaluran Pasca-Submit
```sql
CREATE TRIGGER IF NOT EXISTS trg_finance_dist_header_financial_fields_immutable
BEFORE UPDATE ON finance_distributions
FOR EACH ROW
WHEN OLD.status != 'DRAFT'
BEGIN
  SELECT
    CASE
      WHEN NEW.recipient_type IS NOT OLD.recipient_type
        OR NEW.recipient_id IS NOT OLD.recipient_id
        OR NEW.item_type IS NOT OLD.item_type
        OR NEW.period IS NOT OLD.period
        OR NEW.total_amount IS NOT OLD.total_amount
        OR NEW.method IS NOT OLD.method
        OR NEW.destination_bank IS NOT OLD.destination_bank
        OR NEW.destination_account IS NOT OLD.destination_account
        OR NEW.account_holder_name IS NOT OLD.account_holder_name THEN
        RAISE(ABORT, 'ABORT: Field finansial instruksi penyaluran (penerima, nominal, item, periode, metode, rekening tujuan) bersifat immutable setelah pengajuan.')
    END;
END;
```

### E. Trigger QLola State Machine Non-STP & Comprehensive Cancellation
```sql
CREATE TRIGGER IF NOT EXISTS trg_finance_dist_enforce_qlola_transitions
BEFORE UPDATE OF status ON finance_distributions
FOR EACH ROW
WHEN NEW.method = 'BRI_QLOLA'
BEGIN
  -- Dari DRAFT hanya boleh ke PENDING_APPROVAL atau CANCELLED
  SELECT
    CASE
      WHEN OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'PENDING_APPROVAL', 'CANCELLED') THEN
        RAISE(ABORT, 'ABORT: Penyaluran BRI_QLOLA non-STP dari DRAFT hanya boleh diajukan ke PENDING_APPROVAL atau dibatalkan ke CANCELLED.')
    END;

  -- Dari PENDING_APPROVAL hanya boleh ke PROCESSING, REJECTED, CANCEL_PENDING, atau CANCELLED
  SELECT
    CASE
      WHEN OLD.status = 'PENDING_APPROVAL' AND NEW.status NOT IN ('PENDING_APPROVAL', 'PROCESSING', 'REJECTED', 'CANCEL_PENDING', 'CANCELLED') THEN
        RAISE(ABORT, 'ABORT: Penyaluran BRI_QLOLA non-STP dari PENDING_APPROVAL hanya boleh beralih ke PROCESSING, REJECTED, CANCEL_PENDING, atau CANCELLED.')
    END;

  -- Dari PROCESSING hanya boleh ke DISTRIBUTED, FAILED, atau CANCEL_PENDING
  SELECT
    CASE
      WHEN OLD.status = 'PROCESSING' AND NEW.status NOT IN ('PROCESSING', 'DISTRIBUTED', 'FAILED', 'CANCEL_PENDING') THEN
        RAISE(ABORT, 'ABORT: Penyaluran BRI_QLOLA non-STP dari PROCESSING hanya boleh beralih ke DISTRIBUTED, FAILED, atau CANCEL_PENDING.')
    END;

  -- Dari CANCEL_PENDING hanya boleh ke CANCELLED, DISTRIBUTED, FAILED, atau PROCESSING
  SELECT
    CASE
      WHEN OLD.status = 'CANCEL_PENDING' AND NEW.status NOT IN ('CANCEL_PENDING', 'CANCELLED', 'DISTRIBUTED', 'FAILED', 'PROCESSING') THEN
        RAISE(ABORT, 'ABORT: Penyaluran BRI_QLOLA non-STP dari CANCEL_PENDING hanya boleh beralih ke CANCELLED, DISTRIBUTED, FAILED, atau PROCESSING.')
    END;

  -- Terminal status bersifat final dan immutable
  SELECT
    CASE
      WHEN OLD.status IN ('DISTRIBUTED', 'REJECTED', 'CANCELLED', 'FAILED') AND NEW.status != OLD.status THEN
        RAISE(ABORT, 'ABORT: Penyaluran dengan status terminal bersifat final dan tidak dapat diubah.')
    END;
END;
```

### F. Trigger Proteksi Alokasi Efektif & Reverse Correction Guard
```sql
-- Reverse Trigger: Membedakan live bank reservation vs already DISTRIBUTED
CREATE TRIGGER IF NOT EXISTS trg_finance_correction_items_prevent_over_correct
BEFORE INSERT ON finance_correction_items
FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NEW.amount > (
        SELECT (a.amount - COALESCE(
          (SELECT SUM(di.amount)
           FROM finance_distribution_items di
           JOIN finance_distributions d ON di.distribution_id = d.id
           WHERE di.allocation_id = NEW.target_allocation_id
             AND d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING')),
          0
        ) - COALESCE(
          (SELECT SUM(ci.amount)
           FROM finance_correction_items ci
           WHERE ci.target_allocation_id = NEW.target_allocation_id),
          0
        ))
        FROM finance_allocations a
        WHERE a.id = NEW.target_allocation_id
      ) THEN
        RAISE(ABORT, 'ABORT: Koreksi ditolak: Nominal koreksi akan menyebabkan sisa alokasi lebih kecil dari reservasi transfer bank aktif (PENDING_APPROVAL/PROCESSING/CANCEL_PENDING). Batalkan atau selesaikan reservasi bank terlebih dahulu.')
    END;
END;
```

---

## 3. Matriks Otorisasi Server-Side & Keamanan Role

| Operasi Finansial | File / Server Action | Role Diizinkan | Role Ditolak | Catatan Integritas |
| :--- | :--- | :--- | :--- | :--- |
| **Konfigurasi Biaya Admin Koperasi** | `tarif/actions.ts` (`saveGatewaySettingsAction`) | `admin`, `admin_koperasi` | `bendahara`, `petugas_koperasi`, `pimpinan`, `tester` | Hak mutlak koperasi & admin sistem |
| **Manajemen Rekening Penerima** | `penyaluran/actions.ts` (`saveProviderAccountAction`, dll) | `admin`, `admin_koperasi`, `bendahara` | `petugas_koperasi`, `pimpinan`, `tester` | Konfigurasi master rekening bank vendor |
| **Pengajuan Penyaluran (Submit)** | `penyaluran/actions.ts` (`recordDistributionAction`) | `admin`, `bendahara`, `petugas_koperasi` | `admin_koperasi`, `pimpinan`, `tester` | Admin koperasi dilarang mutasi kas/penyaluran |
| **Penyaluran Tunai (CASH)** | `penyaluran/actions.ts` (`recordDistributionAction`) | `admin`, `bendahara`, `petugas_koperasi` | `admin_koperasi`, `pimpinan`, `tester` | Sesuai sesi loket kas aktif |
| **Penyaluran Manual Transfer** | `penyaluran/actions.ts` (`recordDistributionAction`) | `admin`, `bendahara` | `petugas_koperasi`, `admin_koperasi`, `pimpinan` | Memerlukan bukti transfer rekening resmi |
| **Pembatalan Penyaluran** | `penyaluran/actions.ts` (`cancelDistributionAction`) | `admin`, `bendahara` | `petugas_koperasi`, `admin_koperasi`, `pimpinan` | Membatalkan instruksi `DRAFT` / `PENDING_APPROVAL` / `PROCESSING` |
| **Final Approval BRI/QLola** | *(Tidak ada server action)* | **Signer di QLola** | Seluruh role Eskahade | Non-STP: Eskahade tidak mengeksekusi transfer bank |
| **Akses Modul Keuangan Keseluruhan** | `fitur_akses` / Seluruh actions | Role terotorisasi | `tester` (dicabut 100%) | `tester` tidak terdaftar di `fitur_akses` |

---

## 4. Hasil Verifikasi Pengujian Komprehensif

### A. Pengujian Unit & Regresi (`scripts/test-migration-0182.cjs`)
Perintah eksekusi:
```powershell
node scripts/test-migration-0182.cjs
```
Output:
```text
--- Setting up baseline tables & prerequisite migrations ---
Applying Migration 0182...
Migration 0182 applied successfully!

--- Running Invariant Verifications ---
Test 1: Legacy Duitku test data purged safely...
Test 2: Valid CASH records preserved...
Test 3: Cooperative admin fee rules versioned & effective-dated...
Test 4: Append-only cooperative income ledger...
Test 5: Partial unique index on bri_payment_request_id...
Test 6: Partial unique index on bri_trx_id...
Test 7: Gateway event key uniqueness...
Test 8: First-class recipients seeded properly...
Test 9: Maximum one active primary account per recipient...
Test 10: Fixed BRIVA lifecycle fields and clean initial state...
Test 11: Single active online order per santri...
Test 12: Distribution Reservation Trigger 1...
Exact reservation of 150,000 succeeded.
Test 13: Distribution Reservation Trigger 2 (State Transition & Concurrency Guard)...
dist_test_pending updated to REJECTED (reservation released).

--- Running 12 Reviewer Hardening Regression Tests ---
RT-1: Verifying PAID order allows new PENDING order for same student...
RT-1 Passed: Single active online order index correctly scopes only PENDING orders.
RT-2: Verifying distribution items immutability on UPDATE amount...
RT-2 Passed: Cannot update item amount on active distribution.
RT-3: Verifying distribution items immutability on UPDATE allocation_id...
RT-3 Passed: Cannot update allocation_id on active distribution.
RT-4: Verifying distribution items immutability on DELETE...
RT-4 Passed: Cannot delete item on active distribution.
RT-5: Verifying Non-STP Guard blocks DRAFT -> DISTRIBUTED on BRI_QLOLA...
RT-5 Passed: Direct DISTRIBUTED transition blocked.
RT-6: Verifying Non-STP Guard blocks DRAFT -> PROCESSING on BRI_QLOLA...
RT-6 Passed: Direct PROCESSING transition blocked.
RT-7: Verifying effective allocation with corrections & reverse protection...
RT-7 Passed: Effective allocation arithmetic and reverse correction guard verified.
RT-8: Verifying single open rule partial unique index on fee rules...
RT-8 Passed: Partial unique index blocks duplicate open fee rule.
RT-9: Verifying allowed methods relational check on distributions...
RT-9 Passed: Disallowed recipient method trigger aborts insertion.
RT-10: Verifying role matrix assertions...
RT-10 Passed: Role authorization matrix fully conforms to PRD.
RT-11: Verifying Non-STP QLola FAILED transition rules...
RT-11 Passed: FAILED status strictly requires preceding PROCESSING bank state.
RT-12: Verifying CANCEL_PENDING preserves reservation...
RT-12 Passed: CANCEL_PENDING safely reserves funds until terminal CANCELLED confirmation.
RT-13: Verifying correction on DISTRIBUTED allocation produces recovery case...
RT-13 Passed: Correction on DISTRIBUTED allocation successfully recorded as recovery case.
RT-14: Verifying correction conflicting with live PROCESSING reservation is rejected...
RT-14 Passed: Correction conflicting with live PROCESSING reservation correctly rejected.
RT-15: Verifying distribution items immutability on REJECTED, CANCELLED, and FAILED...
RT-15 Passed: Items are strictly immutable on REJECTED, CANCELLED, and FAILED distributions.
RT-16: Verifying financial header freeze after submit...
RT-16 Passed: Financial header fields strictly frozen once submitted.
RT-17: Verifying comprehensive QLola cancellation state machine...
RT-17 Passed: Comprehensive QLola cancellation state machine transitions verified.
RT-18: Verifying allowed-method validation on UPDATE during DRAFT...
RT-18 Passed: Allowed-method validation triggers on UPDATE during DRAFT.
RT-19: Verifying migrated multi-vendor Katering & Laundry have usable allowed methods...
RT-19 Passed: All migrated multi-vendor recipients have usable allowed methods.
RT-20: Verifying effective fee rule lookup and historical order immutability...
RT-20 Passed: Effective fee rule evolution preserves historical order snapshot integrity.

======================================================
SUCCESS: ALL 13 CORE INVARIANTS + 20 REGRESSION TESTS PASSED!
======================================================
```

### B. TypeScript Compilation (`npx tsc --noEmit`)
- **Status**: Berhasil (Exit code 0).
- **Hasil**: 0 errors di seluruh file TypeScript codebase.

### C. Next.js Production Build (`npm run build`)
- **Status**: Berhasil dalam 15.3 detik (Exit code 0).
- **Rincian**: 12 rute statis dan seluruh server actions terkompilasi optimal tanpa peringatan type-check atau bundling failure.

### D. Audit Git & Whitespace (`git diff --check`)
- **Status**: Bersih (Exit code 0).

### E. Klasifikasi Repo-wide Audit `Duitku`
- **Kode Aktif (`app/` dan `lib/`)**: Bersih 100% (hanya 1 komentar dokumentasi di `lib/finance/payment-types.ts`).
- **Migrasi Historis yang Sudah Pernah Diaplikasikan**: `0155`, `0158`, `0163` dipertahankan utuh demi kepatuhan aturan AGENTS.md (*Jangan Edit Applied Migration Lama*).
- **Skrip Tes Historis & Dokumen Referensi**: Terisolasi pada folder `scripts/test-finance-patch-b.py` dan `docs/`.

---

## 5. Ringkasan File Terdampak (Git Status)

```text
D  app/api/finance/gateway/duitku/callback/route.ts
D  app/api/finance/gateway/duitku/snap/va/inquiry/route.ts
D  app/api/finance/gateway/duitku/snap/va/payment/route.ts
D  app/api/v1.0/transfer-va/inquiry-va/route.ts
D  app/api/v1.0/transfer-va/payment/route.ts
D  lib/finance/gateway/duitku-snap.ts
D  lib/finance/gateway/duitku-v2.ts
D  lib/finance/gateway/duitku.ts
D  scripts/test-snap-crypto-ts.ts
M  app/dashboard/keuangan/actions.ts
M  app/dashboard/keuangan/kredensial/actions.ts
M  app/dashboard/keuangan/kredensial/page.tsx
M  app/dashboard/keuangan/laporan/_page-content.tsx
M  app/dashboard/keuangan/laporan/actions.ts
M  app/dashboard/keuangan/penyaluran/actions.ts
M  app/dashboard/keuangan/rekonsiliasi/_page-content.tsx
M  app/dashboard/keuangan/rekonsiliasi/actions.ts
M  app/dashboard/keuangan/rekonsiliasi/input-settlement-modal.tsx
M  app/dashboard/keuangan/riwayat/actions.ts
M  app/dashboard/keuangan/status-pembayaran/actions.ts
M  app/dashboard/keuangan/status-pembayaran/detail-drawer.tsx
M  app/dashboard/keuangan/tarif/_page-content.tsx
M  app/dashboard/keuangan/tarif/actions.ts
M  app/dashboard/keuangan/tarif/gateway-tab.tsx
M  app/dashboard/keuangan/uang-jajan/actions.ts
M  app/dashboard/keuangan/uang-jajan/page.tsx
M  app/dashboard/keuangan/uang-jajan/wallet-detail-drawer.tsx
M  app/dashboard/koperasi/loket/actions.ts
M  app/portal-ortu/(app)/beranda/_beranda-wallet-card.tsx
M  app/portal-ortu/(app)/tagihan/_tagihan-client.tsx
M  lib/finance/corrections.ts
M  lib/finance/dashboard.ts
M  lib/finance/distribution-types.ts
M  lib/finance/distributions.ts
M  lib/finance/history.ts
M  lib/finance/orders.ts
M  lib/finance/payment-types.ts
M  lib/finance/payments.ts
M  lib/finance/reconciliation-types.ts
M  lib/finance/reconciliation.ts
M  lib/finance/report-exports.ts
M  lib/finance/reports.ts
M  lib/finance/settlement.ts
M  lib/finance/va.ts
M  lib/portal/finance.ts
?? docs/BRI_1_WALKTHROUGH.md
?? lib/finance/cooperative-admin.ts
?? migrations/0182_bri_foundation.sql
?? scripts/test-migration-0182.cjs
```

---

## 6. Gerbang Penyelesaian (Completion Gate)

Sesuai instruksi:
- Scope BRI-1 telah selesai secara menyeluruh.
- Seluruh 13 invariant dasar dan 20 pengujian regresi reviewer telah diverifikasi lulus 100%.
- Tidak ada kode sandbox, OAuth, inquiry, webhook, atau transfer QLola yang diimplementasikan sebelum fasenya.
- **BERHENTI**: Menunggu reviewer memverifikasi laporan ini dan mendeklarasikan status **`BRI-1 LOCKED`**.
