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

CREATE TABLE IF NOT EXISTS ehb_keuangan_transaksi (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  tipe           TEXT NOT NULL,
  tanggal        TEXT NOT NULL,
  kategori       TEXT NOT NULL,
  uraian         TEXT NOT NULL,
  qty            REAL NOT NULL DEFAULT 1,
  harga          INTEGER NOT NULL DEFAULT 0,
  nominal        INTEGER NOT NULL DEFAULT 0,
  keterangan     TEXT,
  rab_item_id    INTEGER REFERENCES ehb_rab_item(id) ON DELETE SET NULL,
  is_system      INTEGER NOT NULL DEFAULT 0,
  system_key     TEXT,
  urutan         INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_ehb_keuangan_transaksi_event
  ON ehb_keuangan_transaksi(ehb_event_id, tanggal, tipe, urutan);

CREATE TABLE IF NOT EXISTS ehb_honor_mapel_config (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  marhalah_id    INTEGER REFERENCES marhalah(id),
  waktu          TEXT NOT NULL,
  jumlah_mapel   INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT,
  UNIQUE(ehb_event_id, marhalah_id, waktu)
);

CREATE TABLE IF NOT EXISTS ehb_honor_manual (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  jenis          TEXT NOT NULL,
  guru_id        INTEGER REFERENCES data_guru(id),
  nama           TEXT NOT NULL,
  mapel_id       INTEGER REFERENCES mapel(id),
  mapel_nama     TEXT,
  qty            REAL NOT NULL DEFAULT 0,
  keterangan     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_ehb_honor_manual_event
  ON ehb_honor_manual(ehb_event_id, jenis, nama);

CREATE TABLE IF NOT EXISTS ehb_pembuat_soal (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  mapel_id       INTEGER NOT NULL REFERENCES mapel(id),
  guru_id        INTEGER REFERENCES data_guru(id),
  nama_guru      TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT,
  UNIQUE(ehb_event_id, mapel_id)
);

CREATE INDEX IF NOT EXISTS idx_ehb_pembuat_soal_event
  ON ehb_pembuat_soal(ehb_event_id, guru_id);

CREATE TABLE IF NOT EXISTS ehb_pembuat_soal_marhalah (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  marhalah_id    INTEGER NOT NULL REFERENCES marhalah(id),
  mapel_id       INTEGER NOT NULL REFERENCES mapel(id),
  guru_id        INTEGER REFERENCES data_guru(id),
  nama_guru      TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT,
  UNIQUE(ehb_event_id, marhalah_id, mapel_id)
);

CREATE INDEX IF NOT EXISTS idx_ehb_pembuat_soal_marhalah_event
  ON ehb_pembuat_soal_marhalah(ehb_event_id, marhalah_id, guru_id);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('EHB', 'Keuangan', '/dashboard/ehb/keuangan', 'Wallet', '["admin"]', 1, 12);
