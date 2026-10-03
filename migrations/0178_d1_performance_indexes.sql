-- 0178_d1_performance_indexes.sql
-- Optimasi performa query D1 berdasarkan audit 30 hari terakhir.
-- Seluruh indeks bersifat non-destruktif (IF NOT EXISTS).

-- 1. Optimasi JOIN riwayat_pendidikan pada pagination & count santri
-- Menghilangkan full index scan pada idx_riwayat_status untuk setiap santri.
CREATE INDEX IF NOT EXISTS idx_riwayat_santri_status_kelas
  ON riwayat_pendidikan(santri_id, status_riwayat, kelas_id);

-- 2. Optimasi pagination ORDER BY nama_lengkap pada santri aktif
-- Menghilangkan TEMP B-TREE FOR ORDER BY pada query list santri pagination.
CREATE INDEX IF NOT EXISTS idx_santri_status_nama
  ON santri(status_global, nama_lengkap);

-- 3. Optimasi progress hafalan santri
-- Menghilangkan scan 21.000 baris per eksekusi hafalan_progress dengan B-Tree seek langsung.
CREATE INDEX IF NOT EXISTS idx_hafalan_progress_santri_marhalah_blok
  ON hafalan_progress(santri_id, marhalah_id, blok_id);
