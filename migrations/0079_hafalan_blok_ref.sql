-- ============================================================
-- Migration 0079: Referensi teks blok hafalan
-- ============================================================
-- Tiap blok menyimpan `ref` yang menunjuk ke teks (ayat/hadits/matan)
-- di file JSON repo (lib/hafalan/data). Resolver: lib/hafalan/text.ts
-- Format ref:
--   quran:{surah}:{ayah}     hadits:{kitab}:{no}
--   alfiyah:{bait}           jurumiyah:{slug}     amtsilah:{slug}

ALTER TABLE hafalan_blok ADD COLUMN ref TEXT;

-- Backfill quran: bab.urutan = nomor surat, blok.urutan = nomor ayat
UPDATE hafalan_blok
SET ref = 'quran:'
  || (SELECT hb.urutan FROM hafalan_bab hb WHERE hb.id = hafalan_blok.bab_id)
  || ':' || hafalan_blok.urutan
WHERE ref IS NULL
  AND (SELECT hb.jenis FROM hafalan_bab hb WHERE hb.id = hafalan_blok.bab_id) = 'quran';

CREATE INDEX IF NOT EXISTS idx_hafalan_blok_ref ON hafalan_blok(ref);
