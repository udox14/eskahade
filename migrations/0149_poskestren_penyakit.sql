-- Laporan kasus penyakit interaktif dan master diagnosis POSKESTREN.

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan)
VALUES
  ('POSKESTREN', 'Penyakit', '/dashboard/poskestren/penyakit', 'BarChart3', '["admin","poskestren"]', 1, 2, 0, 0);

UPDATE fitur_akses
SET urutan = CASE href
  WHEN '/dashboard/poskestren/pemeriksaan' THEN 1
  WHEN '/dashboard/poskestren/penyakit' THEN 2
  WHEN '/dashboard/poskestren/observasi' THEN 3
  WHEN '/dashboard/poskestren/obat' THEN 4
  WHEN '/dashboard/poskestren/keuangan' THEN 5
  WHEN '/dashboard/poskestren/cetak' THEN 6
  WHEN '/dashboard/poskestren/manajemen' THEN 7
  ELSE urutan
END,
updated_at = datetime('now')
WHERE group_name = 'POSKESTREN';

INSERT OR IGNORE INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
VALUES
  ('/dashboard/poskestren/penyakit', 'poskestren', 1, 1, 0, datetime('now'), datetime('now'));

CREATE INDEX IF NOT EXISTS idx_pos_clinical_exam_report
  ON poskestren_clinical_exam(examined_at, id);

CREATE INDEX IF NOT EXISTS idx_mutasi_santri_date
  ON mutasi_asrama_log(santri_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_santri_disease_population
  ON santri(status_global, tanggal_masuk, tanggal_keluar, jenis_kelamin, asrama);

CREATE INDEX IF NOT EXISTS idx_santri_nonaktif_period
  ON santri_nonaktif_log(santri_id, tanggal_mulai, tanggal_aktif_aktual);
