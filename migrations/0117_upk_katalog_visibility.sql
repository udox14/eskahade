-- Pengaturan global tampilan daftar harga Katalog UPK.
-- Data lama tetap menampilkan harga item dan total.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('upk_katalog_show_item_prices', '1'),
  ('upk_katalog_show_total_price', '1');
