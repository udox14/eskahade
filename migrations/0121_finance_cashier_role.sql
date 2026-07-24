-- Role operator loket dan menu pengelolaan Unit Kas.

UPDATE fitur_akses
SET roles = '["admin","bendahara","operator_loket"]',
    updated_at = datetime('now')
WHERE href = '/dashboard/keuangan-terpusat/loket';

INSERT OR IGNORE INTO fitur_akses
  (group_name,title,href,icon,roles,is_active,urutan)
VALUES
  ('Keuangan Terpusat','Unit Kas','/dashboard/keuangan-terpusat/unit-kas','CashRegister','["admin","bendahara"]',1,202);

UPDATE fitur_akses
SET urutan = CASE
  WHEN href = '/dashboard/keuangan-terpusat/kredensial' THEN 203
  WHEN href = '/dashboard/keuangan-terpusat/payout' THEN 204
  WHEN href = '/dashboard/keuangan-terpusat/payroll' THEN 205
  WHEN href = '/dashboard/keuangan-terpusat/break-glass' THEN 206
  WHEN href = '/dashboard/keuangan-terpusat/operasi' THEN 207
  ELSE urutan
END,
updated_at = datetime('now')
WHERE href LIKE '/dashboard/keuangan-terpusat/%';

