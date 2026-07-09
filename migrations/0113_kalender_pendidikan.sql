-- Migration 0113: Kalender Pendidikan (Efektif / Libur / Lainnya)
-- Memformalkan tabel pengajian_libur_sesi (sebelumnya dibuat lazy via CREATE IF NOT EXISTS
-- di beberapa action) dan menambah kolom jenis + keterangan agar admin bisa menandai
-- tanggal/sesi tertentu sebagai Libur atau Lainnya lewat halaman Kalender Pendidikan.
-- Kedua rekap (santri pengajian & guru) sudah mengecualikan tiap baris tabel ini dari
-- denominator, jadi baris baru langsung memengaruhi hasil rekap.

CREATE TABLE IF NOT EXISTS pengajian_libur_sesi (
  tanggal    TEXT NOT NULL,
  sesi       TEXT NOT NULL,             -- 'shubuh' | 'ashar' | 'maghrib'
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tanggal, sesi)
);

-- Kolom baru. Jalankan sekali; ADD COLUMN akan error jika kolom sudah ada (abaikan).
ALTER TABLE pengajian_libur_sesi ADD COLUMN jenis TEXT NOT NULL DEFAULT 'libur';   -- 'libur' | 'lainnya'
ALTER TABLE pengajian_libur_sesi ADD COLUMN keterangan TEXT;

CREATE INDEX IF NOT EXISTS idx_pengajian_libur_sesi_tanggal
  ON pengajian_libur_sesi(tanggal, sesi);

-- Registrasi menu sidebar (group Akademik).
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
  'Akademik',
  'Kalender Pendidikan',
  '/dashboard/akademik/kalender-pendidikan',
  'CalendarDots',
  '["admin"]',
  1,
  10
);
