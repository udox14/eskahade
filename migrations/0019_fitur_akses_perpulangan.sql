-- Migration 0019: Fitur Akses untuk Perpulangan & Kedatangan

-- Halaman utama perpulangan (pengurus asrama + admin)
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES
  ('Kesantrian', 'Perpulangan',
   '/dashboard/asrama/perpulangan',
   'LogOut',
   '["admin","pengurus_asrama"]',
   1, 13),

  ('Kesantrian', 'Monitoring Perpulangan',
   '/dashboard/asrama/perpulangan/monitoring',
   'LayoutList',
   '["admin","pengurus_asrama","keamanan","dewan_santri"]',
   1, 14),

  ('Master Data', 'Periode Perpulangan',
   '/dashboard/pengaturan/perpulangan-periode',
   'CalendarRange',
   '["admin","keamanan","dewan_santri"]',
   1, 9);
