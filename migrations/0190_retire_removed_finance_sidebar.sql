-- Retire stale navigation left behind after the centralized finance module
-- was removed from the application in 635c2fae.
--
-- Keep feature rows for auditability and possible future recovery, but make
-- them unavailable to navigation and feature-access checks. Current finance
-- routes under /dashboard/keuangan remain managed by migrations 0165/0166.

UPDATE fitur_akses
SET is_active = 0,
    updated_at = datetime('now')
WHERE href = '/dashboard/keuangan-terpusat'
   OR href LIKE '/dashboard/keuangan-terpusat/%';

UPDATE sidebar_groups
SET is_active = 0,
    updated_at = datetime('now')
WHERE group_name IN (
  'Keuangan Terpusat',
  'Sistem Keuangan Baru',
  'Unit Pembayaran'
);
