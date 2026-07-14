ALTER TABLE hasil_tes_klasifikasi
ADD COLUMN tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id);

-- Data lama diikat ke event tes tempat santri pernah dijadwalkan. Untuk hasil
-- yang dibuat tanpa plotting, gunakan tahun ajaran yang sedang aktif saat
-- migrasi dijalankan agar daftar tahun berjalan tidak mendadak kosong.
UPDATE hasil_tes_klasifikasi AS h
SET tahun_ajaran_id = COALESCE(
  (
    SELECT e.tahun_ajaran_id
    FROM tes_klasifikasi_plotting AS p
    JOIN tes_klasifikasi_event AS e ON e.id = p.event_id
    WHERE p.santri_id = h.santri_id
    ORDER BY e.id DESC
    LIMIT 1
  ),
  (
    SELECT ta.id
    FROM tahun_ajaran AS ta
    WHERE ta.is_active = 1
    ORDER BY ta.id DESC
    LIMIT 1
  )
)
WHERE h.tahun_ajaran_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_hasil_tes_klasifikasi_tahun_ajaran
ON hasil_tes_klasifikasi(tahun_ajaran_id);
