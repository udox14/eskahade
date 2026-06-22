-- ============================================================
-- Migration 0097: UPK Katalog Consignment
-- ============================================================

ALTER TABLE upk_katalog ADD COLUMN is_consignment INTEGER NOT NULL DEFAULT 0;
ALTER TABLE upk_belanja_item ADD COLUMN qty_retur INTEGER NOT NULL DEFAULT 0;
