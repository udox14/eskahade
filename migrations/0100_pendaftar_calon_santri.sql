-- Migration 0100: Pendaftar (calon santri) — menampung pendaftar dari web PSB
-- (eskahade-psb / eskahade-psb.pages.dev). TERPISAH dari psb_flow (psb_flow
-- untuk daftar ulang). Modul "Pendaftar" memverifikasi & menerima → promote ke
-- tabel `santri` (status_global='aktif', kategori 'REGULER' → auto-tag "BARU").
--
-- Tabel di bawah mungkin sudah ada (dibuat saat setup web PSB) — IF NOT EXISTS
-- membuatnya idempoten. Yang baru di migration ini: seed menu fitur_akses.

CREATE TABLE IF NOT EXISTS pendaftar (
  id              TEXT PRIMARY KEY,
  no_reg          TEXT NOT NULL UNIQUE,
  nama_lengkap    TEXT NOT NULL,
  nama_panggilan  TEXT,
  jenis_kelamin   TEXT,
  tempat_lahir    TEXT,
  tanggal_lahir   TEXT,
  nik             TEXT,
  nisn            TEXT,
  asal_sd         TEXT,
  alamat_sd       TEXT,
  asal_smp        TEXT,
  alamat_smp      TEXT,
  status_anak     TEXT,
  anak_ke         TEXT,
  jumlah_saudara  TEXT,
  tinggi_badan    TEXT,
  berat_badan     TEXT,
  golongan_darah  TEXT,
  cita_cita       TEXT,
  hobi            TEXT,
  nama_ayah       TEXT,
  nik_ayah        TEXT,
  tgl_lahir_ayah  TEXT,
  usia_ayah       TEXT,
  pendidikan_ayah TEXT,
  pekerjaan_ayah  TEXT,
  wa_ayah         TEXT,
  penghasilan_ayah TEXT,
  nama_ibu        TEXT,
  nik_ibu         TEXT,
  tgl_lahir_ibu   TEXT,
  usia_ibu        TEXT,
  pendidikan_ibu  TEXT,
  pekerjaan_ibu   TEXT,
  wa_ibu          TEXT,
  penghasilan_ibu TEXT,
  alamat_lengkap  TEXT,
  provinsi        TEXT,
  kabupaten       TEXT,
  kecamatan       TEXT,
  desa            TEXT,
  kode_pos        TEXT,
  keinginan       TEXT,
  sekolah_santri  TEXT,
  kelas           TEXT,
  lemari          TEXT,
  kasur           TEXT,
  kartu_kesehatan TEXT,
  alasan_pindah   TEXT,
  kebiasaan_kurang_baik TEXT,
  penyakit        TEXT,
  status          TEXT NOT NULL DEFAULT 'menunggu',
  berkas_verified INTEGER NOT NULL DEFAULT 0,
  bayar_verified  INTEGER NOT NULL DEFAULT 0,
  edit_allowed    INTEGER NOT NULL DEFAULT 1,
  upload_allowed  INTEGER NOT NULL DEFAULT 1,
  catatan_admin   TEXT,
  santri_id       TEXT REFERENCES santri(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pendaftar_berkas (
  id           TEXT PRIMARY KEY,
  pendaftar_id TEXT NOT NULL REFERENCES pendaftar(id) ON DELETE CASCADE,
  jenis        TEXT NOT NULL,
  url          TEXT NOT NULL,
  uploaded_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pendaftar_id, jenis)
);

CREATE INDEX IF NOT EXISTS idx_pendaftar_status ON pendaftar(status);
CREATE INDEX IF NOT EXISTS idx_pendaftar_santri ON pendaftar(santri_id);
CREATE INDEX IF NOT EXISTS idx_pendaftar_no_reg ON pendaftar(no_reg);
CREATE INDEX IF NOT EXISTS idx_pendaftar_berkas ON pendaftar_berkas(pendaftar_id);

-- ── Menu sidebar + hak akses ────────────────────────────────────────────────
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES
  ('PSB', 'Pendaftar (Calon Santri)', '/dashboard/pendaftar', 'UserPlus', '["admin","sekpen","bendahara"]', 1, 2);

INSERT OR IGNORE INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
VALUES
  ('/dashboard/pendaftar', 'sekpen', 1, 1, 1, datetime('now'), datetime('now')),
  ('/dashboard/pendaftar', 'bendahara', 0, 1, 0, datetime('now'), datetime('now'));
