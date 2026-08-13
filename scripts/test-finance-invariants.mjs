import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const cwd=resolve(import.meta.dirname,'..')
const wranglerBin=resolve(cwd,'node_modules','wrangler','bin','wrangler.js')
const persist=resolve(cwd,'.codex-temp',`finance-invariant-test-${Date.now()}`)
const env={...process.env,XDG_CONFIG_HOME:resolve(cwd,'.codex-temp'),NO_COLOR:'1'}

function wrangler(args,expectError){
  const result=spawnSync(process.execPath,[wranglerBin,'d1','execute','DEMO_DB','--local','--persist-to',persist,...args],{cwd,env,encoding:'utf8',shell:false})
  const output=`${result.stdout||''}\n${result.stderr||''}`
  if(expectError){
    if(result.status===0||!output.includes(expectError))throw new Error(`Expected ${expectError}, got status ${result.status}\n${output}`)
  }else if(result.status!==0)throw new Error(`${result.error?.message||''}\n${output}`)
  return output
}

// Gunakan storage lokal terisolasi. Nama binding hanya kendaraan Wrangler;
// migrasi keuangan harus berhasil tanpa satu pun tabel dari DB utama.
wrangler(['--file','migrations-finance/0001_finance_centralized_core.sql'])
wrangler(['--file','migrations-finance/0002_credential_fast_enrollment.sql'])
wrangler(['--file','migrations-finance/0003_cash_unit_operators.sql'])
wrangler(['--file','migrations-finance/0004_demo_sandbox_reset.sql'])
wrangler(['--file','migrations-finance/0006_finance_integrity_hardening.sql'])

const positive=wrangler(['--command',`INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,actor_type,status) VALUES('t-j1','t-key-1','2026-08-01','Topup test','TEST','SYSTEM','DRAFT');
INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah) VALUES('t-e1','t-j1','fa-gateway-clearing','DEBIT',100000),('t-e2','t-j1','fa-guardian-float','CREDIT',100000);
INSERT INTO finance_wallet_movements(id,idempotency_key,journal_id,santri_id,wallet_kind,amount_rupiah,movement_type,reference_type,reference_id) VALUES('t-w1','t-w-key-1','t-j1','student-1','TITIPAN',100000,'TOPUP','TEST','1');
UPDATE finance_journals SET status='POSTED' WHERE id='t-j1';
SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id='student-1' AND wallet_kind='TITIPAN';`])
if(!/"balance_rupiah"\s*:\s*100000/.test(positive))throw new Error('Balanced posting did not materialize wallet balance.')

wrangler(['--command',`INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,actor_type,status) VALUES('t-j2','t-key-2','2026-08-01','Overdraft','TEST','SYSTEM','DRAFT');
INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah) VALUES('t-e3','t-j2','fa-guardian-float','DEBIT',120000),('t-e4','t-j2','fa-jajan-liability','CREDIT',120000);
INSERT INTO finance_wallet_movements(id,idempotency_key,journal_id,santri_id,wallet_kind,amount_rupiah,movement_type,reference_type,reference_id) VALUES('t-w2','t-w-key-2','t-j2','student-1','TITIPAN',-120000,'ALLOCATE','TEST','2');
UPDATE finance_journals SET status='POSTED' WHERE id='t-j2';`],'FINANCE_WALLET_INSUFFICIENT')

wrangler(['--command',`INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,actor_type,status) VALUES('t-j3','t-key-3','2026-08-01','Unbalanced','TEST','SYSTEM','DRAFT');
INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah) VALUES('t-e5','t-j3','fa-gateway-clearing','DEBIT',100000),('t-e6','t-j3','fa-guardian-float','CREDIT',90000);
UPDATE finance_journals SET status='POSTED' WHERE id='t-j3';`],'FINANCE_JOURNAL_UNBALANCED')

wrangler(['--command',`INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,actor_type,status) VALUES('t-j4','t-key-1','2026-08-01','Duplicate','TEST','SYSTEM','DRAFT');`],'UNIQUE constraint failed')

wrangler(['--command',`INSERT INTO finance_periods(period_key,status) VALUES('2026-07','CLOSED');
INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,actor_type,status) VALUES('t-j5','t-key-5','2026-07-31','Closed','TEST','SYSTEM','DRAFT');`],'FINANCE_PERIOD_CLOSED')

wrangler(['--command',`INSERT INTO finance_recipients(id,recipient_type,name,usable_after,status) VALUES('t-r1','OTHER','Recipient','2020-01-01','ACTIVE');
INSERT INTO finance_payouts(id,idempotency_key,recipient_id,payout_type,amount_rupiah,method,status,maker_id) VALUES('t-p1','t-p-key','t-r1','OTHER',50000,'CASH','SUBMITTED','staff-1');
UPDATE finance_payouts SET status='CHECKED',checker_id='staff-1' WHERE id='t-p1';`],'FINANCE_SELF_APPROVAL_FORBIDDEN')

