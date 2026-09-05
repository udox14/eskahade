-- Catatan absensi pribadi pengajar. Tidak terhubung ke absensi_harian/pengajian resmi.
CREATE TABLE IF NOT EXISTS absensi_pengajar_sesi (
  id TEXT PRIMARY KEY,
  kelas_id TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  guru_id INTEGER REFERENCES data_guru(id) ON DELETE SET NULL,
  tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id) ON DELETE SET NULL,
  tanggal TEXT NOT NULL,
  waktu TEXT NOT NULL CHECK (waktu IN ('shubuh', 'ashar', 'maghrib')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(kelas_id, created_by, tanggal, waktu)
);

CREATE TABLE IF NOT EXISTS absensi_pengajar_detail (
  id TEXT PRIMARY KEY,
  sesi_id TEXT NOT NULL REFERENCES absensi_pengajar_sesi(id) ON DELETE CASCADE,
  riwayat_pendidikan_id TEXT NOT NULL REFERENCES riwayat_pendidikan(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'H' CHECK (status IN ('H', 'S', 'I', 'A')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(sesi_id, riwayat_pendidikan_id)
);

CREATE INDEX IF NOT EXISTS idx_absensi_pengajar_sesi_owner
  ON absensi_pengajar_sesi(created_by, kelas_id, tanggal DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_absensi_pengajar_sesi_kelas
  ON absensi_pengajar_sesi(kelas_id, tanggal DESC, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_absensi_pengajar_detail_sesi
  ON absensi_pengajar_detail(sesi_id, riwayat_pendidikan_id);

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan)
VALUES
  ('Nilai & Rapor', 'Absensi', '/dashboard/guru/absensi', 'CalendarCheck', '["admin","sekpen","akademik","guru"]', 1, 5, 0, 0);

UPDATE fitur_akses SET urutan = 6 WHERE href = '/dashboard/guru/hafalan';
