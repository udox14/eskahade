-- Migration 0018: Fitur Perpulangan & Kedatangan
-- Tabel periode (dikelola dewan santri / keamanan / admin)
-- Tabel log per santri per periode (diisi pengurus asrama)

CREATE TABLE IF NOT EXISTS perpulangan_periode (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_periode          TEXT NOT NULL,
  tgl_mulai_pulang      TEXT NOT NULL,  -- YYYY-MM-DD
  tgl_selesai_pulang    TEXT NOT NULL,  -- YYYY-MM-DD
  tgl_mulai_datang      TEXT NOT NULL,  -- YYYY-MM-DD
  tgl_selesai_datang    TEXT NOT NULL,  -- YYYY-MM-DD, bisa diperpanjang
  is_active             INTEGER NOT NULL DEFAULT 0,  -- hanya 1 yang aktif
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Log perpulangan per santri per periode
-- UNIQUE(santri_id, periode_id) — satu baris per santri per periode
CREATE TABLE IF NOT EXISTS perpulangan_log (
  id              TEXT PRIMARY KEY,
  santri_id       TEXT NOT NULL REFERENCES santri(id),
  periode_id      INTEGER NOT NULL REFERENCES perpulangan_periode(id),
  jenis_pulang    TEXT,  -- ROMBONGAN | DIJEMPUT | NULL (belum ditentukan)
  status_pulang   TEXT NOT NULL DEFAULT 'BELUM',  -- BELUM | PULANG
  keterangan      TEXT,  -- opsional, isian bebas pengurus
  tgl_pulang      TEXT,  -- ISO timestamp saat dikonfirmasi pulang
  status_datang   TEXT NOT NULL DEFAULT 'BELUM',  -- BELUM | SUDAH | TELAT | VONIS
  tgl_datang      TEXT,  -- ISO timestamp saat dikonfirmasi datang
  created_by      TEXT REFERENCES users(id),
  updated_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(santri_id, periode_id)
);

CREATE INDEX IF NOT EXISTS idx_perpulangan_log_santri   ON perpulangan_log(santri_id);
CREATE INDEX IF NOT EXISTS idx_perpulangan_log_periode  ON perpulangan_log(periode_id);
CREATE INDEX IF NOT EXISTS idx_perpulangan_log_status   ON perpulangan_log(status_pulang, status_datang);
CREATE INDEX IF NOT EXISTS idx_perpulangan_log_periode_asrama
  ON perpulangan_log(periode_id, status_pulang, status_datang);