const hybrid=wrangler(['--command',`SELECT mode FROM finance_credential_policy WHERE singleton_id=1;`])
if(!/"mode"\s*:\s*"HYBRID"/.test(hybrid))throw new Error('Credential policy migration did not enable HYBRID mode.')

wrangler(['--command',`INSERT INTO student_credentials(id,santri_id,credential_kind,token_hmac,token_version,status,card_number) VALUES('cred-1','student-1','QR_STATIC','hash-1',1,'ACTIVE','SKH-QR-1');`])
wrangler(['--command',`INSERT INTO student_credentials(id,santri_id,credential_kind,token_hmac,token_version,status,card_number) VALUES('cred-2','student-1','QR_STATIC','hash-2',1,'ACTIVE','SKH-QR-2');`],'UNIQUE constraint failed')

const bulk=wrangler(['--command',`INSERT INTO finance_credential_batches(id,credential_kind,status,total_count,created_by) VALUES('batch-1000','QR_STATIC','PROCESSING',1000,'staff-1');
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
INSERT INTO finance_credential_batch_items(batch_id,santri_id,position) SELECT 'batch-1000','bulk-student-'||n,n-1 FROM seq;
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<500)
INSERT INTO student_credentials(id,santri_id,credential_kind,token_hmac,token_version,status,card_number)
SELECT 'bulk-cred-'||n,'bulk-student-'||n,'QR_STATIC','bulk-hash-'||n,1,'ACTIVE','SKH-QR-BULK-'||n FROM seq;
UPDATE finance_credential_batch_items SET status='SUCCESS',credential_id='bulk-cred-'||(position+1),processed_at=datetime('now') WHERE batch_id='batch-1000' AND position<500;
SELECT COUNT(*) pending FROM finance_credential_batch_items WHERE batch_id='batch-1000' AND status='PENDING';`])
if(!/"pending"\s*:\s*500/.test(bulk))throw new Error('Credential batch resume did not preserve 500 pending rows.')

const resumed=wrangler(['--command',`WITH RECURSIVE seq(n) AS (SELECT 501 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
INSERT INTO student_credentials(id,santri_id,credential_kind,token_hmac,token_version,status,card_number)
SELECT 'bulk-cred-'||n,'bulk-student-'||n,'QR_STATIC','bulk-hash-'||n,1,'ACTIVE','SKH-QR-BULK-'||n FROM seq;
UPDATE finance_credential_batch_items SET status='SUCCESS',credential_id='bulk-cred-'||(position+1),processed_at=datetime('now') WHERE batch_id='batch-1000' AND status='PENDING';
UPDATE finance_credential_batches SET processed_count=1000,success_count=1000,failed_count=0,status='COMPLETED',completed_at=datetime('now') WHERE id='batch-1000';
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1000)
INSERT OR IGNORE INTO student_credentials(id,santri_id,credential_kind,token_hmac,token_version,status,card_number)
SELECT 'bulk-cred-'||n,'bulk-student-'||n,'QR_STATIC','bulk-hash-'||n,1,'ACTIVE','SKH-QR-BULK-'||n FROM seq;
SELECT (SELECT COUNT(*) FROM student_credentials WHERE id LIKE 'bulk-cred-%') credentials,
  (SELECT processed_count FROM finance_credential_batches WHERE id='batch-1000') processed,
  (SELECT COUNT(*) FROM (SELECT santri_id,credential_kind FROM student_credentials WHERE id LIKE 'bulk-cred-%' GROUP BY santri_id,credential_kind HAVING COUNT(*)>1)) duplicates;`])
if(!/"credentials"\s*:\s*1000/.test(resumed)||!/"processed"\s*:\s*1000/.test(resumed)||!/"duplicates"\s*:\s*0/.test(resumed))throw new Error('Credential batch resume produced incomplete or duplicate credentials.')

// Fixture alokasi/tagihan disiapkan terpisah: perintah yang di-ABORT trigger
// dibatalkan seluruhnya, termasuk INSERT fixture yang menyertainya.
wrangler(['--command',`INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,actor_type,status) VALUES('t-j10','t-key-10','2026-08-01','Alokasi','ALLOCATION','STAFF','DRAFT');
INSERT INTO finance_bills(id,santri_id,bill_kind,title,amount_rupiah,created_by) VALUES
  ('bill-a','student-a','USPP','USPP Agustus',60000,'staff-1'),
  ('bill-b','student-b','USPP','USPP Agustus',60000,'staff-1');
INSERT INTO finance_allocations(id,idempotency_key,santri_id,destination_kind,amount_rupiah,journal_id,created_by_type) VALUES('alloc-a','alloc-key-a','student-a','USPP',60000,'t-j10','STAFF');`])

// Alokasi tidak boleh menyentuh tagihan milik santri lain (0006).
wrangler(['--command',`INSERT INTO finance_allocation_bill_items(allocation_id,bill_id,amount_rupiah) VALUES('alloc-a','bill-b',60000);`],'FINANCE_BILL_OWNER_MISMATCH')

