-- Canonical sidebar for the cooperative rewrite of Keuangan Terpusat.
-- Main DB metadata only: no financial balance or transaction is changed.

CREATE TABLE IF NOT EXISTS sidebar_groups (
  group_name TEXT PRIMARY KEY,
  label TEXT,
  urutan INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Disable every legacy entry first. Canonical entries are enabled again below.
UPDATE fitur_akses
SET is_active=0, updated_at=datetime('now')
WHERE href LIKE '/dashboard/keuangan-terpusat%';

INSERT OR IGNORE INTO fitur_akses
  (group_name,title,href,icon,roles,is_active,urutan)
VALUES
  ('Keuangan Terpusat','Ringkasan','/dashboard/keuangan-terpusat','Bank','["admin","admin_koperasi","petugas_koperasi","bendahara","pimpinan","pengelola_makan","pengelola_laundry"]',1,200),
  ('Keuangan Terpusat','Tagihan & Pembayaran','/dashboard/keuangan-terpusat/tagihan','FileText','["admin","admin_koperasi","petugas_koperasi","bendahara","pimpinan","pengelola_makan","pengelola_laundry"]',1,201),
  ('Keuangan Terpusat','Dana Penerima & Pencairan','/dashboard/keuangan-terpusat/payout','HandCoins','["admin","admin_koperasi","petugas_koperasi","bendahara","pimpinan","pengelola_makan","pengelola_laundry"]',1,202),
  ('Keuangan Terpusat','Loket & Uang Jajan','/dashboard/keuangan-terpusat/loket','Wallet','["admin","admin_koperasi","petugas_koperasi"]',1,203),
  ('Keuangan Terpusat','Kartu QR Santri','/dashboard/keuangan-terpusat/kredensial','IdentificationCard','["admin","admin_koperasi","petugas_koperasi"]',1,204),
  ('Keuangan Terpusat','Transaksi & Laporan','/dashboard/keuangan-terpusat/transaksi','BookOpen','["admin","admin_koperasi","petugas_koperasi","bendahara","pimpinan","pengelola_makan","pengelola_laundry"]',1,205),
  ('Keuangan Terpusat','Pengaturan','/dashboard/keuangan-terpusat/pengaturan','Settings','["admin","admin_koperasi"]',1,206);

UPDATE fitur_akses
SET group_name='Keuangan Terpusat',
    title=CASE href
      WHEN '/dashboard/keuangan-terpusat' THEN 'Ringkasan'
      WHEN '/dashboard/keuangan-terpusat/tagihan' THEN 'Tagihan & Pembayaran'
      WHEN '/dashboard/keuangan-terpusat/payout' THEN 'Dana Penerima & Pencairan'
      WHEN '/dashboard/keuangan-terpusat/loket' THEN 'Loket & Uang Jajan'
      WHEN '/dashboard/keuangan-terpusat/kredensial' THEN 'Kartu QR Santri'
      WHEN '/dashboard/keuangan-terpusat/transaksi' THEN 'Transaksi & Laporan'
      WHEN '/dashboard/keuangan-terpusat/pengaturan' THEN 'Pengaturan'
    END,
    icon=CASE href
      WHEN '/dashboard/keuangan-terpusat' THEN 'Bank'
      WHEN '/dashboard/keuangan-terpusat/tagihan' THEN 'FileText'
      WHEN '/dashboard/keuangan-terpusat/payout' THEN 'HandCoins'
      WHEN '/dashboard/keuangan-terpusat/loket' THEN 'Wallet'
      WHEN '/dashboard/keuangan-terpusat/kredensial' THEN 'IdentificationCard'
      WHEN '/dashboard/keuangan-terpusat/transaksi' THEN 'BookOpen'
      WHEN '/dashboard/keuangan-terpusat/pengaturan' THEN 'Settings'
    END,
    roles=CASE
      WHEN href IN (
        '/dashboard/keuangan-terpusat/loket',
        '/dashboard/keuangan-terpusat/kredensial'
      ) THEN '["admin","admin_koperasi","petugas_koperasi"]'
      WHEN href='/dashboard/keuangan-terpusat/pengaturan'
        THEN '["admin","admin_koperasi"]'
      ELSE '["admin","admin_koperasi","petugas_koperasi","bendahara","pimpinan","pengelola_makan","pengelola_laundry"]'
    END,
    is_active=1,
    urutan=CASE href
      WHEN '/dashboard/keuangan-terpusat' THEN 200
      WHEN '/dashboard/keuangan-terpusat/tagihan' THEN 201
      WHEN '/dashboard/keuangan-terpusat/payout' THEN 202
      WHEN '/dashboard/keuangan-terpusat/loket' THEN 203
      WHEN '/dashboard/keuangan-terpusat/kredensial' THEN 204
      WHEN '/dashboard/keuangan-terpusat/transaksi' THEN 205
      WHEN '/dashboard/keuangan-terpusat/pengaturan' THEN 206
    END,
    updated_at=datetime('now')
WHERE href IN (
  '/dashboard/keuangan-terpusat',
  '/dashboard/keuangan-terpusat/tagihan',
  '/dashboard/keuangan-terpusat/payout',
  '/dashboard/keuangan-terpusat/loket',
  '/dashboard/keuangan-terpusat/kredensial',
  '/dashboard/keuangan-terpusat/transaksi',
  '/dashboard/keuangan-terpusat/pengaturan'
);

INSERT OR IGNORE INTO sidebar_groups(group_name,label,urutan,is_active)
VALUES('Keuangan Terpusat','Keuangan Terpusat',12,1);

UPDATE sidebar_groups
SET label='Keuangan Terpusat',urutan=12,is_active=1,updated_at=datetime('now')
WHERE group_name='Keuangan Terpusat';
