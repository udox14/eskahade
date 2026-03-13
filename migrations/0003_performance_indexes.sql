-- ─── 11. bebas_spp cached column ──────────────────────────────────────────
-- Santri yang dibebaskan dari seluruh biaya SPP.
-- Di-set manual oleh admin lewat halaman manajemen santri.
ALTER TABLE santri ADD COLUMN bebas_spp INTEGER NOT NULL DEFAULT 0;