-- Aktifkan metadata audit saat izin otomatis pada absen malam dioverride.
ALTER TABLE absen_malam_v2 ADD COLUMN sumber_status TEXT;
ALTER TABLE absen_malam_v2 ADD COLUMN override_dari_status TEXT;
ALTER TABLE absen_malam_v2 ADD COLUMN override_by TEXT REFERENCES users(id);
ALTER TABLE absen_malam_v2 ADD COLUMN override_at TEXT;

CREATE INDEX IF NOT EXISTS idx_perizinan_active_window
  ON perizinan(santri_id, status, tgl_mulai, tgl_selesai_rencana);
