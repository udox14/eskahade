-- ============================================================
-- Migration 0111: UPK Katalog Prioritas Stok
-- ============================================================

ALTER TABLE upk_katalog ADD COLUMN prioritas_stok TEXT NOT NULL DEFAULT 'LAMA';
