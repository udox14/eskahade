-- 0201 — Menu sidebar "Kas Bank" (Mutasi Kas Bank ↔ Tunai, tabel dari migrasi 0200).
-- Halaman /dashboard/koperasi/kas-bank: daftar mutasi lintas sesi + catat/batalkan (tetap terikat sesi kas).
-- Petugas Koperasi hanya melihat mutasi yang ia catat; peran lain melihat semua; Pimpinan baca saja.
-- Hanya menambah satu baris menu. Bila baris sudah ada, peran yang sudah diatur di aplikasi tidak ditimpa.

INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Operasional', 'Kas Bank', '/dashboard/koperasi/kas-bank', 'Landmark',
  '["admin","bendahara","admin_koperasi","petugas_koperasi","pimpinan"]', 1, 3)
ON CONFLICT(href) DO UPDATE SET is_active = 1;
