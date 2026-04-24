-- ============================================================
-- Migration 0027: EHB Absensi & Susulan Module
-- ============================================================

CREATE TABLE IF NOT EXISTS ehb_absensi (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  santri_id      TEXT NOT NULL REFERENCES santri(id),
  tanggal        TEXT NOT NULL,
  sesi_id        INTEGER NOT NULL REFERENCES ehb_sesi(id),
  status_absen   TEXT NOT NULL, -- 'A', 'I', 'S'
  is_susulan_done INTEGER NOT NULL DEFAULT 0, -- 0 = Belum Susulan, 1 = Sudah Selesai Susulan
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ehb_event_id, santri_id, tanggal, sesi_id)
);

CREATE INDEX IF NOT EXISTS idx_ehb_absensi_event ON ehb_absensi(ehb_event_id);
CREATE INDEX IF NOT EXISTS idx_ehb_absensi_santri ON ehb_absensi(santri_id);
CREATE INDEX IF NOT EXISTS idx_ehb_absensi_jadwal ON ehb_absensi(tanggal, sesi_id);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('EHB', 'Absensi Keliling',  '/dashboard/ehb/absensi',           'UserCheck',   '["admin"]', 1, 3),
('EHB', 'Daftar Susulan',    '/dashboard/ehb/susulan',           'ClipboardList', '["admin"]', 1, 4);
