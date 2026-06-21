-- ============================================================
-- Migration 0081: Rapikan sidebar
-- ============================================================
-- Nilai Harian & Hafalan -> grup "Nilai & Rapor"
-- Ranking & Prestasi -> rename "Ranking", pindah ke grup "Akademik"

UPDATE fitur_akses SET group_name = 'Nilai & Rapor', urutan = 4 WHERE href = '/dashboard/guru/nilai-harian';
UPDATE fitur_akses SET group_name = 'Nilai & Rapor', urutan = 5 WHERE href = '/dashboard/guru/hafalan';
UPDATE fitur_akses SET group_name = 'Akademik', title = 'Ranking', urutan = 4 WHERE href = '/dashboard/akademik/ranking';
