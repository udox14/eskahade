-- ============================================================
-- Migration 0066: Vonis Final Verifikasi Panggilan
-- ============================================================

CREATE TABLE IF NOT EXISTS verifikasi_panggilan_vonis (
  id TEXT PRIMARY KEY,
  panggilan_id TEXT NOT NULL REFERENCES verifikasi_panggilan(id),
  periode_awal TEXT NOT NULL,
  periode_akhir TEXT NOT NULL,
  santri_id TEXT NOT NULL REFERENCES santri(id),
  source TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  sesi TEXT NOT NULL,
  status_final TEXT NOT NULL,
  catatan TEXT,
  pelanggaran_id TEXT REFERENCES pelanggaran(id),
  verified_by TEXT REFERENCES users(id),
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(panggilan_id, source, tanggal, sesi)
);

CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_periode
  ON verifikasi_panggilan_vonis(periode_awal, periode_akhir, source);

CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_status
  ON verifikasi_panggilan_vonis(status_final);

CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_santri
  ON verifikasi_panggilan_vonis(santri_id);

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan)
VALUES
  ('Perizinan & Disiplin', 'Vonis Final Berjamaah', '/dashboard/keamanan/verifikasi-berjamaah', 'Gavel', '["admin","keamanan"]', 1, 4);

UPDATE fitur_akses
SET title = 'Vonis Final Berjamaah',
    updated_at = datetime('now')
WHERE href = '/dashboard/keamanan/verifikasi-berjamaah';

UPDATE fitur_akses
SET title = 'Vonis Final Pengajian',
    icon = 'ClipboardCheck',
    roles = '["admin","sekpen"]',
    updated_at = datetime('now')
WHERE href = '/dashboard/akademik/absensi/verifikasi';

UPDATE fitur_akses
SET title = 'Cetak Pemanggilan',
    group_name = 'Absensi Akademik',
    icon = 'Printer',
    roles = '["admin","sekpen"]',
    is_active = 1,
    urutan = 3,
    updated_at = datetime('now')
WHERE href = '/dashboard/akademik/absensi/cetak';
