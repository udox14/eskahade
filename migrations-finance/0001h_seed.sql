-- Migrasi keuangan 0001h - DATA AWAL.
-- Dijalankan paling akhir. Semua INSERT memakai OR IGNORE agar aman diulang.

PRAGMA foreign_keys = ON;

-- Bagan akun. Harus persis sama dengan katalog di lib/finance/postings.ts;
-- kalau salah satu berubah, yang lain wajib ikut berubah.
INSERT OR IGNORE INTO finance_accounts(id,code,name,account_type,normal_balance,allow_negative) VALUES
('fa-main-bank','1101','Rekening Utama','ASSET','DEBIT',0),
('fa-gateway-clearing','1102','Clearing Gateway','ASSET','DEBIT',1),
('fa-central-cash','1103','Kas Pusat','ASSET','DEBIT',0),
('fa-unit-cash','1104','Kas Unit/Loket','ASSET','DEBIT',0),
('fa-parent-receivable','1201','Piutang Wali','ASSET','DEBIT',0),
('fa-guardian-float','2101','Titipan Wali','LIABILITY','CREDIT',0),
('fa-meal-payable','2102','Utang Pengelola Makan','LIABILITY','CREDIT',0),
('fa-laundry-payable','2103','Utang Pengelola Laundry','LIABILITY','CREDIT',0),
('fa-payroll-payable','2104','Utang Payroll','LIABILITY','CREDIT',0),
('fa-jajan-liability','2105','Titipan Uang Jajan','LIABILITY','CREDIT',0),
('fa-spp-revenue','4101','Pendapatan SPP','REVENUE','CREDIT',0),
('fa-uspp-revenue','4102','Pendapatan USPP/Uang Bangunan','REVENUE','CREDIT',0),
('fa-nonspp-revenue','4103','Pendapatan Non-SPP','REVENUE','CREDIT',0),
('fa-gateway-fee-revenue','4104','Penerimaan Biaya Gateway dari Wali','REVENUE','CREDIT',0),
('fa-gateway-fee-expense','5101','Biaya Gateway','EXPENSE','DEBIT',0),
('fa-payroll-expense','5102','Beban Payroll','EXPENSE','DEBIT',0),
('fa-suspense','9999','Suspense/Rekonsiliasi','ASSET','DEBIT',1);

-- Kredensial: QR Code, satu metode, tanpa jalur transisi.
INSERT OR IGNORE INTO finance_credential_policy(singleton_id,mode) VALUES(1,'QR');

INSERT OR IGNORE INTO finance_settings(key,value) VALUES
('finance_payment_intent_ttl_hours','24'),
('finance_soft_alerts','{"topup_rupiah":5000000,"student_balance_rupiah":10000000,"aggregate_float_rupiah":500000000}'),
('finance_meal_cutoff','{"day":25,"time":"23:59"}'),
('finance_laundry_cutoff','{"day":25,"time":"23:59"}'),
('finance_payout_api_fee_rupiah','2500');
