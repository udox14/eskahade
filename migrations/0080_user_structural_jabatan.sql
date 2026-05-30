-- Migration 0080: Jabatan struktural user
-- Dipakai untuk akses global berbasis jabatan, misalnya jabatan:bendahara.
-- Nilai kosong/null di app diperlakukan sebagai "anggota" untuk role struktural.

ALTER TABLE users ADD COLUMN structural_jabatan TEXT DEFAULT 'anggota';

CREATE INDEX IF NOT EXISTS idx_users_structural_jabatan
  ON users(structural_jabatan);
