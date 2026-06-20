-- Migration 0092: Gabung Penempatan Kelas + Kenaikan Kelas jadi satu modul.
-- Modul baru: /dashboard/akademik/penempatan (eksklusif admin & sekpen).
-- Modul lama (atur-kelas & kenaikan) dinonaktifkan dari sidebar; route-nya redirect.
-- Idempotent.

-- 1. Daftarkan fitur baru di grup Akademik (slot urutan 1, bekas atur-kelas).
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('Akademik', 'Penempatan Kelas', '/dashboard/akademik/penempatan', 'UserPlus', '["admin","sekpen"]', 1, 1);

-- 2. Seed izin CRUD untuk fitur baru (mengikuti pola migration 0044: role pemegang akses dapat tulis).
INSERT OR IGNORE INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
SELECT f.href, je.value, 1, 1, 1, datetime('now'), datetime('now')
FROM fitur_akses f, json_each(f.roles) je
WHERE f.href = '/dashboard/akademik/penempatan' AND je.value IS NOT NULL;

-- 3. Nonaktifkan modul lama yang sudah digabung.
UPDATE fitur_akses SET is_active = 0
WHERE href IN ('/dashboard/santri/atur-kelas', '/dashboard/akademik/kenaikan');
