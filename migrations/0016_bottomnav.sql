-- Migration: Bottom Navigation per Role
-- Tambah kolom is_bottomnav dan bottomnav_urutan ke tabel fitur_akses

ALTER TABLE fitur_akses ADD COLUMN is_bottomnav INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fitur_akses ADD COLUMN bottomnav_urutan INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_fitur_akses_bottomnav ON fitur_akses(is_bottomnav);

-- ── DEFAULT SEED: Isi bottom nav per role yang masuk akal ────────────────────
-- Logika: is_bottomnav disimpan per-fitur (bukan per-role).
-- Karena satu fitur bisa dimiliki banyak role, admin atur mana yang
-- muncul di bottom nav, dan tiap role hanya menampilkan fitur yang
-- DIA miliki sekaligus is_bottomnav = 1. Max 4 per role dijaga di UI.

-- Dashboard → semua role, slot 1
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 1 WHERE href = '/dashboard';

-- Data Santri → semua role, slot 2
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 2 WHERE href = '/dashboard/santri';

-- Absen Malam → pengurus_asrama, slot 3
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 3 WHERE href = '/dashboard/asrama/absen-malam';

-- Absen Berjamaah → pengurus_asrama, slot 4
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 4 WHERE href = '/dashboard/asrama/absen-berjamaah';

-- Pembayaran SPP → pengurus_asrama, slot 3 (lebih prioritas dari absen malam untuk SPP)
-- (sudah ditangani oleh is_bottomnav + bottomnav_urutan, role filter di aplikasi)

-- Pelanggaran & SP → keamanan, slot 3
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 3 WHERE href = '/dashboard/keamanan';

-- Perizinan Santri → keamanan (via dewan_santri) dan dewan_santri, slot 4
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 4 WHERE href = '/dashboard/keamanan/perizinan';

-- Absen Pengajian → sekpen, slot 3
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 3 WHERE href = '/dashboard/akademik/absensi';

-- Input Nilai → sekpen + wali_kelas, slot 4
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 4 WHERE href = '/dashboard/akademik/nilai/input';

-- Monitoring Setoran → dewan_santri, slot 3
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 3 WHERE href = '/dashboard/dewan-santri/setoran';

-- Perizinan Santri (dewan santri) → slot 4 sudah diset di atas

-- Loket Pembayaran → bendahara, slot 3
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 3 WHERE href = '/dashboard/keuangan/pembayaran';

-- Laporan Keuangan → bendahara, slot 4
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 4 WHERE href = '/dashboard/keuangan/laporan';

-- Rekap Absensi → wali_kelas, slot 3
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 3 WHERE href = '/dashboard/akademik/absensi/rekap';

-- Leger Nilai → wali_kelas, slot 4
UPDATE fitur_akses SET is_bottomnav = 1, bottomnav_urutan = 4 WHERE href = '/dashboard/akademik/leger';