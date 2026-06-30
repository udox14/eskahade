-- Role TESTER: akses baca saja.
-- Read permission memakai fitur_akses.roles, sedangkan C/U/D tetap 0 di role_fitur_crud_permission.

UPDATE fitur_akses
SET
  roles = json_insert(roles, '$[#]', 'tester'),
  updated_at = datetime('now')
WHERE json_valid(roles)
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(fitur_akses.roles)
    WHERE value = 'tester'
  );

INSERT OR IGNORE INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
SELECT
  href,
  'tester',
  0,
  0,
  0,
  datetime('now'),
  datetime('now')
FROM fitur_akses;

UPDATE role_fitur_crud_permission
SET
  can_create = 0,
  can_update = 0,
  can_delete = 0,
  updated_at = datetime('now')
WHERE role = 'tester';
