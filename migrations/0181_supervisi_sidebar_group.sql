-- Migration 0181: Pindahkan menu Supervisi ke grup 'Akademik' (grup Sekpen utama)
-- dan bersihkan grup 'Sekpen' duplikat dari sidebar_groups jika ada.
UPDATE fitur_akses
SET group_name = 'Akademik', urutan = 20
WHERE href = '/dashboard/sekpen/supervisi';

DELETE FROM sidebar_groups
WHERE group_name = 'Sekpen';
