-- Gabungkan Input Nilai + Leger Nilai menjadi satu pintu: Nilai Rapor.
UPDATE fitur_akses
SET title = 'Nilai Rapor',
    icon = 'FileSpreadsheet',
    group_name = 'Nilai & Rapor',
    is_active = 1,
    is_bottomnav = 1,
    bottomnav_urutan = 4,
    urutan = 1,
    updated_at = datetime('now')
WHERE href = '/dashboard/akademik/leger';

UPDATE fitur_akses
SET is_active = 0,
    is_bottomnav = 0,
    updated_at = datetime('now')
WHERE href = '/dashboard/akademik/nilai/input';
