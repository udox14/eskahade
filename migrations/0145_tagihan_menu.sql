-- Daftarkan menu "Tagihan" (Keuangan Terpusat) ke fitur_akses. Tanpa baris ini
-- guardPage()/canAccessHref() memblokir href yang belum terdaftar, sehingga
-- staff non-admin (bendahara/dewan_santri/pengurus_asrama) langsung dilempar
-- ke /dashboard walau menunya tampil.
--
-- Halaman ini hanya membaca finance_bills — tidak ada aksi yang mengubah uang,
-- jadi bendahara asrama pun aman diberi akses (datanya sudah dipersempit ke
-- santri binaannya lewat financeAsramaScope).

INSERT OR IGNORE INTO fitur_akses
  (group_name,title,href,icon,roles,is_active,urutan)
VALUES
  ('Keuangan Terpusat','Tagihan','/dashboard/keuangan-terpusat/tagihan','Receipt','["admin","bendahara","dewan_santri","pengurus_asrama"]',1,213);
