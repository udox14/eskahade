-- ============================================================
-- Migration 0078: Progress Hafalan menempel ke Santri
-- ============================================================

ALTER TABLE hafalan_progress ADD COLUMN santri_id TEXT REFERENCES santri(id);
ALTER TABLE hafalan_progress ADD COLUMN kelas_id TEXT REFERENCES kelas(id);
ALTER TABLE hafalan_progress ADD COLUMN marhalah_id INTEGER REFERENCES marhalah(id);

UPDATE hafalan_progress
SET santri_id = (
    SELECT rp.santri_id
    FROM riwayat_pendidikan rp
    WHERE rp.id = hafalan_progress.riwayat_pendidikan_id
    LIMIT 1
  ),
  kelas_id = (
    SELECT rp.kelas_id
    FROM riwayat_pendidikan rp
    WHERE rp.id = hafalan_progress.riwayat_pendidikan_id
    LIMIT 1
  ),
  marhalah_id = (
    SELECT k.marhalah_id
    FROM riwayat_pendidikan rp
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE rp.id = hafalan_progress.riwayat_pendidikan_id
    LIMIT 1
  )
WHERE santri_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_hafalan_progress_santri
  ON hafalan_progress(santri_id, blok_id);
CREATE INDEX IF NOT EXISTS idx_hafalan_progress_scope
  ON hafalan_progress(marhalah_id, kelas_id);
