-- Migration 0028: Mutasi Asrama
-- Tabel log untuk mencatat setiap perpindahan santri antar asrama

CREATE TABLE IF NOT EXISTS mutasi_asrama_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  santri_id      TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  asrama_lama    TEXT,
  kamar_lama     TEXT,
  asrama_baru    TEXT NOT NULL,
  kamar_baru     TEXT,
  alasan         TEXT,
  dilakukan_oleh TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mutasi_santri ON mutasi_asrama_log(santri_id);
CREATE INDEX IF NOT EXISTS idx_mutasi_date   ON mutasi_asrama_log(created_at);

-- Daftarkan fitur Mutasi Asrama ke sidebar (urutan 6.5 → setelah Perpindahan Kamar)
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  'Kesantrian',
  'Mutasi Asrama',
  '/dashboard/asrama/mutasi-asrama',
  'Shuffle',
  '["admin","pengurus_asrama"]',
  1,
  7
);

-- Geser urutan Absen Sakit, Katering, dan seterusnya +1 agar tidak tabrakan
-- (INSERT OR IGNORE di atas pakai urutan 7 — jika sudah ada item di urutan 7,
--  keduanya tetap tampil karena urutan bukan UNIQUE, hanya untuk sort)
