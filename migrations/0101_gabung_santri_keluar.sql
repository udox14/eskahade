-- Migration 0101: Gabungkan fitur Santri Keluar + Status Santri (nonaktif) + Arsip Alumni
-- jadi satu menu "Santri Keluar" (3 jenis: alumni/berhenti/nonaktif).
-- Status di balik layar tidak berubah; hanya konsolidasi menu.

-- Menu utama tunggal.
UPDATE fitur_akses
SET title = 'Santri Keluar',
    icon = 'LogOut',
    roles = '["admin","sekpen","dewan_santri"]',
    is_active = 1,
    updated_at = datetime('now')
WHERE href = '/dashboard/santri/keluar';

-- Sembunyikan menu lama (route tetap ada → jadi redirect ke /keluar).
UPDATE fitur_akses
SET is_active = 0,
    updated_at = datetime('now')
WHERE href = '/dashboard/santri/nonaktif';

UPDATE fitur_akses
SET is_active = 0,
    updated_at = datetime('now')
WHERE href = '/dashboard/santri/arsip';
