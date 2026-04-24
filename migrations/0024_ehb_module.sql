-- ============================================================
-- Migration 0024: EHB (Evaluasi Hasil Belajar) Module
-- ============================================================
-- Perubahan dari plan awal:
--   - ehb_jadwal: mapping per KELAS (bukan per marhalah) agar fleksibel
--     untuk kelas anomali di mutawassithah
--   - jam_group: TEXT bebas (fleksibel, bisa lebih dari 2)
-- ============================================================

-- 1. EHB EVENT — event ujian per semester (misal "EHB Semester Genap 2025/2026")
CREATE TABLE IF NOT EXISTS ehb_event (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id),
  semester        INTEGER NOT NULL DEFAULT 2,   -- 1 (Ganjil) | 2 (Genap)
  nama            TEXT NOT NULL,                 -- label event
  is_active       INTEGER NOT NULL DEFAULT 1,    -- hanya 1 yang aktif
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. EHB SESI — konfigurasi sesi (label, jam group, waktu)
--    jam_group: label bebas, misal "Jam ke-1", "Jam ke-2", dll
CREATE TABLE IF NOT EXISTS ehb_sesi (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id  INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  nomor_sesi    INTEGER NOT NULL,              -- 1, 2, 3, 4, 5
  label         TEXT NOT NULL,                 -- "Shubuh", "Pagi", "Ashar", "Maghrib", "Isya"
  jam_group     TEXT NOT NULL,                 -- "Jam ke-1", "Jam ke-2", dll (fleksibel)
  waktu_mulai   TEXT,                          -- "05:00"
  waktu_selesai TEXT,                          -- "06:30"
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ehb_event_id, nomor_sesi)
);

-- 3. EHB KELAS SESI — mapping kelas → jam group (kelas mana ikut jam group apa)
--    Fleksibel: 1 kelas hanya 1 jam group, tapi bisa ada banyak jam group
CREATE TABLE IF NOT EXISTS ehb_kelas_jam (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id  INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  kelas_id      TEXT NOT NULL REFERENCES kelas(id),
  jam_group     TEXT NOT NULL,                 -- harus match dengan ehb_sesi.jam_group
  UNIQUE(ehb_event_id, kelas_id)
);

-- 4. EHB JADWAL — jadwal mapel per sesi per tanggal per kelas
--    Satu baris = satu kelas ujian satu mapel di satu sesi pada satu tanggal
CREATE TABLE IF NOT EXISTS ehb_jadwal (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id  INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  tanggal       TEXT NOT NULL,                 -- "2026-06-01"
  sesi_id       INTEGER NOT NULL REFERENCES ehb_sesi(id),
  kelas_id      TEXT NOT NULL REFERENCES kelas(id),
  mapel_id      INTEGER NOT NULL REFERENCES mapel(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ehb_event_id, tanggal, sesi_id, kelas_id) -- 1 kelas, 1 sesi, 1 hari = 1 mapel
);

-- 5. EHB RUANGAN — konfigurasi ruangan ujian
CREATE TABLE IF NOT EXISTS ehb_ruangan (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  nomor_ruangan  INTEGER NOT NULL,
  nama_ruangan   TEXT,                         -- alias opsional, misal "Aula A"
  kapasitas      INTEGER NOT NULL DEFAULT 20,
  jenis_kelamin  TEXT NOT NULL DEFAULT 'L',    -- 'L' | 'P'
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ehb_event_id, nomor_ruangan)
);

-- 6. EHB PLOTTING SANTRI — penempatan santri di ruangan
--    nomor peserta = format "{nomor_ruangan 2digit}-{nomor_kursi 2digit}"
CREATE TABLE IF NOT EXISTS ehb_plotting_santri (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  ruangan_id     INTEGER NOT NULL REFERENCES ehb_ruangan(id) ON DELETE CASCADE,
  santri_id      TEXT NOT NULL REFERENCES santri(id),
  nomor_kursi    INTEGER NOT NULL,             -- 1, 2, 3, ...
  jam_group      TEXT NOT NULL,                -- "Jam ke-1", "Jam ke-2", dll
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ehb_event_id, santri_id)             -- 1 santri hanya 1 penempatan per event
);

-- 7. EHB PENGAWAS — daftar orang yang menjadi pengawas EHB
CREATE TABLE IF NOT EXISTS ehb_pengawas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  guru_id        INTEGER REFERENCES data_guru(id),  -- NULL jika bukan guru terdaftar
  nama_pengawas  TEXT NOT NULL,
  tag            TEXT NOT NULL DEFAULT 'junior',     -- 'senior' | 'junior'
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. EHB JADWAL PENGAWAS — assignment pengawas ke ruangan per sesi per tanggal
CREATE TABLE IF NOT EXISTS ehb_jadwal_pengawas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  pengawas_id    INTEGER NOT NULL REFERENCES ehb_pengawas(id) ON DELETE CASCADE,
  ruangan_id     INTEGER NOT NULL REFERENCES ehb_ruangan(id),
  tanggal        TEXT NOT NULL,                -- "2026-06-01"
  sesi_id        INTEGER NOT NULL REFERENCES ehb_sesi(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ehb_event_id, pengawas_id, tanggal, sesi_id),  -- 1 pengawas 1 tugas per sesi
  UNIQUE(ehb_event_id, ruangan_id, tanggal, sesi_id)    -- 1 ruangan 1 pengawas per sesi
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ehb_sesi_event      ON ehb_sesi(ehb_event_id);
CREATE INDEX IF NOT EXISTS idx_ehb_kelas_jam_event  ON ehb_kelas_jam(ehb_event_id);
CREATE INDEX IF NOT EXISTS idx_ehb_jadwal_event     ON ehb_jadwal(ehb_event_id);
CREATE INDEX IF NOT EXISTS idx_ehb_jadwal_tanggal   ON ehb_jadwal(tanggal, sesi_id);
CREATE INDEX IF NOT EXISTS idx_ehb_jadwal_kelas     ON ehb_jadwal(kelas_id);
CREATE INDEX IF NOT EXISTS idx_ehb_ruangan_event    ON ehb_ruangan(ehb_event_id);
CREATE INDEX IF NOT EXISTS idx_ehb_plotting_ruangan ON ehb_plotting_santri(ruangan_id);
CREATE INDEX IF NOT EXISTS idx_ehb_plotting_santri  ON ehb_plotting_santri(santri_id);
CREATE INDEX IF NOT EXISTS idx_ehb_plotting_event   ON ehb_plotting_santri(ehb_event_id);
CREATE INDEX IF NOT EXISTS idx_ehb_pengawas_event   ON ehb_pengawas(ehb_event_id);
CREATE INDEX IF NOT EXISTS idx_ehb_jadwal_pgs_event ON ehb_jadwal_pengawas(ehb_event_id);
CREATE INDEX IF NOT EXISTS idx_ehb_jadwal_pgs_tgl   ON ehb_jadwal_pengawas(tanggal, sesi_id);
CREATE INDEX IF NOT EXISTS idx_ehb_jadwal_pgs_pgs   ON ehb_jadwal_pengawas(pengawas_id);
