-- Application-side bridge for the dedicated FINANCE_DB.
-- This migration intentionally creates no financial tables in the main DB.

INSERT OR IGNORE INTO app_settings(key,value) VALUES
('finance_legacy_mode','{"new_system_enabled":false,"pilot_asrama":null,"legacy_new_writes_disabled":false,"auto_wallet_worker_disabled_cohorts":[]}');

-- Cohort pilot tidak boleh memakai dompet/pencairan legacy dan baru bersamaan.
CREATE TRIGGER IF NOT EXISTS trg_finance_block_legacy_wallet_pilot
BEFORE INSERT ON tabungan_log
WHEN json_extract(COALESCE((SELECT value FROM app_settings WHERE key='finance_legacy_mode'),'{}'),'$.new_system_enabled')=1
 AND (
   json_extract((SELECT value FROM app_settings WHERE key='finance_legacy_mode'),'$.legacy_new_writes_disabled')=1
   OR (SELECT asrama FROM santri WHERE id=NEW.santri_id)=json_extract((SELECT value FROM app_settings WHERE key='finance_legacy_mode'),'$.pilot_asrama')
   OR EXISTS (
     SELECT 1 FROM json_each(COALESCE(json_extract((SELECT value FROM app_settings WHERE key='finance_legacy_mode'),'$.auto_wallet_worker_disabled_cohorts'),'[]'))
     WHERE value=(SELECT asrama FROM santri WHERE id=NEW.santri_id)
   )
 )
BEGIN SELECT RAISE(ABORT,'FINANCE_LEGACY_WALLET_DISABLED_FOR_COHORT'); END;

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan) VALUES
('Keuangan Terpusat','Ringkasan Keuangan','/dashboard/keuangan-terpusat','Landmark','["admin","bendahara","dewan_santri","pengurus_asrama"]',1,200),
('Keuangan Terpusat','Loket Pencairan','/dashboard/keuangan-terpusat/loket','ScanLine','["admin","bendahara","dewan_santri","pengurus_asrama"]',1,201),
('Keuangan Terpusat','Kredensial RFID/QR','/dashboard/keuangan-terpusat/kredensial','CreditCard','["admin","bendahara"]',1,202),
('Keuangan Terpusat','Payout','/dashboard/keuangan-terpusat/payout','SendHorizontal','["admin","bendahara","dewan_santri","pengurus_asrama"]',1,203),
('Keuangan Terpusat','Payroll','/dashboard/keuangan-terpusat/payroll','BadgeDollarSign','["admin","bendahara","dewan_santri"]',1,204),
('Keuangan Terpusat','Break-glass Keuangan','/dashboard/keuangan-terpusat/break-glass','ShieldAlert','["admin","dewan_santri"]',1,205),
('Keuangan Terpusat','Operasi & Rekonsiliasi','/dashboard/keuangan-terpusat/operasi','Settings2','["admin","bendahara","dewan_santri"]',1,206),
('Portal Guru','Slip Gaji','/dashboard/guru/slip-gaji','ReceiptText','["guru"]',1,207);
