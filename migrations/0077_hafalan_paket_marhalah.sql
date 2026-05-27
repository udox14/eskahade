-- ============================================================
-- Migration 0077: Paket Hafalan lintas marhalah
-- ============================================================

CREATE TABLE IF NOT EXISTS hafalan_paket (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis       TEXT NOT NULL,
  nama        TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(jenis, nama)
);

CREATE TABLE IF NOT EXISTS hafalan_paket_marhalah (
  paket_id    INTEGER NOT NULL REFERENCES hafalan_paket(id) ON DELETE CASCADE,
  marhalah_id INTEGER NOT NULL REFERENCES marhalah(id) ON DELETE CASCADE,
  jenis       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (paket_id, marhalah_id),
  UNIQUE(jenis, marhalah_id)
);

ALTER TABLE hafalan_bab ADD COLUMN paket_id INTEGER REFERENCES hafalan_paket(id);

INSERT OR IGNORE INTO hafalan_paket (jenis, nama)
SELECT DISTINCT hb.jenis, COALESCE(m.nama, 'Marhalah ' || hb.marhalah_id)
FROM hafalan_bab hb
LEFT JOIN marhalah m ON m.id = hb.marhalah_id;

INSERT OR IGNORE INTO hafalan_paket_marhalah (paket_id, marhalah_id, jenis)
SELECT hp.id, hb.marhalah_id, hb.jenis
FROM hafalan_bab hb
JOIN marhalah m ON m.id = hb.marhalah_id
JOIN hafalan_paket hp ON hp.jenis = hb.jenis AND hp.nama = m.nama
GROUP BY hp.id, hb.marhalah_id, hb.jenis;

UPDATE hafalan_bab
SET paket_id = (
  SELECT hp.id
  FROM hafalan_paket hp
  JOIN marhalah m ON m.id = hafalan_bab.marhalah_id
  WHERE hp.jenis = hafalan_bab.jenis
    AND hp.nama = m.nama
  LIMIT 1
)
WHERE paket_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_hafalan_paket_lookup
  ON hafalan_paket(jenis, is_active, nama);
CREATE INDEX IF NOT EXISTS idx_hafalan_paket_marhalah_lookup
  ON hafalan_paket_marhalah(jenis, marhalah_id);
CREATE INDEX IF NOT EXISTS idx_hafalan_bab_paket
  ON hafalan_bab(paket_id, jenis, is_active, urutan);
