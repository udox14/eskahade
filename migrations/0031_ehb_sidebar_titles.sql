-- ============================================================
-- Migration 0031: Rapikan title sidebar modul EHB
-- ============================================================

UPDATE fitur_akses
SET title = 'Jadwal'
WHERE href = '/dashboard/ehb/jadwal';

UPDATE fitur_akses
SET title = 'Pengawas'
WHERE href = '/dashboard/ehb/pengawas';
