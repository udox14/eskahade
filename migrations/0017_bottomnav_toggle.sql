-- Migration 0017: Bottom Nav Toggle
-- 1. Tabel app_settings (key-value) untuk setting global aplikasi
-- 2. Kolom show_bottomnav di users untuk preferensi per-user

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default: bottom nav aktif secara global
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('bottomnav_enabled', '1');

-- Kolom preferensi per-user (NULL = ikut setting global)
ALTER TABLE users ADD COLUMN show_bottomnav INTEGER DEFAULT NULL;
