-- Migration 0091: Nama pimpinan di rapor (editable, tidak lagi hardcoded)
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('rapor_ttd_pimpinan_nama', 'Drs. KH. Ii Abdul Basith Wahab');
