"""Transactional acceptance tests for the cooperative domain; SQLite mirrors D1 batch rollback."""
import sqlite3, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Cooperative(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.execute('PRAGMA foreign_keys=ON')
  for suffix in ['b_tables_core','c_tables_billing','d_tables_loket','e_tables_payout','f_tables_support','g_triggers','h_seed']:
   self.db.executescript((ROOT/f'migrations-finance/0001{suffix}.sql').read_text(encoding='utf-8'))
  self.db.executescript((ROOT/'migrations-finance/0003_payroll_per_sesi.sql').read_text(encoding='utf-8'))
  self.db.executescript((ROOT/'migrations-finance/0004_cooperative_item_payments.sql').read_text(encoding='utf-8'))
  self.db.executescript((ROOT/'migrations-finance/0006_central_billing_workspaces.sql').read_text(encoding='utf-8'))
  self.db.execute("INSERT INTO finance_coop_bills(id,santri_id,kind,title,recipient_id,amount,created_by) VALUES('b1','s1','SPP','SPP','pesantren',100000,'staff')")
  self.db.execute("INSERT INTO finance_cash_units(id,name) VALUES('u','Loket')")
  self.db.execute("INSERT INTO finance_cash_shifts(id,cash_unit_id,operator_id,terminal_id,opening_cash_rupiah) VALUES('sh','u','staff','t',0)")
  self.db.commit()
 def order(self,id='o1',amount=100000,policy='FULL',student='s1'):
  self.db.execute("INSERT INTO finance_orders(id,request_key,santri_id,actor_id,channel,amount,fee,total,expires_at,shift_id) VALUES(?,?,?,'staff','CASH',?,0,?,'2099-01-01','sh')",(id,id,student,amount,amount))
  self.db.execute("INSERT INTO finance_order_items(id,order_id,bill_id,kind,title,recipient_id,amount,policy) VALUES(?,?,'b1','SPP','SPP','pesantren',?,?)",('i'+id,id,amount,policy))
 def pay(self,id='o1',amount=100000):
  j='j'+id
  self.db.execute("INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,actor_type) VALUES(?,?,'2026-09-17','Payment','COOP_RECEIPT','STAFF')",(j,j))
  self.db.executemany("INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah) VALUES(?,?,?,?,?)",[(j+'a',j,'fa-unit-cash','DEBIT',amount),(j+'b',j,'fa-pesantren-payable','CREDIT',amount)])
  self.db.execute("INSERT INTO finance_cash_entries(id,shift_id,journal_id,amount) VALUES(?,'sh',?,?)",(j,j,amount))
  self.db.execute("UPDATE finance_journals SET status='POSTED' WHERE id=?",(j,))
  self.db.execute("UPDATE finance_orders SET status='PAID',journal_id=?,provider_reference=? WHERE id=?",(j,id,id))
 def distribution(self,id='d1',amount=100000):
  self.db.execute("INSERT INTO finance_distributions(id,request_key,recipient_id,gross,fee,fee_bearer,net,method,recipient_snapshot,actor_id) VALUES(?,?,'pesantren',?,0,'KOPERASI',?,'CASH','{}','staff')",(id,id,amount,amount))
  self.db.execute("INSERT INTO finance_distribution_items(distribution_id,entitlement_id,amount) VALUES(?,'ent-io1',?)",(id,amount))
 def test_full_payment_and_entitlement(self):
  with self.db:self.order();self.pay()
  self.assertEqual(self.db.execute("SELECT paid,status FROM finance_coop_bills").fetchone(),(100000,'PAID'))
  self.assertEqual(self.db.execute("SELECT amount,paid FROM finance_entitlements").fetchone(),(100000,0))
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM finance_student_wallets").fetchone()[0],0)
 def test_reject_partial_default(self):
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:self.order(amount=50000)
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM finance_orders").fetchone()[0],0)
 def test_configurable_installment(self):
  with self.db:self.order(amount=40000,policy='INSTALLMENT');self.pay(amount=40000)
  self.assertEqual(self.db.execute("SELECT paid,status FROM finance_coop_bills").fetchone(),(40000,'PARTIAL'))
  with self.db:self.order(id='o2',amount=60000,policy='INSTALLMENT');self.pay(id='o2',amount=60000)
  self.assertEqual(self.db.execute("SELECT paid,status FROM finance_coop_bills").fetchone(),(100000,'PAID'))
 def test_wrong_student(self):
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:self.order(student='s2')
 def test_one_active_order_across_channels(self):
  with self.db:self.order()
  with self.assertRaises(sqlite3.IntegrityError):
   self.db.execute("INSERT INTO finance_orders(id,request_key,santri_id,actor_id,channel,amount,fee,total,expires_at) VALUES('other','other','s1','staff','VA',100000,0,100000,'2099-01-01')")
 def test_replay_receipt(self):
  with self.db:self.order();self.pay()
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:self.pay()
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM finance_entitlements").fetchone()[0],1)
 def test_journal_imbalance_rolls_back(self):
  with self.db:self.order()
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:
    self.db.execute("INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,actor_type) VALUES('bad','bad','2026-09-17','Bad','COOP_RECEIPT','STAFF')")
    self.db.execute("UPDATE finance_journals SET status='POSTED' WHERE id='bad'")
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM finance_journals WHERE id='bad'").fetchone()[0],0)
 def test_no_transfer_more_than_entitlement(self):
  with self.db:self.order();self.pay()
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:self.distribution(amount=100001)
 def test_payout_draft_does_not_disburse(self):
  with self.db:self.order();self.pay();self.distribution()
  self.assertEqual(self.db.execute('SELECT paid FROM finance_entitlements').fetchone()[0],0)
 def test_one_active_qr_and_terminal_state(self):
  self.db.execute("INSERT INTO student_credentials(id,santri_id,token_hmac) VALUES('c','s1','h1')")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO student_credentials(id,santri_id,token_hmac) VALUES('c2','s1','h2')")
  self.db.execute("UPDATE student_credentials SET status='LOST' WHERE id='c'")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("UPDATE student_credentials SET status='ACTIVE' WHERE id='c'")
 def test_cash_cannot_go_negative(self):
  with self.db:self.order();self.pay()
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO finance_cash_entries(id,shift_id,journal_id,amount) VALUES('bad','sh','jo1',-100001)")
 def test_audit_immutable(self):
  self.db.execute("INSERT INTO finance_audit_log(id,actor_type,action,entity_type) VALUES('a','STAFF','PAY','ORDER')")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("DELETE FROM finance_audit_log")
 def test_main_database_binding_unchanged(self):
  config=(ROOT/'wrangler.jsonc').read_text()
  self.assertIn('"database_name": "eskahade-finance"',config)
  self.assertIn('8388b81f-c5c7-4523-9a72-437f947331a1',config)
if __name__=='__main__':unittest.main(verbosity=2)
