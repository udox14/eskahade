-- Tabel pengajuan izin dari asrama (menunggu persetujuan dewan santri)
CREATE TABLE IF NOT EXISTS perizinan_pengajuan (
  id TEXT PRIMARY KEY,
  santri_id TEXT NOT NULL REFERENCES santri(id),
  jenis TEXT NOT NULL DEFAULT 'PULANG',
  tgl_mulai TEXT NOT NULL,
  tgl_selesai_rencana TEXT NOT NULL,
  alasan TEXT NOT NULL,
  pemberi_izin TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  submitted_by TEXT REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_perizinan_pengajuan_status ON perizinan_pengajuan(status);
CREATE INDEX IF NOT EXISTS idx_perizinan_pengajuan_santri ON perizinan_pengajuan(santri_id);

-- Tambah pengurus_asrama ke akses perizinan
UPDATE fitur_akses
SET roles = '["admin","dewan_santri","pengurus_asrama"]'
WHERE href = '/dashboard/keamanan/perizinan';
