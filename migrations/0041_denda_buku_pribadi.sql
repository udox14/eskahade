-- ============================================================
-- Migration 0041: Denda Buku Pribadi
-- ============================================================

CREATE TABLE IF NOT EXISTS denda_buku_pribadi (
  id             TEXT PRIMARY KEY,
  santri_id      TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  tanggal        TEXT NOT NULL,
  kehilangan_ke  INTEGER NOT NULL,
  nominal        INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'BELUM_BAYAR',
  keterangan     TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at        TEXT,
  paid_by        TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_denda_buku_pribadi_santri
  ON denda_buku_pribadi(santri_id, kehilangan_ke);

CREATE INDEX IF NOT EXISTS idx_denda_buku_pribadi_status
  ON denda_buku_pribadi(status, tanggal);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Perizinan & Disiplin', 'Denda Buku Pribadi', '/dashboard/keamanan/denda-buku-pribadi', 'Book', '["admin","dewan_santri"]', 1, 5);
