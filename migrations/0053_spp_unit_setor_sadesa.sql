ALTER TABLE spp_setoran ADD COLUMN unit_setor TEXT NOT NULL DEFAULT '';
ALTER TABLE spp_setoran ADD COLUMN jenis_unit_setor TEXT NOT NULL DEFAULT 'ASRAMA';

UPDATE spp_setoran
SET unit_setor = asrama,
    jenis_unit_setor = CASE
      WHEN UPPER(TRIM(asrama)) = 'SADESA' THEN 'SADESA'
      ELSE 'ASRAMA'
    END
WHERE unit_setor IS NULL OR TRIM(unit_setor) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_spp_setoran_unit_setor_bulan_tahun
  ON spp_setoran(unit_setor, bulan, tahun);
