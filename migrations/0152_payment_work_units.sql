INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan) VALUES
('Unit Pembayaran','Uang Jajan','/dashboard/keuangan-terpusat/unit/uang-jajan','PiggyBank','["admin","admin_koperasi","petugas_koperasi","bendahara"]',1,220),
('Unit Pembayaran','Makan','/dashboard/keuangan-terpusat/unit/makan','Utensils','["admin","admin_koperasi","pengelola_makan","bendahara"]',1,221),
('Unit Pembayaran','Laundry','/dashboard/keuangan-terpusat/unit/laundry','WashingMachine','["admin","admin_koperasi","pengelola_laundry","bendahara"]',1,222),
('Unit Pembayaran','SPP','/dashboard/keuangan-terpusat/unit/spp','ReceiptText','["admin","admin_koperasi","bendahara"]',1,223),
('Unit Pembayaran','Bangunan','/dashboard/keuangan-terpusat/unit/bangunan','Buildings','["admin","admin_koperasi","bendahara"]',1,224),
('Unit Pembayaran','Biaya Tahunan','/dashboard/keuangan-terpusat/unit/biaya-tahunan','CalendarDots','["admin","admin_koperasi","bendahara"]',1,225);
