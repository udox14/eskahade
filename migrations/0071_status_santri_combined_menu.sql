-- Migration 0071: Gabungkan menu Nonaktif Sementara dan Arsip Alumni

UPDATE fitur_akses
SET title = 'Status Santri',
    icon = 'UserCheck',
    roles = '["admin","sekpen","dewan_santri"]',
    is_active = 1,
    updated_at = datetime('now')
WHERE href = '/dashboard/santri/nonaktif';

UPDATE fitur_akses
SET is_active = 0,
    updated_at = datetime('now')
WHERE href = '/dashboard/santri/arsip';
