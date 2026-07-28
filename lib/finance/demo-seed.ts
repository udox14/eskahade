import { hashPassword } from '@/lib/auth/password'
import { credentialHmac } from './credentials'
import { encryptFinanceValue } from './encryption'

export const DEMO_QR_TOKEN = 'SKH1.DEMO.SANTRI.0001.TEST.CREDENTIAL'
export const DEMO_RFID_TOKEN = 'DEMO0001'
export const DEMO_STUDENT_PIN = '123456'

export type DemoFinanceUser = {
  id: string
  fullName: string
  roles: string[]
}

const RESET_TABLES = [
  'finance_credential_batch_items',
  'finance_cash_unit_operators',
  'finance_allocation_bill_items',
  'finance_bank_transactions',
  'finance_incident_receipts',
  'finance_teaching_attendance',
  'finance_payroll_items',
  'finance_withdrawals',
  'finance_payouts',
  'finance_allocations',
  'finance_payment_intents',
  'finance_gateway_events',
  'finance_bills',
  'finance_reconciliation_imports',
  'finance_incident_modes',
  'finance_payroll_periods',
  'finance_teacher_compensation',
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
  'finance_period_reopen_approvals',
  'finance_periods',
  'finance_break_glass',
  'finance_staff_mfa',
  'finance_staff_sessions',
  'finance_auth_attempts',
  'finance_audit_log',
  'finance_outbox',
  'finance_student_snapshots',
  'finance_staff_snapshots',
  'finance_teacher_snapshots',
  'finance_payroll_policies',
  'finance_settings',
] as const

const students = [
  ['demo-s-1', '99001', 'Demo Santri Satu', 'AL-FALAH', 'A-01'],
  ['demo-s-2', '99002', 'Demo Santri Dua', 'AL-FALAH', 'A-02'],
  ['demo-s-3', '99003', 'Demo Santri Tiga', 'AS-SALAM', 'B-01'],
  ['demo-s-4', '99004', 'Demo Santri Empat', 'AS-SALAM', 'B-02'],
  ['demo-s-5', '99005', 'Demo Santri Lima', 'BAHAGIA', 'C-01'],
  ['demo-s-6', '99006', 'Demo Santri Enam', 'BAHAGIA', 'C-02'],
] as const

