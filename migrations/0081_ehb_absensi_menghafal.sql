-- Migration 0081: Absensi Menghafal EHB

CREATE TABLE IF NOT EXISTS ehb_absensi_menghafal (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  santri_id      TEXT NOT NULL REFERENCES santri(id),
  tanggal        TEXT NOT NULL,
  sesi_id        INTEGER NOT NULL REFERENCES ehb_sesi(id),
  status_absen   TEXT NOT NULL, -- 'H', 'A', 'I', 'S'
  asrama         TEXT,
  blok           TEXT,
  kamar          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT,
  UNIQUE(ehb_event_id, santri_id, tanggal, sesi_id)
);

CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_event ON ehb_absensi_menghafal(ehb_event_id);
CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_santri ON ehb_absensi_menghafal(santri_id);
CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_jadwal ON ehb_absensi_menghafal(tanggal, sesi_id);
CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_status ON ehb_absensi_menghafal(status_absen);
CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_asrama_kamar ON ehb_absensi_menghafal(asrama, blok, kamar);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('EHB', 'Absensi Menghafal', '/dashboard/ehb/absensi-menghafal', 'BookMarked', '["admin"]', 1, 4),
('EHB', 'Rekap Menghafal', '/dashboard/ehb/absensi-menghafal/rekap', 'ClipboardList', '["admin"]', 1, 5);
