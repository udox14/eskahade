-- Migration 0140: Portal Ortu keuangan sepenuhnya pindah ke Keuangan Terpusat
--
-- Sejak migrasi ini, tab Tagihan & Saldo Portal Ortu tidak lagi menyentuh
-- spp_log/pembayaran_tahunan (Keuangan Santri/Keuangan Pusat) — tagihan
-- dicerminkan (read-only dari legacy) ke finance_bills, dan konfirmasi
-- pengajuan portal mencatat penerimaan + alokasi lewat ledger Keuangan
-- Terpusat (lihat lib/finance/portal-bills-sync.ts & lib/finance/portal-confirm.ts).
--
-- Halaman "Konfirmasi SPP Portal" dan "Konfirmasi Non-SPP Portal" pindah dari
-- modul Keuangan Santri/Keuangan Pusat ke Keuangan Terpusat. Reviewer yang
-- berhak tetap sama seperti sebelumnya (pengurus asrama binaan, dewan santri
-- untuk SADESA, bendahara untuk Non-SPP) — hanya lokasi menu & tabel yang
-- disentuh yang berubah.

UPDATE fitur_akses
SET href = '/dashboard/keuangan-terpusat/konfirmasi-spp',
    group_name = 'Keuangan Terpusat',
    urutan = 211,
    updated_at = datetime('now')
WHERE href = '/dashboard/asrama/spp/konfirmasi-portal';

UPDATE fitur_akses
SET href = '/dashboard/keuangan-terpusat/konfirmasi-non-spp',
    group_name = 'Keuangan Terpusat',
    urutan = 212,
    updated_at = datetime('now')
WHERE href = '/dashboard/keuangan/non-spp/konfirmasi-portal';

-- Jaga-jaga bila baris di atas belum pernah ada di database tertentu.
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('Keuangan Terpusat', 'Konfirmasi SPP Portal',     '/dashboard/keuangan-terpusat/konfirmasi-spp',     'ShieldCheck', '["admin","pengurus_asrama","dewan_santri"]', 1, 211),
('Keuangan Terpusat', 'Konfirmasi Non-SPP Portal', '/dashboard/keuangan-terpusat/konfirmasi-non-spp', 'ShieldCheck', '["admin","bendahara"]',                      1, 212);
