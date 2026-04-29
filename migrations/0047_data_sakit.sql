-- ============================================================
-- Migration 0047: Data Sakit
-- ============================================================

ALTER TABLE absen_sakit ADD COLUMN sesi TEXT NOT NULL DEFAULT 'PAGI';
ALTER TABLE absen_sakit ADD COLUMN sakit_apa TEXT;
ALTER TABLE absen_sakit ADD COLUMN beli_surat INTEGER NOT NULL DEFAULT 0;
ALTER TABLE absen_sakit ADD COLUMN updated_at TEXT;

UPDATE absen_sakit
SET
  sakit_apa = CASE
    WHEN keterangan IN ('BELI_SURAT', 'TIDAK_BELI') THEN NULL
    ELSE keterangan
  END,
  beli_surat = CASE WHEN keterangan = 'BELI_SURAT' THEN 1 ELSE 0 END
WHERE sakit_apa IS NULL;

UPDATE fitur_akses
SET title = 'Data Sakit',
    group_name = 'Asrama',
    icon = 'Stethoscope',
    updated_at = datetime('now')
WHERE href = '/dashboard/asrama/absen-sakit';
