-- Daftarkan menu "Tarif Layanan" (Keuangan Terpusat) ke fitur_akses supaya
-- staff non-admin (bendahara/dewan_santri) bisa mengakses halaman baru ini —
-- tanpa baris ini, guardPage()/canAccessHref() memblokir href yang belum
-- terdaftar (lihat lib/cache/fitur-akses.ts:218).

INSERT OR IGNORE INTO fitur_akses
  (group_name,title,href,icon,roles,is_active,urutan)
VALUES
  ('Keuangan Terpusat','Tarif Layanan','/dashboard/keuangan-terpusat/tarif-layanan','Tag','["admin","bendahara","dewan_santri"]',1,212);
