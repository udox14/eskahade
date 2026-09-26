-- Migration: 0172_finance_exclude_sadesa_makan_nyuci.sql
-- Aturan bisnis: santri kategori SADESA TIDAK ditagih UANG_MAKAN dan UANG_NYUCI
-- (mereka tidak memakai katering & laundry). Item lain (SPP, EHB, EKSKUL, KESEHATAN, USPP)
-- TETAP DAPAT DITAGIH; pembebasan item lain dilakukan manual lewat Modul Pembebasan.
--
-- Melengkapi migration 0171 (asrama AL-BAGHORY bebas TOTAL seluruh tagihan).
--
-- Migration ini bersifat NON-DESTRUCTIF:
--   * Tidak ada DROP TABLE / DROP COLUMN / DELETE data.
--   * Tidak mengubah riwayat transaksi finansial yang sudah terjadi (payment,
--     allocation, correction, distribution, wallet ledger tetap utuh).
--   * Hanya membebaskan (EXEMPTED) kewajiban UANG_MAKAN / UANG_NYUCI milik santri
--     SADESA yang BELUM pernah dibayar sama sekali.
--   * Kewajiban yang sudah memiliki pembayaran (amount_paid > 0) TIDAK disentuh karena
--     termasuk riwayat finansial; baris tersebut tetap tersembunyi dari UI melalui filter
--     `nonBillableItemSqlPredicate()` di `lib/finance/non-billable-santri.ts`.

-- ---------------------------------------------------------------------------
-- 1. Audit trail pembebasan per item (UANG_MAKAN & UANG_NYUCI) untuk santri SADESA.
--    Idempotent: dibuat hanya jika belum ada pembebasan serupa yang aktif.
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
    items.item_type,
    NULL,
    NULL,
    NULL,
    'Kategori SADESA - tidak memakai ' || CASE items.item_type
        WHEN 'UANG_MAKAN' THEN 'katering'
        ELSE 'laundry'
    END,
    'Dibuat otomatis oleh migration 0172_finance_exclude_sadesa_makan_nyuci.sql',
    NULL,
    datetime('now'),
    'ACTIVE'
FROM santri s
CROSS JOIN (
    SELECT 'UANG_MAKAN' AS item_type
    UNION ALL SELECT 'UANG_NYUCI'
) AS items
WHERE UPPER(TRIM(COALESCE(s.kategori_santri, 'REGULER'))) = 'SADESA'
  AND NOT EXISTS (
      SELECT 1 FROM finance_exemptions fe
      WHERE fe.santri_id = s.id
        AND fe.item_type = items.item_type
        AND fe.reason LIKE 'Kategori SADESA%'
  );

-- ---------------------------------------------------------------------------
-- 2. Bebaskan kewajiban UANG_MAKAN / UANG_NYUCI santri SADESA yang belum pernah dibayar.
--    amount_exempted disamakan dengan amount_expected agar invariant
--    CHECK (amount_exempted <= amount_expected) tetap terpenuhi.
-- ---------------------------------------------------------------------------
UPDATE finance_obligations
SET amount_exempted = amount_expected,
    status = 'EXEMPTED',
    updated_at = datetime('now')
WHERE item_type IN ('UANG_MAKAN', 'UANG_NYUCI')
  AND santri_id IN (
        SELECT id FROM santri
        WHERE UPPER(TRIM(COALESCE(kategori_santri, 'REGULER'))) = 'SADESA'
      )
  AND amount_paid = 0
  AND status <> 'EXEMPTED';

-- ---------------------------------------------------------------------------
-- 3. Verifikasi manual (TIDAK memutasi data).
--
-- SELECT o.item_type, COUNT(*) AS jumlah, COALESCE(SUM(o.amount_paid),0) AS terbayar
--   FROM finance_obligations o
--   JOIN santri s ON s.id = o.santri_id
--  WHERE UPPER(TRIM(COALESCE(s.kategori_santri, 'REGULER'))) = 'SADESA'
--    AND o.item_type IN ('UANG_MAKAN', 'UANG_NYUCI')
--  GROUP BY o.item_type;
--
-- -- Pastikan SPP/tahunan/USPP santri SADESA TIDAK ikut dibebaskan:
-- SELECT o.item_type, o.status, COUNT(*) AS jumlah
--   FROM finance_obligations o
--   JOIN santri s ON s.id = o.santri_id
--  WHERE UPPER(TRIM(COALESCE(s.kategori_santri, 'REGULER'))) = 'SADESA'
--    AND o.item_type NOT IN ('UANG_MAKAN', 'UANG_NYUCI')
--  GROUP BY o.item_type, o.status;
-- ---------------------------------------------------------------------------
