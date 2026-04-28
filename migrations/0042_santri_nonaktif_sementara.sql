-- Migration 0042: Santri Nonaktif Sementara
-- Status ini untuk santri yang tetap terdaftar, tetapi sementara tidak ikut aktivitas pesantren.

CREATE TABLE IF NOT EXISTS santri_nonaktif_log (
  id                    TEXT PRIMARY KEY,
  santri_id             TEXT NOT NULL REFERENCES santri(id),
  tanggal_mulai         TEXT NOT NULL,
  tanggal_rencana_aktif TEXT,
  tanggal_aktif_aktual  TEXT,
  alasan                TEXT NOT NULL,
  catatan               TEXT,
  status                TEXT NOT NULL DEFAULT 'AKTIF', -- AKTIF | SELESAI
  created_by            TEXT REFERENCES users(id),
  closed_by             TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_santri_nonaktif_log_santri
  ON santri_nonaktif_log(santri_id);

CREATE INDEX IF NOT EXISTS idx_santri_nonaktif_log_status
  ON santri_nonaktif_log(status, tanggal_mulai);

CREATE INDEX IF NOT EXISTS idx_santri_status_nonaktif
  ON santri(status_global);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  'Data Santri',
  'Nonaktif Sementara',
  '/dashboard/santri/nonaktif',
  'UserMinus',
  '["admin","sekpen","dewan_santri"]',
  1,
  5
);

UPDATE fitur_akses
SET urutan = 6, updated_at = datetime('now')
WHERE href = '/dashboard/santri/arsip';
