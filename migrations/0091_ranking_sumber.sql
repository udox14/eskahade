-- Kolom sumber untuk ranking: 'guru' (hasil kalkulasi leger) | 'sekpen' (input manual).
-- Final ditentukan sekpen: recalc guru tidak boleh menimpa baris ber-sumber 'sekpen'.
ALTER TABLE ranking ADD COLUMN sumber TEXT NOT NULL DEFAULT 'guru';
