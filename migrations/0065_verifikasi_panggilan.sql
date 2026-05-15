-- ============================================================
-- Migration 0065: Verifikasi Panggilan Santri
-- ============================================================

CREATE TABLE IF NOT EXISTS verifikasi_panggilan (
  id TEXT PRIMARY KEY,
  periode_awal TEXT NOT NULL,
  periode_akhir TEXT NOT NULL,
  santri_id TEXT NOT NULL REFERENCES santri(id),
  keputusan TEXT NOT NULL, -- DIPANGGIL | TIDAK_DIPANGGIL
  jumlah_alfa_pengajian INTEGER NOT NULL DEFAULT 0,
  jumlah_alfa_berjamaah INTEGER NOT NULL DEFAULT 0,
  total_alfa INTEGER NOT NULL DEFAULT 0,
  snapshot_json TEXT NOT NULL,
  catatan TEXT,
  verified_by TEXT REFERENCES users(id),
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(periode_awal, periode_akhir, santri_id)
);

CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_periode
  ON verifikasi_panggilan(periode_awal, periode_akhir);

CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_keputusan
  ON verifikasi_panggilan(keputusan);

CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_santri
  ON verifikasi_panggilan(santri_id);

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan)
VALUES
  ('Perizinan & Disiplin', 'Verifikasi Panggilan', '/dashboard/keamanan/verifikasi-panggilan', 'UserCheck', '["admin","keamanan","sekpen"]', 1, 3);

UPDATE fitur_akses
SET group_name = 'Asrama',
    title = 'Cetak Telat Perpulangan',
    href = '/dashboard/asrama/perpulangan/cetak-telat',
    icon = 'Clock',
    roles = '["admin","keamanan","dewan_santri"]',
    urutan = 10,
    updated_at = datetime('now')
WHERE href = '/dashboard/keamanan/perizinan/cetak-telat';

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan)
VALUES
  ('Asrama', 'Cetak Telat Perpulangan', '/dashboard/asrama/perpulangan/cetak-telat', 'Clock', '["admin","keamanan","dewan_santri"]', 1, 10);

UPDATE fitur_akses
SET group_name = 'Asrama',
    title = 'Verifikasi Telat Perpulangan',
    href = '/dashboard/asrama/perpulangan/verifikasi-telat',
    icon = 'Gavel',
    roles = '["admin","keamanan","dewan_santri"]',
    urutan = 11,
    updated_at = datetime('now')
WHERE href = '/dashboard/keamanan/perizinan/verifikasi-telat';

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan)
VALUES
  ('Asrama', 'Verifikasi Telat Perpulangan', '/dashboard/asrama/perpulangan/verifikasi-telat', 'Gavel', '["admin","keamanan","dewan_santri"]', 1, 11);
