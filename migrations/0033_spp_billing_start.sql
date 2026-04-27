-- Migration 0033: SPP billing start period
-- Stores the first month that should be treated as billable by SPP monitoring.

INSERT OR IGNORE INTO app_settings (key, value)
VALUES ('spp_tagihan_mulai', '2026-01');