export async function resetDemoFinanceDatabase(db: D1Database, demoUsers: DemoFinanceUser[]) {
  const actorId = demoUsers[0]?.id || 'demo-user'
  const qrHash = await credentialHmac(DEMO_QR_TOKEN, 1)
  const rfidHash = await credentialHmac(DEMO_RFID_TOKEN, 1)
  const qrEncrypted = await encryptFinanceValue(DEMO_QR_TOKEN)
  const recipientAccount = await encryptFinanceValue('1234567890')
  const pinHash = await hashPassword(DEMO_STUDENT_PIN)
  const today = new Date().toISOString().slice(0, 10)
  const period = today.slice(0, 7)

  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE finance_sandbox_state SET reset_enabled=1,reset_at=datetime('now') WHERE singleton_id=1`),
    ...RESET_TABLES.map(table => db.prepare(`DELETE FROM ${table}`)),
    db.prepare(`INSERT INTO finance_settings(key,value) VALUES
      ('finance_payment_intent_ttl_hours','24'),
      ('finance_soft_alerts','{"topup_rupiah":5000000,"student_balance_rupiah":10000000,"aggregate_float_rupiah":500000000}'),
      ('finance_meal_cutoff','{"day":25,"time":"23:59"}'),
      ('finance_laundry_cutoff','{"day":25,"time":"23:59"}')`),
    db.prepare(`INSERT INTO finance_payroll_policies
      (id,version,effective_from,fixed_salary_mode,threshold_percent,substitute_percent,default_session_rate_rupiah,created_by)
      VALUES('demo-payroll-policy',1,'2026-01-01','UNCHANGED',NULL,100,50000,?)`).bind(actorId),
    db.prepare(`UPDATE finance_credential_policy SET
      mode='HYBRID',transition_from=NULL,transition_to=NULL,transition_ends_at=NULL,
      denomination_rupiah=5000,per_transaction_cap_rupiah=200000,pin_max_attempts=3,
      updated_by=?,updated_at=datetime('now') WHERE singleton_id=1`).bind(actorId),
    db.prepare(`INSERT INTO finance_periods(period_key,status) VALUES(?,'OPEN')`).bind(period),
  ]

  for (const [id, nis, name, asrama, kamar] of students) {
    statements.push(db.prepare(`INSERT INTO finance_student_snapshots
      (santri_id,nis,full_name,asrama,kamar,status_global) VALUES(?,?,?,?,?,'aktif')`)
      .bind(id, nis, name, asrama, kamar))
  }

  for (const user of demoUsers) {
    statements.push(db.prepare(`INSERT INTO finance_staff_snapshots
      (user_id,full_name,roles_json) VALUES(?,?,?)`).bind(user.id, user.fullName, JSON.stringify(user.roles)))
  }

  statements.push(
    db.prepare(`INSERT INTO finance_teacher_snapshots(teacher_id,full_name) VALUES
      ('1','Ust. Demo Fulan'),('2','Ust. Demo Ahmad')`),
    db.prepare(`INSERT INTO finance_teacher_compensation
      (id,teacher_id,effective_from,fixed_salary_rupiah,session_rate_rupiah,created_by) VALUES
      ('demo-comp-1','1','2026-01-01',2500000,75000,?),
      ('demo-comp-2','2','2026-01-01',3000000,100000,?)`).bind(actorId, actorId),
    db.prepare(`INSERT INTO finance_cash_units(id,name,asrama_scope,fixed_float_rupiah)
      VALUES('demo-cash-unit','Loket Sandbox',NULL,1000000)`),
  )

  for (const user of demoUsers) {
    statements.push(db.prepare(`INSERT INTO finance_cash_unit_operators
      (cash_unit_id,operator_id,assigned_by) VALUES('demo-cash-unit',?,?)`).bind(user.id, actorId))
  }

  statements.push(
    db.prepare(`INSERT INTO finance_recipients
      (id,recipient_type,name,bank_code,account_number_encrypted,account_number_masked,account_holder_name,verified_at,usable_after,status,created_by)
      VALUES('demo-recipient','OTHER','Penerima Sandbox','014',?,'******7890','Penerima Sandbox',datetime('now'),datetime('now','-1 day'),'ACTIVE',?)`)
      .bind(recipientAccount, actorId),
    db.prepare(`INSERT INTO finance_bills
      (id,santri_id,bill_kind,title,period_key,amount_rupiah,due_date,created_by) VALUES
      ('demo-bill-spp','demo-s-1','SPP','SPP Sandbox',?,700000,date('now','+14 days'),?),
      ('demo-bill-uspp','demo-s-2','USPP','USPP Sandbox',?,1500000,date('now','+30 days'),?),
      ('demo-bill-nonspp','demo-s-3','NON_SPP','Kegiatan Sandbox',?,250000,date('now','+21 days'),?)`)
      .bind(period, actorId, period, actorId, period, actorId),
    db.prepare(`INSERT INTO finance_journals
      (id,idempotency_key,effective_date,description,source_type,actor_type,actor_id,status)
      VALUES('demo-opening-journal','demo:opening',?,'Saldo awal sandbox','DEMO_OPENING','SYSTEM',?,'DRAFT')`)
      .bind(today, actorId),
    db.prepare(`INSERT INTO finance_journal_entries
      (id,journal_id,account_id,side,amount_rupiah,memo) VALUES
      ('demo-entry-bank','demo-opening-journal','fa-main-bank','DEBIT',1500000,'Dana sandbox'),
      ('demo-entry-float','demo-opening-journal','fa-guardian-float','CREDIT',1000000,'Titipan sandbox'),
      ('demo-entry-jajan','demo-opening-journal','fa-jajan-liability','CREDIT',500000,'Uang jajan sandbox')`),
    db.prepare(`INSERT INTO finance_wallet_movements
      (id,idempotency_key,journal_id,santri_id,wallet_kind,amount_rupiah,movement_type,reference_type,reference_id) VALUES
      ('demo-wm-1','demo:wm:1','demo-opening-journal','demo-s-1','TITIPAN',400000,'DEMO_OPENING','DEMO','1'),
      ('demo-wm-2','demo:wm:2','demo-opening-journal','demo-s-2','TITIPAN',350000,'DEMO_OPENING','DEMO','2'),
      ('demo-wm-3','demo:wm:3','demo-opening-journal','demo-s-3','TITIPAN',250000,'DEMO_OPENING','DEMO','3'),
      ('demo-wm-4','demo:wm:4','demo-opening-journal','demo-s-1','JAJAN',200000,'DEMO_OPENING','DEMO','4'),
      ('demo-wm-5','demo:wm:5','demo-opening-journal','demo-s-2','JAJAN',150000,'DEMO_OPENING','DEMO','5'),
      ('demo-wm-6','demo:wm:6','demo-opening-journal','demo-s-3','JAJAN',150000,'DEMO_OPENING','DEMO','6')`),
    db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id='demo-opening-journal'`),
    db.prepare(`INSERT INTO finance_student_security(santri_id,pin_hash) VALUES('demo-s-1',?)`).bind(pinHash),
    db.prepare(`INSERT INTO finance_withdrawal_limits(santri_id,daily_rupiah,weekly_rupiah,monthly_rupiah)
      VALUES('demo-s-1',200000,500000,1500000)`),
    db.prepare(`INSERT INTO student_credentials
      (id,santri_id,credential_kind,token_hmac,token_encrypted,token_version,status,card_number,physically_verified_at,physically_verified_by,created_by)
      VALUES
      ('demo-qr-credential','demo-s-1','QR_STATIC',?,?,1,'ACTIVE','SKH-QR-DEMO0001',datetime('now'),?,?),
      ('demo-rfid-credential','demo-s-1','RFID_UID',?,NULL,1,'ACTIVE','SKH-RF-DEMO0001',datetime('now'),?,?)`)
      .bind(qrHash, qrEncrypted, actorId, actorId, rfidHash, actorId, actorId),
    db.prepare(`INSERT INTO finance_reconciliation_imports
      (id,bank_account_label,source_filename,file_hash,imported_by,row_count,status)
      VALUES('demo-recon','Rekening Sandbox','mutasi-sandbox.csv','demo-recon-hash',?,1,'READY')`).bind(actorId),
    db.prepare(`INSERT INTO finance_bank_transactions
      (id,import_id,row_number,transaction_at,amount_rupiah,bank_reference,description,raw_json)
      VALUES('demo-bank-tx','demo-recon',1,?,125000,'DEMO-BANK-001','Mutasi belum cocok (sandbox)','{}')`).bind(today),
    db.prepare(`INSERT INTO finance_audit_log
      (id,actor_type,actor_id,action,entity_type,entity_id,after_json)
      VALUES('demo-audit-reset','SYSTEM',?,'RESET_SANDBOX','SANDBOX','finance',?)`)
      .bind(actorId, JSON.stringify({ students: students.length, demoUsers: demoUsers.length })),
    db.prepare(`UPDATE finance_sandbox_state SET reset_enabled=0 WHERE singleton_id=1`),
  )

  await db.batch(statements)
  return {
    students: students.length,
    demoUsers: demoUsers.length,
    qrToken: DEMO_QR_TOKEN,
    rfidToken: DEMO_RFID_TOKEN,
    pin: DEMO_STUDENT_PIN,
  }
}
