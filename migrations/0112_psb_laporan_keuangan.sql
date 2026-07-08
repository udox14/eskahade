-- Migration 0112: Laporan Keuangan PSB

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  'PSB',
  'Laporan Keuangan PSB',
  '/dashboard/psb/laporan-keuangan',
  'ChartLine',
  '["admin","bendahara"]',
  1,
  2
);

UPDATE fitur_akses
SET group_name = 'PSB',
    title = 'Laporan Keuangan PSB',
    icon = 'ChartLine',
    roles = '["admin","bendahara"]',
    is_active = 1,
    urutan = 2,
    updated_at = datetime('now')
WHERE href = '/dashboard/psb/laporan-keuangan';

INSERT OR IGNORE INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
VALUES
  ('/dashboard/psb/laporan-keuangan', 'bendahara', 0, 0, 0, datetime('now'), datetime('now'));
