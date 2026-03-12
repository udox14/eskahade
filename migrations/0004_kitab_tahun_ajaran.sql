-- ============================================================
-- Migration 0004: Tambah tahun_ajaran_id ke tabel kitab
-- ============================================================

ALTER TABLE kitab ADD COLUMN tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id);

-- Set semua kitab yang ada ke tahun ajaran aktif (jika ada)
UPDATE kitab SET tahun_ajaran_id = (
  SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1
) WHERE tahun_ajaran_id IS NULL;
