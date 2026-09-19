-- Migration: 0166_finance_navigation_and_settings.sql
-- Final Completion Patch B: Modul Pengaturan Keuangan & Navigation Completion
-- (PRD Bab 31, AGENTS.md, & Implementation Plan Patch B)
--
-- 1. Menyelesaikan seluruh orphan navigation routes pada fitur_akses
--    untuk Modul Keuangan Baru Pesantren.
-- 2. Menghilangkan status nonaktif pada rute Pengaturan Keuangan (/dashboard/keuangan/tarif).
-- 3. Mendaftarkan rute Kredensial & Kartu serta Uang Jajan Santri ke fitur_akses.
-- 4. Memastikan pengaturan default pada app_settings untuk limit dompet dan payment gateway.

-- ============================================================
-- 1. Registrasi & Sinkronisasi Seluruh Rute Finansial Baru ke fitur_akses
-- ============================================================

-- A. Dashboard Keuangan (Urutan 0)
INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Dashboard Keuangan',
    '/dashboard/keuangan',
    'LayoutDashboard',
    '["admin","bendahara","pimpinan"]',
    1,
    0
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan',
    title = 'Dashboard Keuangan',
    icon = 'LayoutDashboard',
    roles = '["admin","bendahara","pimpinan"]',
    is_active = 1,
    urutan = 0;

-- B. Status Pembayaran (Urutan 1)
INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Status Pembayaran',
    '/dashboard/keuangan/status-pembayaran',
    'CreditCard',
    '["admin","bendahara","pimpinan"]',
    1,
    1
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan',
    title = 'Status Pembayaran',
    icon = 'CreditCard',
    roles = '["admin","bendahara","pimpinan"]',
    is_active = 1,
    urutan = 1;

-- C. Penyaluran Dana (Urutan 2)
INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Penyaluran Dana',
    '/dashboard/keuangan/penyaluran',
    'SendHorizontal',
    '["admin","bendahara","pimpinan"]',
    1,
    2
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan',
    title = 'Penyaluran Dana',
    icon = 'SendHorizontal',
    roles = '["admin","bendahara","pimpinan"]',
    is_active = 1,
    urutan = 2;

-- D. Rekonsiliasi (Urutan 3)
INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Rekonsiliasi',
    '/dashboard/keuangan/rekonsiliasi',
    'ArrowLeftRight',
    '["admin","bendahara","pimpinan"]',
    1,
    3
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan',
    title = 'Rekonsiliasi',
    icon = 'ArrowLeftRight',
    roles = '["admin","bendahara","pimpinan"]',
    is_active = 1,
    urutan = 3;

-- E. Kredensial & Kartu (Urutan 4)
INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Kredensial & Kartu',
    '/dashboard/keuangan/kredensial',
    'IdentificationCard',
    '["admin","bendahara","admin_koperasi","petugas_koperasi","pimpinan"]',
    1,
    4
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan',
    title = 'Kredensial & Kartu',
    icon = 'IdentificationCard',
    roles = '["admin","bendahara","admin_koperasi","petugas_koperasi","pimpinan"]',
    is_active = 1,
    urutan = 4;

-- F. Uang Jajan Santri (Urutan 5)
INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Uang Jajan Santri',
    '/dashboard/keuangan/uang-jajan',
    'Wallet',
    '["admin","bendahara","admin_koperasi","petugas_koperasi","pimpinan"]',
    1,
    5
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan',
    title = 'Uang Jajan Santri',
    icon = 'Wallet',
    roles = '["admin","bendahara","admin_koperasi","petugas_koperasi","pimpinan"]',
    is_active = 1,
    urutan = 5;

-- G. Riwayat Transaksi (Urutan 6)
INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Riwayat Transaksi',
    '/dashboard/keuangan/riwayat',
    'ReceiptText',
    '["admin","bendahara","pimpinan"]',
    1,
    6
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan',
    title = 'Riwayat Transaksi',
    icon = 'ReceiptText',
    roles = '["admin","bendahara","pimpinan"]',
    is_active = 1,
    urutan = 6;

-- H. Laporan & Ekspor (Urutan 7)
INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Laporan & Ekspor',
    '/dashboard/keuangan/laporan',
    'FileSpreadsheet',
    '["admin","bendahara","pimpinan"]',
    1,
    7
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan',
    title = 'Laporan & Ekspor',
    icon = 'FileSpreadsheet',
    roles = '["admin","bendahara","pimpinan"]',
    is_active = 1,
    urutan = 7;

-- I. Pengaturan Keuangan (Urutan 8) - Mengaktifkan kembali rute /dashboard/keuangan/tarif
INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Pengaturan Keuangan',
    '/dashboard/keuangan/tarif',
    'Settings2',
    '["admin","bendahara","pimpinan"]',
    1,
    8
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan',
    title = 'Pengaturan Keuangan',
    icon = 'Settings2',
    roles = '["admin","bendahara","pimpinan"]',
    is_active = 1,
    urutan = 8;

-- J. Loket Kasir Koperasi di bawah Operasional
INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Operasional',
    'Loket Kasir',
    '/dashboard/koperasi/loket',
    'CashRegister',
    '["admin","bendahara","admin_koperasi","petugas_koperasi"]',
    1,
    1
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Operasional',
    title = 'Loket Kasir',
    icon = 'CashRegister',
    roles = '["admin","bendahara","admin_koperasi","petugas_koperasi"]',
    is_active = 1,
    urutan = 1;

-- ============================================================
-- 2. Mempertahankan Halaman Legacy untuk Histori & Cutover
-- ============================================================

INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan Pusat',
    'Keuangan Non-SPP (Histori)',
    '/dashboard/keuangan/non-spp',
    'HandCoins',
    '["admin","bendahara"]',
    1,
    90
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan Pusat',
    title = 'Keuangan Non-SPP (Histori)',
    is_active = 1;

INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan Pusat',
    'Setoran SPP Baru',
    '/dashboard/keuangan/setoran-spp-baru',
    'Landmark',
    '["admin","bendahara"]',
    1,
    91
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan Pusat',
    title = 'Setoran SPP Baru',
    is_active = 1;

INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan Pusat',
    'Operasional Unit',
    '/dashboard/keuangan/operasional',
    'Wallet',
    '["admin","bendahara"]',
    1,
    92
)
ON CONFLICT(href) DO UPDATE SET
    group_name = 'Keuangan Pusat',
    title = 'Operasional Unit',
    is_active = 1;

-- ============================================================
-- 3. Inisialisasi Pengaturan Default app_settings Jika Belum Ada
-- ============================================================

INSERT OR IGNORE INTO app_settings (key, value, updated_at)
VALUES
    ('uang_jajan_global_daily_limit', '100000', datetime('now')),
    ('gateway_fee_payer', 'CUSTOMER', datetime('now')),
    ('settlement_destination_bank', 'Bank Syariah Indonesia (BSI)', datetime('now')),
    ('settlement_destination_account', '', datetime('now')),
    ('settlement_account_holder', 'Pesantren SKH', datetime('now'));
