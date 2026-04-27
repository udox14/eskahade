-- ============================================================
-- Migration 0033: Absensi Pengawas EHB
-- ============================================================

CREATE TABLE IF NOT EXISTS ehb_absensi_pengawas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id        INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  jadwal_pengawas_id  INTEGER NOT NULL REFERENCES ehb_jadwal_pengawas(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'HADIR',
  badal_source        TEXT,
  badal_pengawas_id   INTEGER REFERENCES ehb_pengawas(id),
  badal_panitia_id    INTEGER REFERENCES ehb_panitia(id),
  badal_nama          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT,
  UNIQUE(ehb_event_id, jadwal_pengawas_id)
);

CREATE INDEX IF NOT EXISTS idx_ehb_absensi_pengawas_event
  ON ehb_absensi_pengawas(ehb_event_id, status);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('EHB', 'Absensi Pengawas', '/dashboard/ehb/absensi-pengawas', 'ClipboardCheck', '["admin"]', 1, 13);

