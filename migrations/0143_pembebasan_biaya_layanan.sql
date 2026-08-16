-- Migrasi 0143: pembebasan biaya permanen granular per layanan (SPP/Makan/
-- Laundry/USPP), sumber kebenaran baru untuk Keuangan Terpusat.
--
-- santri.bebas_spp TIDAK dihapus — dipertahankan sebagai mirror sinkron
-- (lihat lib/finance/exemptions.ts, setExemption melakukan dual-write) supaya
-- 20+ tempat yang sudah membaca kolom itu tidak perlu diubah.
--
-- Bangunan/Kesehatan/EHB/Ekskul SENGAJA tidak dipindah ke sini — mekanisme
-- exemption-nya (marker nominal_bayar=0 di pembayaran_tahunan) sudah
-- granular per tahun_tagihan, memindahkannya ke tabel on/off permanen macam
-- ini justru menghilangkan granularitas per-tahun itu.

CREATE TABLE IF NOT EXISTS santri_pembebasan_biaya (
  id          TEXT PRIMARY KEY,
  santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  service_kind TEXT NOT NULL CHECK (service_kind IN ('SPP','MAKAN','LAUNDRY','USPP')),
  is_active   INTEGER NOT NULL DEFAULT 1,
  alasan      TEXT,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  TEXT REFERENCES users(id),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(santri_id, service_kind)
);

CREATE INDEX IF NOT EXISTS idx_santri_pembebasan_biaya_santri
  ON santri_pembebasan_biaya(santri_id, service_kind, is_active);

CREATE INDEX IF NOT EXISTS idx_santri_pembebasan_biaya_kind_active
  ON santri_pembebasan_biaya(service_kind, is_active);

-- Backfill: santri yang sudah bebas_spp=1 hari ini otomatis punya baris SPP
-- aktif. created_by dibiarkan NULL (bukan 'system') karena kolomnya
-- REFERENCES users(id) — 'system' bukan id user asli dan melanggar FK.
INSERT INTO santri_pembebasan_biaya (id, santri_id, service_kind, is_active, alasan, created_by)
SELECT lower(hex(randomblob(16))), id, 'SPP', 1, 'Migrasi otomatis dari santri.bebas_spp (migrasi 0143)', NULL
FROM santri
WHERE bebas_spp = 1;
