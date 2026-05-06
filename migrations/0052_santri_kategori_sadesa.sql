ALTER TABLE santri ADD COLUMN kategori_santri TEXT NOT NULL DEFAULT 'REGULER';

UPDATE santri
SET kategori_santri = 'SADESA'
WHERE UPPER(COALESCE(sekolah, '')) = 'SADESA';

UPDATE santri
SET sekolah = NULL,
    kelas_sekolah = NULL
WHERE kategori_santri = 'SADESA';

CREATE INDEX IF NOT EXISTS idx_santri_kategori_santri
  ON santri(kategori_santri);