// Pembayaran tagihan diterapkan trigger, bukan UPDATE terpisah yang bisa no-op (0006).
const billApplied=wrangler(['--command',`INSERT INTO finance_allocation_bill_items(allocation_id,bill_id,amount_rupiah) VALUES('alloc-a','bill-a',60000);
SELECT paid_rupiah,status FROM finance_bills WHERE id='bill-a';`])
if(!/"paid_rupiah"\s*:\s*60000/.test(billApplied)||!/"status"\s*:\s*"PAID"/.test(billApplied))throw new Error('Allocation bill item did not apply payment to the bill.')

// Persetujuan reopen sekali pakai: reopen kedua wajib persetujuan baru (0006).
wrangler(['--command',`INSERT INTO finance_periods(period_key,status) VALUES('2026-06','CLOSED');
INSERT INTO finance_period_reopen_approvals(id,period_key,approver_id,reason) VALUES
  ('ap-1','2026-06','approver-1','alasan pembukaan kembali'),
  ('ap-2','2026-06','approver-2','alasan pembukaan kembali');
UPDATE finance_periods SET status='OPEN' WHERE period_key='2026-06';
UPDATE finance_period_reopen_approvals SET consumed_at=datetime('now') WHERE period_key='2026-06';
UPDATE finance_periods SET status='CLOSED' WHERE period_key='2026-06';`])
wrangler(['--command',`UPDATE finance_periods SET status='OPEN' WHERE period_key='2026-06';`],'FINANCE_REOPEN_NEEDS_TWO_APPROVALS')

// Auto-match rekonsiliasi menolak referensi yang tidak satu-ke-satu.
const autoMatch=wrangler(['--command',`INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,external_reference,actor_type,status) VALUES('t-j11','t-key-11','2026-08-02','Transfer','MANUAL','REF-DUPLIKAT','STAFF','DRAFT');
INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah) VALUES('t-e11','t-j11','fa-main-bank','DEBIT',75000),('t-e12','t-j11','fa-guardian-float','CREDIT',75000);
UPDATE finance_journals SET status='POSTED' WHERE id='t-j11';
INSERT INTO finance_reconciliation_imports(id,bank_account_label,source_filename,file_hash,imported_by,row_count,status) VALUES('imp-1','Rekening Utama','mutasi.csv','hash-imp-1','staff-1',2,'IMPORTING');
INSERT INTO finance_bank_transactions(id,import_id,row_number,transaction_at,amount_rupiah,bank_reference,raw_json) VALUES
  ('bt-1','imp-1',2,'2026-08-02',75000,'REF-DUPLIKAT','{}'),
  ('bt-2','imp-1',3,'2026-08-02',75000,'REF-DUPLIKAT','{}');
UPDATE finance_bank_transactions SET
    match_status='AUTO_MATCHED',matched_type='JOURNAL',
    matched_id=(SELECT j.id FROM finance_journals j WHERE j.external_reference=finance_bank_transactions.bank_reference AND j.status='POSTED'),
    matched_at=datetime('now')
  WHERE import_id='imp-1' AND bank_reference IS NOT NULL AND match_status='UNMATCHED'
    AND (SELECT COUNT(*) FROM finance_journals j WHERE j.external_reference=finance_bank_transactions.bank_reference AND j.status='POSTED')=1
    AND (SELECT COUNT(*) FROM finance_bank_transactions t WHERE t.bank_reference=finance_bank_transactions.bank_reference AND t.match_status='UNMATCHED')=1;
SELECT COUNT(*) matched FROM finance_bank_transactions WHERE import_id='imp-1' AND match_status='AUTO_MATCHED';`])
if(!/"matched"\s*:\s*0/.test(autoMatch))throw new Error('Auto-match bound one journal to multiple bank transactions.')

const reset=wrangler(['--command',`UPDATE finance_sandbox_state SET reset_enabled=1 WHERE singleton_id=1;
DELETE FROM finance_credential_batch_items;
DELETE FROM finance_credential_batches;
DELETE FROM student_credentials;
DELETE FROM finance_allocation_bill_items;
DELETE FROM finance_allocations;
DELETE FROM finance_bank_transactions;
DELETE FROM finance_wallet_movements;
DELETE FROM finance_journal_entries;
DELETE FROM finance_journals;
UPDATE finance_sandbox_state SET reset_enabled=0 WHERE singleton_id=1;
SELECT
  (SELECT COUNT(*) FROM finance_journals) journals,
  (SELECT COUNT(*) FROM finance_wallet_movements) movements,
  (SELECT reset_enabled FROM finance_sandbox_state WHERE singleton_id=1) reset_enabled;`])
if(!/"journals"\s*:\s*0/.test(reset)||!/"movements"\s*:\s*0/.test(reset)||!/"reset_enabled"\s*:\s*0/.test(reset))throw new Error('Sandbox reset guard did not clear immutable finance rows safely.')

process.stdout.write('finance invariants: 15 scenarios passed\n')
