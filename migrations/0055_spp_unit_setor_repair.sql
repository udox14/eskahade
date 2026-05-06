UPDATE spp_setoran
SET unit_setor = asrama,
    jenis_unit_setor = CASE
      WHEN UPPER(TRIM(asrama)) = 'SADESA' THEN 'SADESA'
      ELSE 'ASRAMA'
    END
WHERE unit_setor IS NULL OR TRIM(unit_setor) = '';

DELETE FROM spp_setoran
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(NULLIF(TRIM(unit_setor), ''), asrama), bulan, tahun
        ORDER BY datetime(COALESCE(tanggal_terima, created_at)) DESC, created_at DESC, id DESC
      ) AS rn
    FROM spp_setoran
  ) dedupe
  WHERE rn > 1
);

DROP INDEX IF EXISTS uq_spp_setoran_unit_setor_bulan_tahun;

CREATE UNIQUE INDEX IF NOT EXISTS uq_spp_setoran_unit_setor_bulan_tahun
  ON spp_setoran(unit_setor, bulan, tahun);
