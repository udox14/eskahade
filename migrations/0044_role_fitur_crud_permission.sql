-- Migration 0044: CRUD permission per role per fitur
-- Read permission tetap memakai fitur_akses.roles.
-- Tabel ini hanya menyimpan izin create/update/delete.

CREATE TABLE IF NOT EXISTS role_fitur_crud_permission (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fitur_href TEXT NOT NULL,
  role TEXT NOT NULL,
  can_create INTEGER NOT NULL DEFAULT 0,
  can_update INTEGER NOT NULL DEFAULT 0,
  can_delete INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(fitur_href, role)
);

CREATE INDEX IF NOT EXISTS idx_role_fitur_crud_href
  ON role_fitur_crud_permission(fitur_href);

CREATE INDEX IF NOT EXISTS idx_role_fitur_crud_role
  ON role_fitur_crud_permission(role);

-- Default awal: role yang sudah punya akses fitur tetap punya izin tulis,
-- supaya migration tidak memutus workflow lama. Admin tetap full akses
-- dari helper server walaupun baris DB diubah.
INSERT OR IGNORE INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
SELECT
  f.href,
  je.value,
  1,
  1,
  1,
  datetime('now'),
  datetime('now')
FROM fitur_akses f,
     json_each(f.roles) je
WHERE je.value IS NOT NULL;
