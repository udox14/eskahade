import io, re

p = 'lib/finance/demo-seed.ts'
s = io.open(p, encoding='utf-8').read()


def rep(old, new, label):
    global s
    if old not in s:
        print('  LEWAT:', label); return
    s = s.replace(old, new, 1)
    print('  ok   :', label)


rep("export const DEMO_RFID_TOKEN = 'DEMO0001'\n", '', 'token RFID')

# daftar tabel reset -> hanya yang masih ada
a = s.index('const RESET_TABLES = [')
b = s.index('] as const', a) + len('] as const')
s = s[:a] + """// Urutan penting: anak dulu, induk belakangan, supaya foreign key tidak menolak.
const RESET_TABLES = [
  'finance_credential_batch_items',
  'finance_cash_unit_operators',
  'finance_allocation_bill_items',
  'finance_payroll_items',
  'finance_withdrawals',
  'finance_payouts',
  'finance_allocations',
  'finance_payment_intents',
  'finance_gateway_events',
  'finance_bills',
  'finance_service_bill_skip',
  'finance_service_arrears_historis',
  'finance_service_tariffs',
  'finance_payroll_periods',
  'finance_teacher_compensation',
  'finance_reconciliation_checks',
  'finance_recipients',
  'finance_cash_shifts',
  'finance_cash_units',
  'finance_credential_batches',
  'student_credentials',
  'finance_student_security',
  'finance_withdrawal_limits',
  'finance_guardian_students',
  'finance_guardians',
  'finance_wallet_movements',
  'finance_journal_entries',
  'finance_journals',
  'finance_student_wallets',
  'finance_account_balances',
  'finance_periods',
  'finance_audit_log',
  'finance_student_snapshots',
  'finance_teacher_snapshots',
  'finance_settings',
] as const""" + s[b:]
print('  ok   : daftar RESET_TABLES')

rep("  const rfidHash = await credentialHmac(DEMO_RFID_TOKEN, 1)\n", '', 'hash RFID')

rep("""      ('finance_laundry_cutoff','{"day":25,"time":"23:59"}')`),
    db.prepare(`INSERT INTO finance_payroll_policies
      (id,version,effective_from,fixed_salary_mode,threshold_percent,substitute_percent,default_session_rate_rupiah,created_by)
      VALUES('demo-payroll-policy',1,'2026-01-01','UNCHANGED',NULL,100,50000,?)`).bind(actorId),
    db.prepare(`UPDATE finance_credential_policy SET
      mode='HYBRID',transition_from=NULL,transition_to=NULL,transition_ends_at=NULL,
      denomination_rupiah=5000,per_transaction_cap_rupiah=200000,pin_max_attempts=3,
      updated_by=?,updated_at=datetime('now') WHERE singleton_id=1`).bind(actorId),""",
    """      ('finance_laundry_cutoff','{"day":25,"time":"23:59"}'),
      ('finance_payout_api_fee_rupiah','2500')`),
    db.prepare(`UPDATE finance_credential_policy SET
      mode='QR',denomination_rupiah=5000,per_transaction_cap_rupiah=200000,pin_max_attempts=3,
      updated_by=?,updated_at=datetime('now') WHERE singleton_id=1`).bind(actorId),""", 'setelan + kebijakan kredensial')

# staff snapshot dihapus
s2 = re.sub(r"  for \(const user of demoUsers\) \{\n    statements\.push\(db\.prepare\(`INSERT INTO finance_staff_snapshots\n(?:.*?\n)*?  \}\n\n", "", s, count=1)
print(('  ok   : ' if s2 != s else '  LEWAT: ') + 'staff snapshots')
s = s2

