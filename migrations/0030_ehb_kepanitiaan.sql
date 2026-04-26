-- ============================================================
-- Migration 0030: Kepanitiaan EHB
-- ============================================================

CREATE TABLE IF NOT EXISTS ehb_panitia (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  tipe           TEXT NOT NULL, -- 'inti' | 'seksi'
  jabatan_key    TEXT,
  seksi_key      TEXT,
  peran          TEXT, -- 'ketua' | 'anggota' | NULL
  guru_id        INTEGER REFERENCES data_guru(id),
  nama           TEXT NOT NULL,
  urutan         INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ehb_panitia_inti_unique
  ON ehb_panitia(ehb_event_id, jabatan_key)
  WHERE tipe = 'inti';

CREATE INDEX IF NOT EXISTS idx_ehb_panitia_event
  ON ehb_panitia(ehb_event_id, tipe, seksi_key, urutan);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('EHB', 'Kepanitiaan', '/dashboard/ehb/kepanitiaan', 'UserCog', '["admin"]', 1, 11);
