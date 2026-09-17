-- Main DB: access metadata only. No financial tables or legacy transactions changed.
UPDATE fitur_akses SET is_active=0,updated_at=datetime('now') WHERE href LIKE '/dashboard/keuangan-terpusat%';
INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan)
VALUES('Keuangan Terpusat','Pengaturan','/dashboard/keuangan-terpusat/pengaturan','Gear','["admin","admin_koperasi"]',1,209);
UPDATE fitur_akses SET is_active=1,roles='["admin","admin_koperasi","petugas_koperasi","bendahara","pimpinan","pengelola_makan","pengelola_laundry"]',
 title=CASE href WHEN '/dashboard/keuangan-terpusat' THEN 'Ringkasan' WHEN '/dashboard/keuangan-terpusat/tagihan' THEN 'Tagihan & Pembayaran' WHEN '/dashboard/keuangan-terpusat/payout' THEN 'Dana & Pencairan' ELSE 'Transaksi & Laporan' END
WHERE href IN ('/dashboard/keuangan-terpusat','/dashboard/keuangan-terpusat/tagihan','/dashboard/keuangan-terpusat/payout','/dashboard/keuangan-terpusat/transaksi');
UPDATE fitur_akses SET is_active=1,roles='["admin","admin_koperasi","petugas_koperasi"]',title=CASE WHEN href LIKE '%kredensial' THEN 'Kartu QR Santri' ELSE 'Loket & Uang Jajan' END WHERE href IN ('/dashboard/keuangan-terpusat/kredensial','/dashboard/keuangan-terpusat/loket');
UPDATE fitur_akses SET is_active=1,roles='["admin","admin_koperasi"]' WHERE href='/dashboard/keuangan-terpusat/pengaturan';
