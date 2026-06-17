-- Migration 0088: Pilihan kitab yang ditampilkan di rapor (per kelas, per mapel)
-- Mengatasi mapel ganda di rapor saat 1 mapel punya banyak judul kitab.
-- Jika tidak ada baris untuk (kelas, mapel) => rapor gabung semua judul kitab.

CREATE TABLE IF NOT EXISTS rapor_kitab_pilihan (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kelas_id   TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  mapel_id   INTEGER NOT NULL REFERENCES mapel(id) ON DELETE CASCADE,
  kitab_id   INTEGER NOT NULL REFERENCES kitab(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(kelas_id, mapel_id)
);

CREATE INDEX IF NOT EXISTS idx_rapor_kitab_pilihan_kelas
ON rapor_kitab_pilihan(kelas_id);
