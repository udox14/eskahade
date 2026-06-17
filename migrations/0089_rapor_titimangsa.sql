-- Migration 0089: Titimangsa rapor (tempat & tanggal terbit) - universal
-- Disimpan di app_settings (key-value global, bukan per kelas).
-- tanggal kosong ('') => rapor pakai tanggal cetak hari ini.

INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('rapor_titimangsa_tempat', 'Sukahideng'),
  ('rapor_titimangsa_tanggal', '');
