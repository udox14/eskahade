-- SANDBOX ONLY. Explicit operator approval, frozen preflight and backup required.
-- Never use d1 migrations apply, never apply to production, never replay a partial stage.
SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM d1_migrations WHERE name='0195_sandbox_dictionary_and_menu.sql') THEN 'true' ELSE 'STOP_MIGRATION_ALREADY_RECORDED' END);

INSERT OR IGNORE INTO poskestren_cash_account(id,name,account_type,is_active,created_by) VALUES('pos-cash-default','Kas Tunai','CASH',1,NULL);

INSERT OR IGNORE INTO poskestren_finance_category(id,name,direction,is_system,is_active) VALUES('pos-income-other','Lainnya','INCOME',0,1);

INSERT OR IGNORE INTO poskestren_finance_category(id,name,direction,is_system,is_active) VALUES('pos-expense-other','Lainnya','EXPENSE',0,1);

INSERT OR IGNORE INTO poskestren_finance_category(id,name,direction,is_system,is_active) VALUES('pos-expense-medicine','Belanja Obat','EXPENSE',1,1);

INSERT OR IGNORE INTO pengajian_violation_types(id,name,position) VALUES('terlambat','Terlambat',1);

INSERT OR IGNORE INTO pengajian_violation_types(id,name,position) VALUES('kitab','Tidak membawa kitab',2);

INSERT OR IGNORE INTO pengajian_violation_types(id,name,position) VALUES('tidur','Tidur',3);

INSERT OR IGNORE INTO pengajian_violation_types(id,name,position) VALUES('mengganggu','Mengganggu pengajian',4);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('Akademik','Cetak Administrasi Guru','/dashboard/akademik/administrasi-guru','FileSpreadsheet','["admin","sekpen","akademik"]',1,11,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('Akademik','Pelanggaran Pengajian','/dashboard/akademik/pelanggaran-pengajian','BookOpen','["admin","sekpen","keamanan","guru","wali_kelas"]',1,15,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('UPK','Pesanan','/dashboard/akademik/upk/pesanan','ClipboardList','["admin","sekpen","panitia_upk"]',1,1,0,4);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('UPK','Statistik','/dashboard/akademik/upk/statistik','BarChart3','["admin","sekpen","panitia_upk"]',1,2,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('Keuangan Santri','Konfirmasi SPP Portal','/dashboard/asrama/spp/konfirmasi-portal','ShieldCheck','["admin","pengurus_asrama","dewan_santri"]',0,90,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('Keuangan Pusat','Konfirmasi Non-SPP Portal','/dashboard/keuangan/non-spp/konfirmasi-portal','ShieldCheck','["admin","bendahara"]',0,91,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('Master Data','Master Pelanggaran','/dashboard/master/pelanggaran','Settings','["admin","tester"]',0,10,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('Master Data','Pengaturan Dashboard','/dashboard/pengaturan/dashboard','Palette','["admin"]',1,12,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('Master Data','Portal Ortu','/dashboard/pengaturan/portal-ortu','IdentificationCard','["admin"]',1,92,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('POSKESTREN','Cetak','/dashboard/poskestren/cetak','Printer','["admin","poskestren"]',1,6,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('POSKESTREN','Keuangan','/dashboard/poskestren/keuangan','Wallet','["admin","poskestren:bendahara"]',1,5,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('POSKESTREN','Manajemen','/dashboard/poskestren/manajemen','UserCog','["admin","poskestren"]',1,7,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('POSKESTREN','Obat','/dashboard/poskestren/obat','Package','["admin","poskestren"]',1,4,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('POSKESTREN','Observasi','/dashboard/poskestren/observasi','Bed','["admin","poskestren"]',1,3,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('POSKESTREN','Pemeriksaan','/dashboard/poskestren/pemeriksaan','Stethoscope','["admin","poskestren","dewan_santri","pengurus_asrama"]',1,1,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('POSKESTREN','Penyakit','/dashboard/poskestren/penyakit','BarChart3','["admin","poskestren"]',1,2,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('PSB','Laporan Keuangan PSB','/dashboard/psb/laporan-keuangan','ChartLine','["admin","bendahara"]',1,2,0,0);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan) VALUES('Akademik','Supervisi','/dashboard/sekpen/supervisi','ClipboardCheck','["admin","sekpen"]',1,16,0,0);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/akademik/pelanggaran-pengajian','admin',1,1,1);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/akademik/pelanggaran-pengajian','guru',1,1,1);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/akademik/pelanggaran-pengajian','keamanan',1,1,1);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/akademik/pelanggaran-pengajian','sekpen',1,1,1);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/akademik/pelanggaran-pengajian','wali_kelas',1,1,1);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/keuangan/non-spp/konfirmasi-portal','bendahara',1,1,1);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/master/pelanggaran','admin',1,1,1);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/master/pelanggaran','tester',0,0,0);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/poskestren/cetak','poskestren',0,0,0);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/poskestren/keuangan','poskestren:bendahara',1,1,1);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/poskestren/manajemen','poskestren',1,1,0);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/poskestren/obat','poskestren',1,1,0);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/poskestren/observasi','poskestren',1,1,0);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/poskestren/pemeriksaan','poskestren',1,1,0);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/poskestren/penyakit','poskestren',1,1,0);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/psb/laporan-keuangan','bendahara',1,1,1);

INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete) VALUES('/dashboard/sekpen/supervisi','sekpen',1,1,1);

INSERT INTO d1_migrations(name) VALUES('0195_sandbox_dictionary_and_menu.sql');
