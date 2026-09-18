-- Koreksi 0153: Keuangan Pusat tidak menjadi bagian dari sistem baru.
-- Jalankan juga bila 0153 sudah sempat diterapkan.
UPDATE fitur_akses
SET group_name='Sistem Keuangan Baru',updated_at=datetime('now')
WHERE href LIKE '/dashboard/keuangan-terpusat%';

UPDATE fitur_akses
SET group_name='Keuangan Pusat',title='Keuangan Non-SPP',icon='HandCoins',
    roles='["admin","bendahara"]',is_active=1,urutan=0,updated_at=datetime('now')
WHERE href='/dashboard/keuangan/non-spp';

UPDATE fitur_akses
SET group_name='Keuangan Pusat',title='Operasional Unit',icon='Wallet',
    roles='["admin","bendahara"]',is_active=1,urutan=3,updated_at=datetime('now')
WHERE href='/dashboard/keuangan/operasional';

UPDATE fitur_akses
SET group_name='Keuangan Pusat',title='Setoran SPP Santri Baru',icon='Landmark',
    roles='["admin","bendahara"]',is_active=1,urutan=4,updated_at=datetime('now')
WHERE href='/dashboard/keuangan/setoran-spp-baru';

-- Alias Keuangan Pusat memang sudah disembunyikan oleh konfigurasi lama 0135.
UPDATE fitur_akses SET is_active=0,updated_at=datetime('now')
WHERE href IN (
  '/dashboard/keuangan/pembayaran',
  '/dashboard/keuangan/tarif',
  '/dashboard/keuangan/laporan'
);

INSERT OR IGNORE INTO sidebar_groups(group_name,label,urutan,is_active)
VALUES('Keuangan Pusat','Keuangan Pusat',11,1);
UPDATE sidebar_groups
SET label='Keuangan Pusat',urutan=11,is_active=1,updated_at=datetime('now')
WHERE group_name='Keuangan Pusat';

INSERT OR IGNORE INTO sidebar_groups(group_name,label,urutan,is_active)
VALUES('Sistem Keuangan Baru','Sistem Keuangan Baru',12,1);
UPDATE sidebar_groups
SET label='Sistem Keuangan Baru',urutan=12,is_active=1,updated_at=datetime('now')
WHERE group_name='Sistem Keuangan Baru';

UPDATE sidebar_groups SET is_active=0,updated_at=datetime('now')
WHERE group_name IN ('Keuangan Terpusat','Unit Pembayaran');
