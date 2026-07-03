CREATE TABLE IF NOT EXISTS tes_klasifikasi_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id),
  nama TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tes_klasifikasi_sesi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL,
  nomor_sesi INTEGER NOT NULL,
  label TEXT NOT NULL,
  waktu_mulai TEXT,
  waktu_selesai TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, tanggal, nomor_sesi)
);

CREATE TABLE IF NOT EXISTS tes_klasifikasi_ruangan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
  nomor_ruangan INTEGER NOT NULL,
  nama_ruangan TEXT NOT NULL,
  tempat TEXT,
  kapasitas INTEGER NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, nomor_ruangan)
);

CREATE TABLE IF NOT EXISTS tes_klasifikasi_ruangan_petugas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
  sesi_id INTEGER NOT NULL REFERENCES tes_klasifikasi_sesi(id) ON DELETE CASCADE,
  ruangan_id INTEGER NOT NULL REFERENCES tes_klasifikasi_ruangan(id) ON DELETE CASCADE,
  pengetes_guru_id INTEGER REFERENCES data_guru(id),
  pendamping_guru_id INTEGER REFERENCES data_guru(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, sesi_id, ruangan_id)
);

CREATE TABLE IF NOT EXISTS tes_klasifikasi_plotting_rule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
  sesi_id INTEGER NOT NULL REFERENCES tes_klasifikasi_sesi(id) ON DELETE CASCADE,
  ruangan_id INTEGER NOT NULL REFERENCES tes_klasifikasi_ruangan(id) ON DELETE CASCADE,
  jenis_kelamin TEXT NOT NULL,
  levels_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, sesi_id, ruangan_id)
);

CREATE TABLE IF NOT EXISTS tes_klasifikasi_plotting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
  sesi_id INTEGER NOT NULL REFERENCES tes_klasifikasi_sesi(id) ON DELETE CASCADE,
  ruangan_id INTEGER NOT NULL REFERENCES tes_klasifikasi_ruangan(id) ON DELETE CASCADE,
  santri_id TEXT NOT NULL REFERENCES santri(id),
  nomor_urut INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, santri_id)
);

CREATE INDEX IF NOT EXISTS idx_tk_sesi_event ON tes_klasifikasi_sesi(event_id);
CREATE INDEX IF NOT EXISTS idx_tk_ruangan_event ON tes_klasifikasi_ruangan(event_id);
CREATE INDEX IF NOT EXISTS idx_tk_petugas_event ON tes_klasifikasi_ruangan_petugas(event_id);
CREATE INDEX IF NOT EXISTS idx_tk_rule_event ON tes_klasifikasi_plotting_rule(event_id);
CREATE INDEX IF NOT EXISTS idx_tk_plotting_event ON tes_klasifikasi_plotting(event_id);
CREATE INDEX IF NOT EXISTS idx_tk_plotting_santri ON tes_klasifikasi_plotting(santri_id);
