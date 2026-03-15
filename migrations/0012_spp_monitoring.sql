-- Migration: SPP Monitoring Enhancement
-- Tambah kolom ke spp_setoran untuk pisah bulan ini vs tunggakan
-- Tambah kolom tanggal_tutup_buku ke spp_settings
-- Buat tabel spp_setoran_detail (snapshot santri saat setor)
-- Buat tabel spp_tunggakan_alasan (alasan penunggak per santri per bulan)

-- ── spp_setoran: tambah kolom ────────────────────────────────────────────
ALTER TABLE spp_setoran ADD COLUMN jumlah_bulan_ini     INTEGER DEFAULT 0;
ALTER TABLE spp_setoran ADD COLUMN jumlah_tunggakan_bayar INTEGER DEFAULT 0;
ALTER TABLE spp_setoran ADD COLUMN orang_bulan_ini      INTEGER DEFAULT 0;
ALTER TABLE spp_setoran ADD COLUMN orang_tunggakan      INTEGER DEFAULT 0;
ALTER TABLE spp_setoran ADD COLUMN status               TEXT DEFAULT 'terkirim';
ALTER TABLE spp_setoran ADD COLUMN tanggal_setor        TEXT;
ALTER TABLE spp_setoran ADD COLUMN konfirmasi_bulan_ini_by  TEXT REFERENCES users(id);
ALTER TABLE spp_setoran ADD COLUMN konfirmasi_bulan_ini_at  TEXT;
ALTER TABLE spp_setoran ADD COLUMN konfirmasi_tunggakan_by  TEXT REFERENCES users(id);
ALTER TABLE spp_setoran ADD COLUMN konfirmasi_tunggakan_at  TEXT;
ALTER TABLE spp_setoran ADD COLUMN aktual_bulan_ini     INTEGER DEFAULT 0;
ALTER TABLE spp_setoran ADD COLUMN aktual_tunggakan     INTEGER DEFAULT 0;

-- ── spp_settings: tambah tanggal tutup buku ──────────────────────────────
ALTER TABLE spp_settings ADD COLUMN tanggal_tutup_buku INTEGER DEFAULT 10;

-- ── spp_setoran_detail: snapshot santri saat setor ───────────────────────
CREATE TABLE IF NOT EXISTS spp_setoran_detail (
  id          TEXT PRIMARY KEY,
  setoran_id  TEXT NOT NULL REFERENCES spp_setoran(id) ON DELETE CASCADE,
  santri_id   TEXT NOT NULL REFERENCES santri(id),
  bulan_bayar INTEGER NOT NULL,
  tahun_bayar INTEGER NOT NULL,
  nominal     INTEGER NOT NULL DEFAULT 0,
  tipe        TEXT NOT NULL  -- 'bulan_ini' | 'tunggakan'
);

CREATE INDEX IF NOT EXISTS idx_setoran_detail_setoran ON spp_setoran_detail(setoran_id);
CREATE INDEX IF NOT EXISTS idx_setoran_detail_santri  ON spp_setoran_detail(santri_id);

-- ── spp_tunggakan_alasan: alasan penunggak per santri per bulan ──────────
CREATE TABLE IF NOT EXISTS spp_tunggakan_alasan (
  id         TEXT PRIMARY KEY,
  santri_id  TEXT NOT NULL REFERENCES santri(id),
  bulan      INTEGER NOT NULL,
  tahun      INTEGER NOT NULL,
  alasan     TEXT,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(santri_id, bulan, tahun)
);

CREATE INDEX IF NOT EXISTS idx_tunggakan_alasan ON spp_tunggakan_alasan(bulan, tahun);
