-- Enam unit pembayaran adalah workspace di dalam Sistem Keuangan Baru.
-- Keuangan Pusat adalah sistem lama yang tetap berdiri sendiri.
UPDATE fitur_akses
SET group_name='Sistem Keuangan Baru',
    urutan=CASE href
      WHEN '/dashboard/keuangan-terpusat/unit/uang-jajan' THEN 201
      WHEN '/dashboard/keuangan-terpusat/unit/makan' THEN 202
      WHEN '/dashboard/keuangan-terpusat/unit/laundry' THEN 203
      WHEN '/dashboard/keuangan-terpusat/unit/spp' THEN 204
      WHEN '/dashboard/keuangan-terpusat/unit/bangunan' THEN 205
      WHEN '/dashboard/keuangan-terpusat/unit/biaya-tahunan' THEN 206
    END,
    updated_at=datetime('now')
WHERE href IN (
  '/dashboard/keuangan-terpusat/unit/uang-jajan',
  '/dashboard/keuangan-terpusat/unit/makan',
  '/dashboard/keuangan-terpusat/unit/laundry',
  '/dashboard/keuangan-terpusat/unit/spp',
  '/dashboard/keuangan-terpusat/unit/bangunan',
  '/dashboard/keuangan-terpusat/unit/biaya-tahunan'
);

UPDATE fitur_akses
SET group_name='Sistem Keuangan Baru',
    title=CASE href
      WHEN '/dashboard/keuangan-terpusat' THEN 'Ringkasan Pusat'
      WHEN '/dashboard/keuangan-terpusat/tagihan' THEN 'Pembayaran Gabungan'
      WHEN '/dashboard/keuangan-terpusat/payout' THEN 'Penyaluran Pusat'
      WHEN '/dashboard/keuangan-terpusat/loket' THEN 'Loket Pembayaran'
      WHEN '/dashboard/keuangan-terpusat/kredensial' THEN 'Kartu QR Santri'
      WHEN '/dashboard/keuangan-terpusat/transaksi' THEN 'Transaksi & Jurnal'
      WHEN '/dashboard/keuangan-terpusat/pengaturan' THEN 'Pengaturan Pusat'
    END,
    urutan=CASE href
      WHEN '/dashboard/keuangan-terpusat' THEN 200
      WHEN '/dashboard/keuangan-terpusat/tagihan' THEN 210
      WHEN '/dashboard/keuangan-terpusat/payout' THEN 211
      WHEN '/dashboard/keuangan-terpusat/loket' THEN 212
      WHEN '/dashboard/keuangan-terpusat/kredensial' THEN 213
      WHEN '/dashboard/keuangan-terpusat/transaksi' THEN 214
      WHEN '/dashboard/keuangan-terpusat/pengaturan' THEN 215
    END,
    roles=CASE href
      WHEN '/dashboard/keuangan-terpusat' THEN '["admin","admin_koperasi","bendahara"]'
      WHEN '/dashboard/keuangan-terpusat/tagihan' THEN '["admin","admin_koperasi","bendahara"]'
      WHEN '/dashboard/keuangan-terpusat/payout' THEN '["admin","admin_koperasi","bendahara"]'
      WHEN '/dashboard/keuangan-terpusat/loket' THEN '["admin","admin_koperasi","petugas_koperasi"]'
      WHEN '/dashboard/keuangan-terpusat/kredensial' THEN '["admin","admin_koperasi","petugas_koperasi"]'
      WHEN '/dashboard/keuangan-terpusat/transaksi' THEN '["admin","admin_koperasi","bendahara"]'
      WHEN '/dashboard/keuangan-terpusat/pengaturan' THEN '["admin","admin_koperasi"]'
    END,
    is_active=1,
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
VALUES('Sistem Keuangan Baru','Sistem Keuangan Baru',12,1);
UPDATE sidebar_groups
SET label='Sistem Keuangan Baru',urutan=12,is_active=1,updated_at=datetime('now')
WHERE group_name='Sistem Keuangan Baru';
UPDATE sidebar_groups SET is_active=0,updated_at=datetime('now')
WHERE group_name IN ('Unit Pembayaran','Keuangan Terpusat');
