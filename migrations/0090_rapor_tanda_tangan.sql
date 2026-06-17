-- Migration 0090: Tanda tangan rapor
-- Pimpinan: global (app_settings). Wali kelas: per user (tabel rapor_ttd_wali).
-- Posisi (pos_x/pos_y) & lebar (width) dalam px, overlay di atas teks nama.

-- TTD Pimpinan (global) - url kosong => fallback ke /ttd-pimpinan.png statis
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('rapor_ttd_pimpinan_url', ''),
  ('rapor_ttd_pimpinan_x',   '0'),
  ('rapor_ttd_pimpinan_y',   '0'),
  ('rapor_ttd_pimpinan_w',   '100');

-- TTD Wali Kelas (per user)
CREATE TABLE IF NOT EXISTS rapor_ttd_wali (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ttd_url    TEXT,
  pos_x      INTEGER NOT NULL DEFAULT 0,
  pos_y      INTEGER NOT NULL DEFAULT 0,
  width      INTEGER NOT NULL DEFAULT 100,
  updated_at TEXT
);
