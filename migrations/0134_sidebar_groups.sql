-- 0134_sidebar_groups.sql
-- Konfigurasi grup sidebar: urutan tampilan, label rename, dan status aktif.
-- Sumber kebenaran susunan sidebar pindah ke DB (mirip mansatas template config),
-- item menu tetap di tabel fitur_akses.

CREATE TABLE IF NOT EXISTS sidebar_groups (
  group_name TEXT PRIMARY KEY,
  label TEXT,
  urutan INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed urutan awal mengikuti urutan sidebar legacy (GROUP_ORDER di kode).
INSERT OR IGNORE INTO sidebar_groups (group_name, urutan)
SELECT group_name, CASE group_name
  WHEN '_standalone'             THEN 0
  WHEN 'Monitoring Pimpinan'     THEN 1
  WHEN 'Data Santri'             THEN 2
  WHEN 'Kesantrian'              THEN 3
  WHEN 'Asrama'                  THEN 4
  WHEN 'Perizinan & Disiplin'    THEN 5
  WHEN 'Akademik'                THEN 6
  WHEN 'Pengkelasan'             THEN 7
  WHEN 'Nilai & Rapor'           THEN 8
  WHEN 'Absensi Akademik'        THEN 9
  WHEN 'Absensi'                 THEN 10
  WHEN 'Keuangan Pusat'          THEN 11
  WHEN 'Keuangan Terpusat'       THEN 12
  WHEN 'Keuangan Santri'         THEN 13
  WHEN 'Keuangan'                THEN 14
  WHEN 'Operasional'             THEN 15
  WHEN 'UPK'                     THEN 16
  WHEN 'EHB'                     THEN 17
  WHEN 'PSB'                     THEN 18
  WHEN 'POSKESTREN'              THEN 19
  WHEN 'Master Data'             THEN 20
  ELSE 100
END
FROM fitur_akses
GROUP BY group_name;

-- Urutan item Master Data di-renumber agar konsisten dengan urutan legacy
-- (GROUP_ITEM_ORDER di kode) — sejak sekarang urutan item = kolom `urutan` DB.
UPDATE fitur_akses SET urutan = 1  WHERE href = '/dashboard/pengaturan/tahun-ajaran';
UPDATE fitur_akses SET urutan = 2  WHERE href = '/dashboard/setup-tahun-ajaran';
UPDATE fitur_akses SET urutan = 3  WHERE href = '/dashboard/master/kelas';
UPDATE fitur_akses SET urutan = 4  WHERE href = '/dashboard/master/kitab';
UPDATE fitur_akses SET urutan = 5  WHERE href = '/dashboard/master/guru-kitab';
UPDATE fitur_akses SET urutan = 6  WHERE href = '/dashboard/master/wali-kelas';
UPDATE fitur_akses SET urutan = 7  WHERE href = '/dashboard/master/santri-tools';
UPDATE fitur_akses SET urutan = 8  WHERE href = '/dashboard/santri/arsip';
UPDATE fitur_akses SET urutan = 9  WHERE href = '/dashboard/pengaturan/perpulangan-periode';
UPDATE fitur_akses SET urutan = 10 WHERE href = '/dashboard/master/pelanggaran';
UPDATE fitur_akses SET urutan = 11 WHERE href = '/dashboard/pengaturan/users';
UPDATE fitur_akses SET urutan = 12 WHERE href = '/dashboard/pengaturan/fitur-akses';
UPDATE fitur_akses SET urutan = 13 WHERE href = '/dashboard/pengaturan/log-aktivitas';
