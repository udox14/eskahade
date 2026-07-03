-- Akses khusus bayar PSB: admin bisa grant per-user (biasanya pengurus_asrama
-- yang ditunjuk menjabat bendahara), terpisah dari role/jabatan struktural.
ALTER TABLE users ADD COLUMN psb_bayar_akses INTEGER NOT NULL DEFAULT 0;