rep("""    db.prepare(`INSERT INTO finance_teacher_compensation
      (id,teacher_id,effective_from,fixed_salary_rupiah,session_rate_rupiah,created_by) VALUES
      ('demo-comp-1','1','2026-01-01',2500000,75000,?),
      ('demo-comp-2','2','2026-01-01',3000000,100000,?)`).bind(actorId, actorId),""",
    """    // Guru 1 kena potongan alfa/badal, guru 2 dibayar penuh (tarif potongan 0)
    // supaya kedua perilaku langsung terlihat di sandbox.
    db.prepare(`INSERT INTO finance_teacher_compensation
      (id,teacher_id,effective_from,monthly_salary_rupiah,alfa_deduction_per_day_rupiah,badal_deduction_per_day_rupiah,created_by) VALUES
      ('demo-comp-1','1','2026-01-01',2500000,50000,25000,?),
      ('demo-comp-2','2','2026-01-01',3000000,0,0,?)`).bind(actorId, actorId),""", 'kompensasi guru')

rep("""      (id,recipient_type,name,bank_code,account_number_encrypted,account_number_masked,account_holder_name,verified_at,usable_after,status,created_by)
      VALUES('demo-recipient','OTHER','Penerima Sandbox','014',?,'******7890','Penerima Sandbox',datetime('now'),datetime('now','-1 day'),'ACTIVE',?)`)""",
    """      (id,recipient_type,name,bank_code,account_number_encrypted,account_number_masked,account_holder_name,verified_at,verified_by,status,created_by)
      VALUES('demo-recipient','OTHER','Penerima Sandbox','014',?,'******7890','Penerima Sandbox',datetime('now'),?,'ACTIVE',?)`)""", 'rekening penerima')
rep(".bind(recipientAccount, actorId),", ".bind(recipientAccount, actorId, actorId),", 'bind rekening penerima')

rep("""      ('demo-qr-credential','demo-s-1','QR_STATIC',?,?,1,'ACTIVE','SKH-QR-DEMO0001',datetime('now'),?,?),
      ('demo-rfid-credential','demo-s-1','RFID_UID',?,NULL,1,'ACTIVE','SKH-RF-DEMO0001',datetime('now'),?,?)`)
      .bind(qrHash, qrEncrypted, actorId, actorId, rfidHash, actorId, actorId),
    db.prepare(`INSERT INTO finance_reconciliation_imports
      (id,bank_account_label,source_filename,file_hash,imported_by,row_count,status)
      VALUES('demo-recon','Rekening Sandbox','mutasi-sandbox.csv','demo-recon-hash',?,1,'READY')`).bind(actorId),
    db.prepare(`INSERT INTO finance_bank_transactions
      (id,import_id,row_number,transaction_at,amount_rupiah,bank_reference,description,raw_json)
      VALUES('demo-bank-tx','demo-recon',1,?,125000,'DEMO-BANK-001','Mutasi belum cocok (sandbox)','{}')`).bind(today),""",
    """      ('demo-qr-credential','demo-s-1','QR_STATIC',?,?,1,'ACTIVE','SKH-QR-DEMO0001',datetime('now'),?,?)`)
      .bind(qrHash, qrEncrypted, actorId, actorId),
    // Satu baris rekonsiliasi yang sudah cocok, supaya alur checklist bulanan
    // langsung terlihat bentuknya tanpa perlu diisi dulu.
    db.prepare(`INSERT INTO finance_reconciliation_checks
      (id,period_key,bank_account_label,system_total_rupiah,statement_total_rupiah,difference_rupiah,status,checked_by)
      VALUES('demo-recon',?,'Rekening Utama',1500000,1500000,0,'COCOK',?)`).bind(period, actorId),""", 'kredensial + rekonsiliasi')

rep("""    qrToken: DEMO_QR_TOKEN,
    rfidToken: DEMO_RFID_TOKEN,
    pin: DEMO_STUDENT_PIN,""",
    """    qrToken: DEMO_QR_TOKEN,
    pin: DEMO_STUDENT_PIN,""", 'nilai kembali')

io.open(p, 'w', encoding='utf-8').write(s)
print('selesai')
