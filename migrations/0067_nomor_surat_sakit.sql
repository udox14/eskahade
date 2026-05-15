-- Migration 0067: Nomor Surat Sakit

ALTER TABLE absen_sakit ADD COLUMN nomor_surat_sakit TEXT;
