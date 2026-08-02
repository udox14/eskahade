-- Move the POSKESTREN reporting entry into the dedicated Cetak module.

UPDATE fitur_akses
SET title = 'Cetak',
    href = '/dashboard/poskestren/cetak',
    icon = 'Printer',
    urutan = 5,
    updated_at = datetime('now')
WHERE href = '/dashboard/poskestren/laporan'
  AND NOT EXISTS (
    SELECT 1 FROM fitur_akses WHERE href = '/dashboard/poskestren/cetak'
  );

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan)
VALUES
  ('POSKESTREN', 'Cetak', '/dashboard/poskestren/cetak', 'Printer', '["admin","poskestren"]', 1, 5, 0, 0);

UPDATE fitur_akses
SET is_active = 0,
    updated_at = datetime('now')
WHERE href = '/dashboard/poskestren/laporan';

INSERT OR IGNORE INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
SELECT
  '/dashboard/poskestren/cetak', role, can_create, can_update, can_delete, created_at, updated_at
FROM role_fitur_crud_permission
WHERE fitur_href = '/dashboard/poskestren/laporan';

DELETE FROM role_fitur_crud_permission
WHERE fitur_href = '/dashboard/poskestren/laporan';

INSERT OR IGNORE INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
VALUES
  ('/dashboard/poskestren/cetak', 'poskestren', 0, 0, 0, datetime('now'), datetime('now'));
