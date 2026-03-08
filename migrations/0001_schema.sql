-- ============================================================
-- migration v2
-- ESKAHADE — D1 Schema Migration
-- Konversi dari Supabase (PostgreSQL) ke Cloudflare D1 (SQLite)
-- ============================================================
-- Catatan konversi:
--   uuid         → TEXT (generate via crypto.randomUUID() di app)
--   timestamptz  → TEXT (ISO 8601 string)
--   date         → TEXT (YYYY-MM-DD)
--   boolean      → INTEGER (0/1)
--   jsonb        → TEXT (JSON.stringify/parse di app)
--   serial/int4  → INTEGER PRIMARY KEY AUTOINCREMENT
--   USER-DEFINED → TEXT (enum divalidasi di app)
-- ============================================================
-- 1. USERS (pengganti Supabase Auth + profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,                        -- crypto.randomUUID()
  email        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                          -- Web Crypto hash
  full_name    TEXT,
  role         TEXT NOT NULL DEFAULT 'wali_kelas',      -- admin | wali_kelas | pengurus_asrama | akademik | keamanan | dewan_santri
  asrama_binaan TEXT,                                   -- khusus role pengurus_asrama
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 2. TAHUN AJARAN
-- ============================================================
CREATE TABLE IF NOT EXISTS tahun_ajaran (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nama       TEXT NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 0,               -- 0/1
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 3. MARHALAH
-- ============================================================
CREATE TABLE IF NOT EXISTS marhalah (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nama   TEXT NOT NULL,
  urutan INTEGER NOT NULL
);

-- ============================================================
-- 4. DATA GURU
-- ============================================================
CREATE TABLE IF NOT EXISTS data_guru (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_lengkap TEXT NOT NULL,
  gelar        TEXT,
  kode_guru    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 5. MAPEL
-- ============================================================
CREATE TABLE IF NOT EXISTS mapel (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nama  TEXT NOT NULL,
  aktif INTEGER NOT NULL DEFAULT 1                     -- 0/1
);

-- ============================================================
-- 6. KITAB
-- ============================================================
CREATE TABLE IF NOT EXISTS kitab (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  mapel_id    INTEGER REFERENCES mapel(id),
  marhalah_id INTEGER REFERENCES marhalah(id),
  nama_kitab  TEXT NOT NULL,
  harga       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 7. KELAS
-- ============================================================
CREATE TABLE IF NOT EXISTS kelas (
  id              TEXT PRIMARY KEY,
  tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id),
  marhalah_id     INTEGER REFERENCES marhalah(id),
  nama_kelas      TEXT NOT NULL,
  wali_kelas_id   TEXT REFERENCES users(id),
  jenis_kelamin   TEXT NOT NULL,                       -- L | P | C
  guru_shubuh_id  INTEGER REFERENCES data_guru(id),
  guru_ashar_id   INTEGER REFERENCES data_guru(id),
  guru_maghrib_id INTEGER REFERENCES data_guru(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 8. SANTRI
-- ============================================================
CREATE TABLE IF NOT EXISTS santri (
  id                TEXT PRIMARY KEY,
  nis               TEXT NOT NULL UNIQUE,
  nama_lengkap      TEXT NOT NULL,
  nik               TEXT,
  tempat_lahir      TEXT,
  tanggal_lahir     TEXT,                              -- YYYY-MM-DD
  jenis_kelamin     TEXT NOT NULL,                     -- L | P
  nama_ayah         TEXT,
  nama_ibu          TEXT,
  alamat            TEXT,
  status_global     TEXT NOT NULL DEFAULT 'aktif',     -- aktif | arsip
  foto_url          TEXT,
  sekolah           TEXT,
  kelas_sekolah     TEXT,
  asrama            TEXT,
  kamar             TEXT,
  tahun_masuk       INTEGER,
  tempat_makan_id   TEXT,
  tempat_mencuci_id TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 9. RIWAYAT PENDIDIKAN
-- ============================================================
CREATE TABLE IF NOT EXISTS riwayat_pendidikan (
  id               TEXT PRIMARY KEY,
  santri_id        TEXT REFERENCES santri(id),
  kelas_id         TEXT REFERENCES kelas(id),
  status_riwayat   TEXT NOT NULL DEFAULT 'aktif',      -- aktif | selesai | pindah
  grade_lanjutan   TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 10. SANTRI ARSIP
-- ============================================================
CREATE TABLE IF NOT EXISTS santri_arsip (
  id             TEXT PRIMARY KEY,
  santri_id_asli TEXT NOT NULL,
  nis            TEXT NOT NULL,
  nama_lengkap   TEXT NOT NULL,
  angkatan       INTEGER,
  asrama         TEXT,
  tanggal_arsip  TEXT NOT NULL DEFAULT (datetime('now')),
  catatan        TEXT,
  snapshot       TEXT NOT NULL                         -- JSON.stringify dari data santri
);

-- ============================================================
-- 11. ABSENSI HARIAN (Santri)
-- ============================================================
CREATE TABLE IF NOT EXISTS absensi_harian (
  id                     TEXT PRIMARY KEY,
  riwayat_pendidikan_id  TEXT REFERENCES riwayat_pendidikan(id),
  tanggal                TEXT NOT NULL,                -- YYYY-MM-DD
  shubuh                 TEXT NOT NULL DEFAULT 'H',    -- H | A | I | S
  ashar                  TEXT NOT NULL DEFAULT 'H',
  maghrib                TEXT NOT NULL DEFAULT 'H',
  verif_shubuh           TEXT,
  verif_ashar            TEXT,
  verif_maghrib          TEXT,
  created_by             TEXT REFERENCES users(id),
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 12. ABSENSI GURU
-- ============================================================
CREATE TABLE IF NOT EXISTS absensi_guru (
  id         TEXT PRIMARY KEY,
  kelas_id   TEXT REFERENCES kelas(id),
  guru_id    INTEGER REFERENCES data_guru(id),
  tanggal    TEXT NOT NULL,                            -- YYYY-MM-DD
  shubuh     TEXT NOT NULL DEFAULT 'L',
  ashar      TEXT NOT NULL DEFAULT 'L',
  maghrib    TEXT NOT NULL DEFAULT 'L',
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 13. ABSEN ASRAMA (Malam)
-- ============================================================
CREATE TABLE IF NOT EXISTS absen_asrama (
  santri_id  TEXT NOT NULL REFERENCES santri(id),
  status     TEXT NOT NULL,                            -- HADIR | IZIN | ALFA
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES users(id),
  PRIMARY KEY (santri_id)
);

-- ============================================================
-- 14. ABSEN SAKIT
-- ============================================================
CREATE TABLE IF NOT EXISTS absen_sakit (
  id         TEXT PRIMARY KEY,
  santri_id  TEXT REFERENCES santri(id),
  tanggal    TEXT NOT NULL DEFAULT (date('now')),      -- YYYY-MM-DD
  keterangan TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 15. NILAI AKADEMIK
-- ============================================================
CREATE TABLE IF NOT EXISTS nilai_akademik (
  id                    TEXT PRIMARY KEY,
  riwayat_pendidikan_id TEXT REFERENCES riwayat_pendidikan(id),
  mapel_id              INTEGER REFERENCES mapel(id),
  nilai                 INTEGER,
  semester              INTEGER NOT NULL DEFAULT 1,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 16. NILAI AKHLAK
-- ============================================================
CREATE TABLE IF NOT EXISTS nilai_akhlak (
  id                    TEXT PRIMARY KEY,
  riwayat_pendidikan_id TEXT REFERENCES riwayat_pendidikan(id),
  semester              INTEGER NOT NULL DEFAULT 1,
  kedisiplinan          INTEGER DEFAULT 0,
  kebersihan            INTEGER DEFAULT 0,
  kesopanan             INTEGER DEFAULT 0,
  ibadah                INTEGER DEFAULT 0,
  kemandirian           INTEGER DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 17. RANKING
-- ============================================================
CREATE TABLE IF NOT EXISTS ranking (
  id                    TEXT PRIMARY KEY,
  riwayat_pendidikan_id TEXT REFERENCES riwayat_pendidikan(id),
  semester              INTEGER NOT NULL,
  jumlah_nilai          REAL DEFAULT 0,
  rata_rata             REAL DEFAULT 0,
  ranking_kelas         INTEGER DEFAULT 0,
  predikat              TEXT,
  catatan_wali_kelas    TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 18. MASTER PELANGGARAN
-- ============================================================
CREATE TABLE IF NOT EXISTS master_pelanggaran (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  kategori         TEXT NOT NULL,                      -- RINGAN | SEDANG | BERAT
  nama_pelanggaran TEXT NOT NULL,
  poin             INTEGER DEFAULT 5,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 19. PELANGGARAN
-- ============================================================
CREATE TABLE IF NOT EXISTS pelanggaran (
  id          TEXT PRIMARY KEY,
  santri_id   TEXT REFERENCES santri(id),
  tanggal     TEXT NOT NULL DEFAULT (date('now')),     -- YYYY-MM-DD
  jenis       TEXT NOT NULL,                           -- RINGAN | SEDANG | BERAT
  deskripsi   TEXT NOT NULL,
  poin        INTEGER DEFAULT 0,
  penindak_id TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 20. PERIZINAN
-- ============================================================
CREATE TABLE IF NOT EXISTS perizinan (
  id                  TEXT PRIMARY KEY,
  santri_id           TEXT REFERENCES santri(id),
  jenis               TEXT NOT NULL,                   -- PULANG | KELUAR | LAINNYA
  tgl_mulai           TEXT NOT NULL,
  tgl_selesai_rencana TEXT NOT NULL,
  alasan              TEXT NOT NULL,
  pemberi_izin        TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'AKTIF',   -- AKTIF | KEMBALI | TELAT
  tgl_kembali_aktual  TEXT,
  created_by          TEXT REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 21. HASIL TES KLASIFIKASI
-- ============================================================
CREATE TABLE IF NOT EXISTS hasil_tes_klasifikasi (
  id                   TEXT PRIMARY KEY,
  santri_id            TEXT REFERENCES santri(id),
  hari_tes             TEXT,
  sesi_tes             TEXT,
  tulis_arab           TEXT,
  baca_kelancaran      TEXT,
  baca_tajwid          TEXT,
  hafalan_juz          INTEGER DEFAULT 0,
  nahwu_pengalaman     INTEGER DEFAULT 0,              -- 0/1
  rekomendasi_marhalah TEXT,
  catatan_grade        TEXT,
  tester_id            TEXT REFERENCES users(id),
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 22. SPP
-- ============================================================
CREATE TABLE IF NOT EXISTS spp_settings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tahun_kalender  INTEGER NOT NULL,
  nominal         INTEGER NOT NULL DEFAULT 70000,
  is_active       INTEGER NOT NULL DEFAULT 1,          -- 0/1
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS spp_log (
  id           TEXT PRIMARY KEY,
  santri_id    TEXT REFERENCES santri(id),
  bulan        INTEGER NOT NULL,
  tahun        INTEGER NOT NULL,
  nominal_bayar INTEGER NOT NULL,
  tanggal_bayar TEXT NOT NULL DEFAULT (datetime('now')),
  penerima_id  TEXT REFERENCES users(id),
  keterangan   TEXT DEFAULT '-'
);

CREATE TABLE IF NOT EXISTS spp_setoran (
  id             TEXT PRIMARY KEY,
  asrama         TEXT NOT NULL,
  bulan          INTEGER NOT NULL,
  tahun          INTEGER NOT NULL,
  tanggal_terima TEXT DEFAULT (datetime('now')),
  penerima_id    TEXT REFERENCES users(id),
  jumlah_sistem  INTEGER DEFAULT 0,
  jumlah_aktual  INTEGER DEFAULT 0,
  nama_penyetor  TEXT,
  catatan        TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 23. KEUANGAN
-- ============================================================
CREATE TABLE IF NOT EXISTS biaya_settings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tahun_angkatan  INTEGER NOT NULL,
  jenis_biaya     TEXT NOT NULL,
  nominal         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pembayaran_tahunan (
  id              TEXT PRIMARY KEY,
  santri_id       TEXT REFERENCES santri(id),
  jenis_biaya     TEXT NOT NULL,
  tahun_tagihan   INTEGER,
  nominal_bayar   INTEGER NOT NULL,
  tanggal_bayar   TEXT NOT NULL DEFAULT (datetime('now')),
  penerima_id     TEXT REFERENCES users(id),
  keterangan      TEXT
);

-- ============================================================
-- 24. TABUNGAN / UANG JAJAN
-- ============================================================
CREATE TABLE IF NOT EXISTS tabungan_log (
  id         TEXT PRIMARY KEY,
  santri_id  TEXT REFERENCES santri(id),
  jenis      TEXT NOT NULL,                            -- MASUK | KELUAR
  nominal    INTEGER NOT NULL,
  keterangan TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 25. UPK (Unit Penjualan Kitab)
-- ============================================================
CREATE TABLE IF NOT EXISTS upk_transaksi (
  id             TEXT PRIMARY KEY,
  santri_id      TEXT REFERENCES santri(id),
  nama_pemesan   TEXT NOT NULL,
  info_tambahan  TEXT,
  total_tagihan  INTEGER NOT NULL DEFAULT 0,
  total_bayar    INTEGER NOT NULL DEFAULT 0,
  sisa_kembalian INTEGER DEFAULT 0,
  sisa_tunggakan INTEGER DEFAULT 0,
  status_lunas   INTEGER DEFAULT 0,                   -- 0/1
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS upk_item (
  id            TEXT PRIMARY KEY,
  transaksi_id  TEXT REFERENCES upk_transaksi(id),
  kitab_id      INTEGER REFERENCES kitab(id),
  harga_saat_ini INTEGER NOT NULL,
  is_gratis     INTEGER DEFAULT 0,                    -- 0/1
  status_serah  TEXT DEFAULT 'BELUM',                 -- BELUM | SUDAH
  tanggal_serah TEXT
);

-- ============================================================
-- 26. MASTER JASA & RIWAYAT SURAT (Dewan Santri)
-- ============================================================
CREATE TABLE IF NOT EXISTS master_jasa (
  id         TEXT PRIMARY KEY,
  nama_jasa  TEXT NOT NULL,
  jenis      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS riwayat_surat (
  id          TEXT PRIMARY KEY,
  santri_id   TEXT REFERENCES santri(id),
  jenis_surat TEXT NOT NULL,
  detail_info TEXT,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- INDEXES — untuk performa query yang sering dipakai
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_santri_status      ON santri(status_global);
CREATE INDEX IF NOT EXISTS idx_santri_nis          ON santri(nis);
CREATE INDEX IF NOT EXISTS idx_santri_asrama       ON santri(asrama);
CREATE INDEX IF NOT EXISTS idx_riwayat_santri      ON riwayat_pendidikan(santri_id);
CREATE INDEX IF NOT EXISTS idx_riwayat_kelas       ON riwayat_pendidikan(kelas_id);
CREATE INDEX IF NOT EXISTS idx_riwayat_status      ON riwayat_pendidikan(status_riwayat);
CREATE INDEX IF NOT EXISTS idx_absensi_riwayat     ON absensi_harian(riwayat_pendidikan_id);
CREATE INDEX IF NOT EXISTS idx_absensi_tanggal     ON absensi_harian(tanggal);
CREATE INDEX IF NOT EXISTS idx_nilai_riwayat       ON nilai_akademik(riwayat_pendidikan_id);
CREATE INDEX IF NOT EXISTS idx_spp_santri          ON spp_log(santri_id);
CREATE INDEX IF NOT EXISTS idx_spp_bulan_tahun     ON spp_log(bulan, tahun);
CREATE INDEX IF NOT EXISTS idx_perizinan_santri    ON perizinan(santri_id);
CREATE INDEX IF NOT EXISTS idx_perizinan_status    ON perizinan(status);
CREATE INDEX IF NOT EXISTS idx_pelanggaran_santri  ON pelanggaran(santri_id);
CREATE INDEX IF NOT EXISTS idx_tabungan_santri     ON tabungan_log(santri_id);
CREATE INDEX IF NOT EXISTS idx_pembayaran_santri   ON pembayaran_tahunan(santri_id);
CREATE INDEX IF NOT EXISTS idx_upk_santri          ON upk_transaksi(santri_id);
CREATE INDEX IF NOT EXISTS idx_kelas_ta            ON kelas(tahun_ajaran_id);
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role          ON users(role);