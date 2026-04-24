-- ============================================================
-- Migration 0025: Seed fitur_akses untuk modul EHB
-- ============================================================

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('EHB', 'Jadwal EHB',        '/dashboard/ehb/jadwal',            'CalendarDays', '["admin"]', 1, 0),
('EHB', 'Ruangan',           '/dashboard/ehb/ruangan',           'LayoutList',   '["admin"]', 1, 1),
('EHB', 'Pengawas EHB',      '/dashboard/ehb/pengawas',          'UserCheck',    '["admin"]', 1, 2);
