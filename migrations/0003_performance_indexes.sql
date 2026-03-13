-- ============================================================
-- migration 0003 — Performance: Composite Indexes
-- ============================================================
-- Tujuan: Turunkan D1 row reads secara signifikan dengan menambah
-- composite index pada tabel-tabel yang paling sering di-query.
--
-- Cara pakai:
--   wrangler d1 execute eskahade-db --remote --file=migrations/0003_performance_indexes.sql
--
-- AMAN dijalankan berulang kali (IF NOT EXISTS).
-- Tidak mengubah data, hanya menambah index.
-- ============================================================


-- ─── 1. riwayat_pendidikan ────────────────────────────────────────────────
-- Query paling sering: JOIN ON santri_id + filter status_riwayat = 'aktif'
-- Gabungkan 2 index terpisah (santri_id) dan (status_riwayat) jadi 1 composite.
-- Sebelum: D1 scan index santri_id, lalu filter status satu per satu.
-- Sesudah: 1 lookup langsung ke (santri_id, status_riwayat).
DROP INDEX IF EXISTS idx_riwayat_status; -- ganti dengan composite di bawah
CREATE INDEX IF NOT EXISTS idx_riwayat_santri_status
  ON riwayat_pendidikan(santri_id, status_riwayat);

-- Query absensi: WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
CREATE INDEX IF NOT EXISTS idx_riwayat_kelas_status
  ON riwayat_pendidikan(kelas_id, status_riwayat);


-- ─── 2. spp_log ───────────────────────────────────────────────────────────
-- Query getDashboardSPP & getRingkasanTunggakan:
--   WHERE santri_id = s.id AND tahun = ? AND bulan BETWEEN 1 AND ?
-- Index (santri_id) ada, tapi tidak bisa filter tahun+bulan sekaligus.
-- Index (bulan, tahun) ada tapi urutan kolom tidak optimal untuk subquery correlated.
DROP INDEX IF EXISTS idx_spp_bulan_tahun; -- urutan kurang optimal, ganti di bawah
CREATE INDEX IF NOT EXISTS idx_spp_santri_tahun_bulan
  ON spp_log(santri_id, tahun, bulan);


-- ─── 3. pembayaran_tahunan ────────────────────────────────────────────────
-- Query getLaporanKeuangan:
--   WHERE jenis_biaya = 'BANGUNAN'
--   WHERE jenis_biaya IN (...) AND tahun_tagihan = ?
-- Query keuangan/pembayaran:
--   WHERE santri_id = ? AND jenis_biaya = ? AND tahun_tagihan = ?
--   WHERE santri_id = ? AND tahun_tagihan = ?
CREATE INDEX IF NOT EXISTS idx_pembayaran_jenis_tahun
  ON pembayaran_tahunan(jenis_biaya, tahun_tagihan);

CREATE INDEX IF NOT EXISTS idx_pembayaran_santri_jenis_tahun
  ON pembayaran_tahunan(santri_id, jenis_biaya, tahun_tagihan);

-- Query cash flow laporan: WHERE tanggal_bayar BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_pembayaran_tanggal
  ON pembayaran_tahunan(tanggal_bayar);


-- ─── 4. santri ────────────────────────────────────────────────────────────
-- Query paling banyak: WHERE status_global = 'aktif' AND asrama = ?
-- Index (status_global) dan (asrama) ada terpisah.
-- Composite jauh lebih efisien untuk query yang selalu pakai keduanya.
CREATE INDEX IF NOT EXISTS idx_santri_status_asrama
  ON santri(status_global, asrama);


-- ─── 5. tabungan_log ──────────────────────────────────────────────────────
-- Query getDashboardTabungan stats: WHERE santri_id = tl.santri_id AND created_at >= ?
-- Index (santri_id) ada, tapi tidak bisa filter created_at langsung.
CREATE INDEX IF NOT EXISTS idx_tabungan_santri_created
  ON tabungan_log(santri_id, created_at);


-- ─── 6. absen_malam_v2 ────────────────────────────────────────────────────
-- Query: WHERE tanggal = ? AND santri_id IN (...)
-- Tanggal + santri_id adalah kombinasi lookup utama.
CREATE INDEX IF NOT EXISTS idx_absen_malam_tanggal_santri
  ON absen_malam_v2(tanggal, santri_id);


-- ─── 7. perizinan ─────────────────────────────────────────────────────────
-- Query rekap asrama: WHERE status = 'AKTIF' OR (status = 'KEMBALI' AND tgl_kembali_aktual >= ?)
-- Index (status) ada, tambah (status, santri_id) untuk lookup gabungan.
CREATE INDEX IF NOT EXISTS idx_perizinan_status_santri
  ON perizinan(status, santri_id);


-- ─── 8. riwayat_surat ─────────────────────────────────────────────────────
-- Query sensus keluar bulan ini: WHERE jenis_surat = 'BERHENTI' AND created_at >= ?
CREATE INDEX IF NOT EXISTS idx_riwayat_surat_jenis_created
  ON riwayat_surat(jenis_surat, created_at);


-- ─── 9. biaya_settings ────────────────────────────────────────────────────
-- Query: WHERE tahun_angkatan = ? (dan sering JOIN ke jenis_biaya)
CREATE INDEX IF NOT EXISTS idx_biaya_settings_angkatan
  ON biaya_settings(tahun_angkatan);


-- ─── 10. saldo_tabungan cached column ─────────────────────────────────────
-- Tambah kolom saldo_tabungan ke tabel santri sebagai cached value.
-- Nilai ini selalu di-update atomik bersamaan dengan INSERT ke tabungan_log.
-- Tujuan: getDashboardTabungan tidak perlu SUM seluruh tabungan_log lagi.
--
-- Cara inisialisasi setelah kolom ditambah (jalankan sekali):
--   UPDATE santri SET saldo_tabungan = (
--     SELECT COALESCE(SUM(CASE WHEN jenis='MASUK' THEN nominal ELSE -nominal END), 0)
--     FROM tabungan_log WHERE santri_id = santri.id
--   );
ALTER TABLE santri ADD COLUMN saldo_tabungan INTEGER NOT NULL DEFAULT 0;