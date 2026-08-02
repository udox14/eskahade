-- Pastikan pengurus asrama dapat mengajukan izin pulang.
-- Migration 0085 sebelumnya hanya menambahkan role ke fitur_akses (read),
-- sedangkan halaman dan server action sekarang memakai permission CRUD.

UPDATE fitur_akses
SET
  roles = json_insert(roles, '$[#]', 'pengurus_asrama'),
  updated_at = datetime('now')
WHERE href = '/dashboard/keamanan/perizinan'
  AND json_valid(roles)
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(fitur_akses.roles)
    WHERE value = 'pengurus_asrama'
  );

INSERT INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
VALUES
  ('/dashboard/keamanan/perizinan', 'pengurus_asrama', 1, 1, 1, datetime('now'), datetime('now'))
ON CONFLICT(fitur_href, role) DO UPDATE SET
  can_create = 1,
  updated_at = datetime('now');
