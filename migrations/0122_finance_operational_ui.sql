-- Menu aplikasi untuk workspace operasional Keuangan Terpusat.

INSERT OR IGNORE INTO fitur_akses
  (group_name,title,href,icon,roles,is_active,urutan)
VALUES
  ('Keuangan Terpusat','Ledger & Jurnal','/dashboard/keuangan-terpusat/ledger','BookOpenText','["admin","bendahara","dewan_santri","pengurus_asrama"]',1,207),
  ('Keuangan Terpusat','Alokasi Dana','/dashboard/keuangan-terpusat/alokasi','ArrowLeftRight','["admin","bendahara","dewan_santri","pengurus_asrama"]',1,208),
  ('Keuangan Terpusat','Incident Keuangan','/dashboard/keuangan-terpusat/insiden','ShieldAlert','["admin","bendahara","dewan_santri","pengurus_asrama"]',1,209),
  ('Keuangan Terpusat','Kontrol & Audit','/dashboard/keuangan-terpusat/kontrol','ShieldCheck','["admin","bendahara","dewan_santri"]',1,210);

UPDATE fitur_akses
SET urutan = 211,
    updated_at = datetime('now')
WHERE href = '/dashboard/keuangan-terpusat/operasi';
