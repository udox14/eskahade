-- ============================================================
-- Migration 0057: Kas Operasional Unit Bulanan
-- ============================================================

CREATE TABLE IF NOT EXISTS operasional_unit (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  asrama_name   TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS operasional_alokasi_bulanan (
  id            TEXT PRIMARY KEY,
  tahun         INTEGER NOT NULL,
  bulan         INTEGER NOT NULL,
  unit_id       TEXT NOT NULL REFERENCES operasional_unit(id),
  nominal       INTEGER NOT NULL DEFAULT 0,
  catatan       TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',
  created_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT,
  posted_by     TEXT REFERENCES users(id),
  posted_at     TEXT,
  cancelled_by  TEXT REFERENCES users(id),
  cancelled_at  TEXT,
  UNIQUE(tahun, bulan, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_operasional_alokasi_periode
  ON operasional_alokasi_bulanan(tahun, bulan, unit_id, status);

CREATE TABLE IF NOT EXISTS operasional_transaksi (
  id                TEXT PRIMARY KEY,
  tanggal           TEXT NOT NULL,
  periode_tahun     INTEGER NOT NULL,
  periode_bulan     INTEGER NOT NULL,
  unit_id           TEXT NOT NULL REFERENCES operasional_unit(id),
  tipe              TEXT NOT NULL,
  sumber_pemasukan  TEXT,
  kategori          TEXT,
  uraian            TEXT NOT NULL,
  qty               REAL NOT NULL DEFAULT 1,
  harga_satuan      INTEGER NOT NULL DEFAULT 0,
  nominal           INTEGER NOT NULL DEFAULT 0,
  partner_name      TEXT,
  catatan           TEXT,
  receipt_url       TEXT,
  alokasi_id        TEXT REFERENCES operasional_alokasi_bulanan(id) ON DELETE SET NULL,
  is_system         INTEGER NOT NULL DEFAULT 0,
  is_deleted        INTEGER NOT NULL DEFAULT 0,
  deleted_by        TEXT REFERENCES users(id),
  deleted_at        TEXT,
  created_by        TEXT REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_operasional_transaksi_periode
  ON operasional_transaksi(periode_tahun, periode_bulan, unit_id, tipe, is_deleted);

CREATE INDEX IF NOT EXISTS idx_operasional_transaksi_alokasi
  ON operasional_transaksi(alokasi_id, is_deleted);

CREATE TABLE IF NOT EXISTS operasional_ttd_pref (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id         TEXT NOT NULL,
  report_type     TEXT NOT NULL,
  scope_key       TEXT NOT NULL,
  slot1_label     TEXT NOT NULL DEFAULT '',
  slot1_nama      TEXT NOT NULL DEFAULT '',
  slot1_jabatan   TEXT NOT NULL DEFAULT '',
  slot2_label     TEXT NOT NULL DEFAULT '',
  slot2_nama      TEXT NOT NULL DEFAULT '',
  slot2_jabatan   TEXT NOT NULL DEFAULT '',
  slot3_label     TEXT NOT NULL DEFAULT '',
  slot3_nama      TEXT NOT NULL DEFAULT '',
  slot3_jabatan   TEXT NOT NULL DEFAULT '',
  updated_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT,
  UNIQUE(unit_id, report_type, scope_key)
);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('Operasional', 'Kas Operasional Unit', '/dashboard/operasional', 'WalletCards', '["pengurus_asrama","sekpen","keamanan"]', 1, 0),
('Keuangan Pusat', 'Operasional Unit', '/dashboard/keuangan/operasional', 'Wallet', '["admin","bendahara"]', 1, 3);

DELETE FROM fitur_akses
WHERE href IN ('/dashboard/operasional/cetak', '/dashboard/keuangan/operasional/cetak');
