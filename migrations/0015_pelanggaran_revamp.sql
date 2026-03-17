-- Migration: Revamp Fitur Pelanggaran & SP
-- ============================================================

-- 1. Tambah kolom deskripsi & urutan ke master_pelanggaran
ALTER TABLE master_pelanggaran ADD COLUMN deskripsi TEXT;
ALTER TABLE master_pelanggaran ADD COLUMN urutan    INTEGER DEFAULT 0;

-- 2. Tambah kolom master_id & foto_url ke pelanggaran (nullable, kompatibel data lama)
ALTER TABLE pelanggaran ADD COLUMN master_id  INTEGER REFERENCES master_pelanggaran(id);
ALTER TABLE pelanggaran ADD COLUMN foto_url   TEXT;

-- 3. Tabel surat pernyataan
CREATE TABLE IF NOT EXISTS surat_pernyataan (
  id               TEXT PRIMARY KEY,
  santri_id        TEXT NOT NULL REFERENCES santri(id),
  pelanggaran_ids  TEXT NOT NULL,          -- JSON array of pelanggaran.id
  tanggal          TEXT NOT NULL,
  dibuat_oleh      TEXT REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Tabel surat perjanjian (SP)
CREATE TABLE IF NOT EXISTS surat_perjanjian (
  id          TEXT PRIMARY KEY,
  santri_id   TEXT NOT NULL REFERENCES santri(id),
  level       TEXT NOT NULL,               -- SP1 | SP2 | SP3 | SK
  tanggal     TEXT NOT NULL,
  catatan     TEXT,
  dibuat_oleh TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_pelanggaran_santri   ON pelanggaran(santri_id);
CREATE INDEX IF NOT EXISTS idx_pelanggaran_tanggal  ON pelanggaran(tanggal);
CREATE INDEX IF NOT EXISTS idx_surat_pernyataan_santri ON surat_pernyataan(santri_id);
CREATE INDEX IF NOT EXISTS idx_surat_perjanjian_santri ON surat_perjanjian(santri_id);

-- 6. Hapus menu Master Pelanggaran dari sidebar (sudah dipindah ke sini)
UPDATE fitur_akses SET is_active = 0 WHERE href = '/dashboard/master/pelanggaran';
