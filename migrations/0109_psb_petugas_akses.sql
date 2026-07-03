-- Akses khusus petugas PSB per-user (bukan berbasis role), terpisah dari
-- role/jabatan struktural. Melengkapi psb_bayar_akses (migrasi 0108):
--   psb_verifikasi_akses -> step kesekretariatan (verifikasi santri)
--   psb_asrama_akses     -> step penempatan asrama
-- User yang diberi akses bertindak penuh seperti admin/petugas pusat pada
-- step tsb, TERMASUK melihat seluruh santri PSB (tidak di-scope asrama binaan).
ALTER TABLE users ADD COLUMN psb_verifikasi_akses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN psb_asrama_akses INTEGER NOT NULL DEFAULT 0;
