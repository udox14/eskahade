-- Migration 0113: Kalender Pendidikan (Efektif / Libur / Lainnya)
-- Memformalkan tabel pengajian_libur_sesi dan mendaftarkan menu sidebar.
-- Kolom jenis + keterangan dimasukkan langsung di CREATE (DB baru). Untuk DB lama yang
-- tabelnya sudah ada tanpa kolom ini, penambahan kolom ditangani saat runtime oleh
-- ensureKalenderSchema() di actions.ts (ALTER ... ADD COLUMN defensif) — sengaja TIDAK
-- di-ALTER di sini supaya error "duplicate column" tidak menggagalkan INSERT menu di bawah.
-- Kedua rekap (santri pengajian & guru) sudah mengecualikan tiap baris tabel ini dari
-- denominator, jadi baris baru langsung memengaruhi hasil rekap.

CREATE TABLE IF NOT EXISTS pengajian_libur_sesi (
  tanggal    TEXT NOT NULL,
  sesi       TEXT NOT NULL,             -- 'shubuh' | 'ashar' | 'maghrib'
  jenis      TEXT NOT NULL DEFAULT 'libur',  -- 'libur' | 'lainnya'
  keterangan TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tanggal, sesi)
);

CREATE INDEX IF NOT EXISTS idx_pengajian_libur_sesi_tanggal
  ON pengajian_libur_sesi(tanggal, sesi);

-- Registrasi menu sidebar (group Akademik). INSERT OR IGNORE: aman diulang.
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
