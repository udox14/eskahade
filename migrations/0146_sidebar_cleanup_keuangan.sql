-- Bersih-bersih sidebar Keuangan Terpusat.
--
-- Sidebar dirender sepenuhnya dari tabel fitur_akses (lib/menu/config.ts hanya
-- memetakan ikon), jadi menghapus folder halamannya saja tidak membuat menunya
-- hilang — barisnya tetap ada dan mengarah ke rute yang sudah tidak ada:
--
--   /dashboard/keuangan-terpusat/break-glass  (dihapus bersama pola
--       maker-checker-executor; lihat lib/finance/access.ts)
--   /dashboard/keuangan-terpusat/insiden      (halaman Incident Keuangan
--       dilebur ke Kontrol & Audit)
--
-- Sekalian memperbaiki kebalikannya: halaman "Ledger & Jurnal" berganti rute
-- jadi /transaksi tapi barisnya tidak ikut diganti, sehingga menu Transaksi
-- tidak pernah terdaftar dan staff non-admin selalu dilempar balik ke
-- /dashboard oleh guardPage().

-- 1) Ledger -> Transaksi. Baris lama dipakai ulang (bukan dihapus lalu dibuat
--    baru) supaya grant/revoke per pengguna di user_fitur_override ikut pindah.
--    Baris ledger dibuang lebih dulu HANYA bila baris transaksi ternyata sudah
--    ada, karena href-nya UNIQUE.
DELETE FROM user_fitur_override WHERE fitur_id IN (
  SELECT id FROM fitur_akses WHERE href = '/dashboard/keuangan-terpusat/ledger'
) AND EXISTS (SELECT 1 FROM fitur_akses WHERE href = '/dashboard/keuangan-terpusat/transaksi');

DELETE FROM fitur_akses
WHERE href = '/dashboard/keuangan-terpusat/ledger'
  AND EXISTS (SELECT 1 FROM fitur_akses WHERE href = '/dashboard/keuangan-terpusat/transaksi');

UPDATE fitur_akses
SET href = '/dashboard/keuangan-terpusat/transaksi',
    title = 'Transaksi & Jurnal',
    updated_at = datetime('now')
WHERE href = '/dashboard/keuangan-terpusat/ledger';

UPDATE role_fitur_crud_permission
SET fitur_href = '/dashboard/keuangan-terpusat/transaksi',
    updated_at = datetime('now')
WHERE fitur_href = '/dashboard/keuangan-terpusat/ledger'
  AND NOT EXISTS (
    SELECT 1 FROM role_fitur_crud_permission x
    WHERE x.fitur_href = '/dashboard/keuangan-terpusat/transaksi'
      AND x.role = role_fitur_crud_permission.role
  );

DELETE FROM role_fitur_crud_permission WHERE fitur_href = '/dashboard/keuangan-terpusat/ledger';

-- Jaga-jaga bila database tertentu tidak pernah punya baris ledger sama sekali.
INSERT OR IGNORE INTO fitur_akses
  (group_name,title,href,icon,roles,is_active,urutan)
VALUES
  ('Keuangan Terpusat','Transaksi & Jurnal','/dashboard/keuangan-terpusat/transaksi','BookOpenText','["admin","bendahara","dewan_santri","pengurus_asrama"]',1,207);

-- 2) Menu yang halamannya memang sudah dihapus. Dibuang permanen berikut
--    override per pengguna dan izin CRUD per role yang menggantung padanya.
DELETE FROM user_fitur_override WHERE fitur_id IN (
  SELECT id FROM fitur_akses WHERE href IN (
    '/dashboard/keuangan-terpusat/break-glass',
    '/dashboard/keuangan-terpusat/insiden'
  )
);

DELETE FROM role_fitur_crud_permission WHERE fitur_href IN (
  '/dashboard/keuangan-terpusat/break-glass',
  '/dashboard/keuangan-terpusat/insiden'
);

DELETE FROM fitur_akses WHERE href IN (
  '/dashboard/keuangan-terpusat/break-glass',
  '/dashboard/keuangan-terpusat/insiden'
);
