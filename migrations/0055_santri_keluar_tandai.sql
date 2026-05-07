CREATE TABLE IF NOT EXISTS santri_keluar_tandai (
  id                TEXT PRIMARY KEY,
  santri_id         TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  asrama            TEXT NOT NULL,
  kamar             TEXT,
  tanggal_tandai    TEXT NOT NULL,
  catatan           TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  ditandai_oleh     TEXT REFERENCES users(id),
  diproses_oleh     TEXT REFERENCES users(id),
  diproses_at       TEXT,
  keputusan_catatan TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_santri_keluar_tandai_status
  ON santri_keluar_tandai(status, asrama, tanggal_tandai);

CREATE INDEX IF NOT EXISTS idx_santri_keluar_tandai_santri
  ON santri_keluar_tandai(santri_id, status);
