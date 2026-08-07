-- Index performa modul Monitoring Pimpinan (read-only).
-- Semua query memakai pola tanggal range bulanan / periode aktif.

-- absen_berjamaah: hanya punya UNIQUE(santri_id, tanggal) yang tidak bisa
-- dipakai untuk range scan per tanggal. Dipakai rekap berjamaah bulanan
-- (modul Monitoring Pimpinan + rekap keamanan).
CREATE INDEX IF NOT EXISTS idx_absen_berjamaah_tanggal
  ON absen_berjamaah(tanggal);

-- nilai_akademik: tabel terbesar di aplikasi; rata-rata nilai per semester
-- (AVG filter semester) saat ini full scan.
CREATE INDEX IF NOT EXISTS idx_nilai_akademik_semester
  ON nilai_akademik(semester);

-- absen_sakit: rekap sakit bulanan memfilter rentang tanggal.
CREATE INDEX IF NOT EXISTS idx_absen_sakit_tanggal
  ON absen_sakit(tanggal);
