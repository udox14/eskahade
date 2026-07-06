-- Migration 0110: Draft mechanism untuk Penempatan Kelas.
-- Penempatan tidak langsung permanen. User assign santri -> masuk draft dulu.
-- Setelah direview di tab "Review Draft", baru difinalisasi (apply ke riwayat_pendidikan).
-- Pola mengikuti kamar_draft (migration 0007).
-- Idempotent.

CREATE TABLE IF NOT EXISTS penempatan_draft (
  id                  TEXT PRIMARY KEY,
  santri_id           TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  kelas_id            TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  riwayat_lama_id     TEXT,
  marhalah_target_id  TEXT NOT NULL,
  sumber              TEXT NOT NULL, -- 'baru' | 'lama'
  created_by          TEXT,
  created_at          TEXT NOT NULL,
  UNIQUE(santri_id)
);

CREATE INDEX IF NOT EXISTS idx_penempatan_draft_kelas ON penempatan_draft(kelas_id);
CREATE INDEX IF NOT EXISTS idx_penempatan_draft_marhalah ON penempatan_draft(marhalah_target_id);
