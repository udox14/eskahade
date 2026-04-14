-- ============================================================
-- 0021_multi_role.sql
-- Multi-Role RBAC + Per-User Feature Grant/Revoke
-- ============================================================

-- 1. Tambah kolom roles (JSON array) ke users
--    NULL = belum di-migrate, fallback ke [role]
ALTER TABLE users ADD COLUMN roles TEXT DEFAULT NULL;

-- 2. Tabel override per-user: grant/revoke fitur tertentu
CREATE TABLE IF NOT EXISTS user_fitur_override (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fitur_id   INTEGER NOT NULL REFERENCES fitur_akses(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK(action IN ('grant','revoke')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, fitur_id)
);

CREATE INDEX IF NOT EXISTS idx_user_fitur_override_user ON user_fitur_override(user_id);
