-- Database Cleanup: Remove Leading Zeros from Room Numbers

-- 1. Table: santri (Main data)
UPDATE santri 
SET kamar = ltrim(kamar, '0') 
WHERE kamar LIKE '0%' AND length(kamar) > 1;

-- 2. Table: kamar_config (Room settings)
UPDATE kamar_config 
SET nomor_kamar = ltrim(nomor_kamar, '0') 
WHERE nomor_kamar LIKE '0%' AND length(nomor_kamar) > 1;

-- 3. Table: kamar_ketua (Room leaders)
UPDATE kamar_ketua 
SET nomor_kamar = ltrim(nomor_kamar, '0') 
WHERE nomor_kamar LIKE '0%' AND length(nomor_kamar) > 1;

-- 4. Table: kamar_draft (Room transfer drafts)
UPDATE kamar_draft 
SET kamar_lama = ltrim(kamar_lama, '0') 
WHERE kamar_lama LIKE '0%' AND length(kamar_lama) > 1;

UPDATE kamar_draft 
SET kamar_baru = ltrim(kamar_baru, '0') 
WHERE kamar_baru LIKE '0%' AND length(kamar_baru) > 1;
