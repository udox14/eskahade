-- Migration 0068: Keterangan opsional absen malam

ALTER TABLE absen_malam_v2 ADD COLUMN keterangan TEXT;
