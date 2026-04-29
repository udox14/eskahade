-- ============================================================
-- Migration 0048: Santri Kembali
-- ============================================================

UPDATE fitur_akses
SET urutan = 10,
    updated_at = datetime('now')
WHERE href = '/dashboard/asrama/perpulangan/monitoring';

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  'Asrama',
  'Santri Kembali',
  '/dashboard/asrama/santri-kembali',
  'UserCheck',
  '["admin","pengurus_asrama","dewan_santri"]',
  1,
  9
);

UPDATE fitur_akses
SET group_name = 'Asrama',
    title = 'Santri Kembali',
    icon = 'UserCheck',
    roles = '["admin","pengurus_asrama","dewan_santri"]',
    is_active = 1,
    urutan = 9,
    updated_at = datetime('now')
WHERE href = '/dashboard/asrama/santri-kembali';
