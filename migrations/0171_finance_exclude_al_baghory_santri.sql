-- Migration: 0171_finance_exclude_al_baghory_santri.sql
-- Aturan bisnis: santri asrama AL-BAGHORY adalah penduduk setempat (bukan santri
-- bermukim), sehingga TIDAK dikenai tagihan apa pun pada Sistem Keuangan Baru.
--
-- Migration ini bersifat NON-DESTRUCTIF:
--   * Tidak ada DROP TABLE / DROP COLUMN / DELETE data.
--   * Tidak mengubah riwayat transaksi finansial yang sudah terjadi (payment,
--     allocation, correction, distribution, wallet ledger tetap utuh).
--   * Hanya membebaskan (EXEMPTED) kewajiban yang BELUM pernah dibayar sama sekali,
--     sehingga tidak ada tagihan "hantu" bagi santri bebas tagihan.
--   * Kewajiban yang sudah memiliki pembayaran (amount_paid > 0) TIDAK disentuh
--     karena termasuk riwayat finansial; baris tersebut tetap tersembunyi dari UI
--     melalui filter di `lib/finance/non-billable-santri.ts`.
--
-- Filter runtime (bukan hanya migration ini) adalah pertahanan utama:
--   lib/finance/non-billable-santri.ts  ->  nonBillableSantriSqlPredicate()
--   dipakai oleh matriks status pembayaran, kewajiban, order, pembayaran,
--   uang jajan, kredensial, penyaluran, rekonsiliasi, dan seluruh laporan.

-- ---------------------------------------------------------------------------
-- 1. Catat pembebasan menyeluruh sebagai audit trail (idempotent).
--    academic_year_id NULL + period_start/period_end NULL = berlaku untuk
--    seluruh tahun ajaran dan seluruh periode.
-- ---------------------------------------------------------------------------
INSERT INTO finance_exemptions (
    id, santri_id, item_type, academic_year_id,
    period_start, period_end, reason, notes,
    created_by, created_at, status
)
SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
    s.id,
    'ALL',
    NULL,
    NULL,
    NULL,
    'Penduduk setempat (asrama AL-BAGHORY) - bebas seluruh tagihan keuangan',
    'Dibuat otomatis oleh migration 0171_finance_exclude_al_baghory_santri.sql',
    NULL,
    datetime('now'),
    'ACTIVE'
FROM santri s
WHERE UPPER(TRIM(COALESCE(s.asrama, ''))) = 'AL-BAGHORY'
  AND NOT EXISTS (
      SELECT 1 FROM finance_exemptions fe
      WHERE fe.santri_id = s.id
        AND fe.item_type = 'ALL'
        AND fe.reason LIKE 'Penduduk setempat%'
  );

-- ---------------------------------------------------------------------------
-- 2. Bebaskan kewajiban yang belum pernah dibayar (amount_paid = 0).
--    amount_exempted disamakan dengan amount_expected agar invariant
--    CHECK (amount_exempted <= amount_expected) tetap terpenuhi.
-- ---------------------------------------------------------------------------
UPDATE finance_obligations
SET amount_exempted = amount_expected,
    status = 'EXEMPTED',
    updated_at = datetime('now')
WHERE santri_id IN (
        SELECT id FROM santri
        WHERE UPPER(TRIM(COALESCE(asrama, ''))) = 'AL-BAGHORY'
      )
  AND amount_paid = 0
  AND status <> 'EXEMPTED';

-- ---------------------------------------------------------------------------
-- 3. Verifikasi manual (dijalankan terpisah, TIDAK memutasi data).
--    Jalankan query berikut bila ingin memastikan tidak ada transaksi finansial
--    milik santri bebas tagihan yang perlu ditinjau bendahara.
--
-- SELECT 'obligation_terbayar' AS jenis, COUNT(*) AS jumlah
--   FROM finance_obligations o
--   JOIN santri s ON s.id = o.santri_id
--  WHERE UPPER(TRIM(COALESCE(s.asrama, ''))) = 'AL-BAGHORY' AND o.amount_paid > 0
-- UNION ALL
-- SELECT 'payment', COUNT(*)
--   FROM finance_payments p
--   JOIN santri s ON s.id = p.santri_id
--  WHERE UPPER(TRIM(COALESCE(s.asrama, ''))) = 'AL-BAGHORY'
-- UNION ALL
-- SELECT 'wallet_ledger', COUNT(*)
--   FROM finance_wallet_ledger wl
--   JOIN santri s ON s.id = wl.santri_id
--  WHERE UPPER(TRIM(COALESCE(s.asrama, ''))) = 'AL-BAGHORY'
-- UNION ALL
-- SELECT 'kartu_aktif', COUNT(*)
--   FROM finance_credentials c
--   JOIN santri s ON s.id = c.santri_id
--  WHERE UPPER(TRIM(COALESCE(s.asrama, ''))) = 'AL-BAGHORY' AND c.status = 'ACTIVE';
-- ---------------------------------------------------------------------------
