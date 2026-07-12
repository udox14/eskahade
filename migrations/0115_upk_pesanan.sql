-- ============================================================
-- Migration 0115: Menu Pesanan UPK (Penyerahan, Tunggakan, Kembalian)
-- ============================================================
-- Tidak ada perubahan skema: kolom status_serah/masuk_pesanan/
-- sisa_tunggakan/sisa_kembalian/kembalian_ditahan sudah ada.
-- Hanya menambah menu sidebar & menaruhnya tepat setelah Kasir.

-- Geser item UPK selain Kasir (urutan >= 1) supaya Pesanan bisa masuk di urutan 1.
UPDATE fitur_akses
SET urutan = urutan + 1
WHERE group_name = 'UPK' AND urutan >= 1;

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('UPK', 'Pesanan', '/dashboard/akademik/upk/pesanan', 'ClipboardList', '["admin","sekpen"]', 1, 1);
