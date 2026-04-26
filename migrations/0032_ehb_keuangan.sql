-- ============================================================
-- Migration 0032: Keuangan EHB
-- ============================================================

CREATE TABLE IF NOT EXISTS ehb_rab_item (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  kategori       TEXT NOT NULL,
  nama_barang    TEXT NOT NULL,
  qty            REAL NOT NULL DEFAULT 0,
  harga          INTEGER NOT NULL DEFAULT 0,
  keterangan     TEXT,
  is_system      INTEGER NOT NULL DEFAULT 0,
  system_key     TEXT,
  urutan         INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_ehb_rab_item_event
  ON ehb_rab_item(ehb_event_id, kategori, urutan);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('EHB', 'Keuangan', '/dashboard/ehb/keuangan', 'Wallet', '["admin"]', 1, 12);
