"""T8 - pencairan maker-checker, diuji terhadap trigger skema sungguhan."""
import sqlite3, io, os

if os.path.exists('tmp/t8.db'):
    os.remove('tmp/t8.db')
c = sqlite3.connect('tmp/t8.db')
for f in ['0001a_drop_legacy', '0001b_tables_core', '0001c_tables_billing', '0001d_tables_loket',
          '0001e_tables_payout', '0001f_tables_support', '0001g_triggers', '0001h_seed']:
    c.executescript(io.open('migrations-finance/%s.sql' % f, encoding='utf-8').read())
c.commit()
ok, fail = [], []


def check(name, cond):
    (ok if cond else fail).append(name)


def status():
    return c.execute("SELECT status FROM finance_payouts WHERE id='po1'").fetchone()[0]


# rekening penerima: didaftarkan A, diverifikasi B
c.execute("""INSERT INTO finance_recipients(id,recipient_type,name,bank_code,account_number_masked,status,created_by)
             VALUES('r1','MEAL_MANAGER','Dapur Pusat','014','******7890','PENDING_VERIFICATION','A')""")
c.execute("""INSERT INTO finance_payouts(id,idempotency_key,recipient_id,payout_type,amount_rupiah,method,status,maker_id)
             VALUES('po1','k1','r1','MEAL',5000000,'MANUAL_TRANSFER','DIAJUKAN','A')""")
c.commit()

# a. rekening belum diverifikasi -> tidak boleh disetujui
try:
    c.execute("UPDATE finance_payouts SET status='DISETUJUI',checker_id='B' WHERE id='po1'")
    c.commit(); check('a. rekening belum diverifikasi ditolak', False)
except sqlite3.IntegrityError as e:
    c.rollback(); check('a. rekening belum diverifikasi ditolak', 'RECIPIENT_NOT_ACTIVE' in str(e))

c.execute("UPDATE finance_recipients SET status='ACTIVE',verified_by='B' WHERE id='r1'")
c.commit()

# b. maker menyetujui dirinya sendiri -> ditolak
try:
    c.execute("UPDATE finance_payouts SET status='DISETUJUI',checker_id='A' WHERE id='po1'")
    c.commit(); check('b. self-approval ditolak', False)
except sqlite3.IntegrityError as e:
    c.rollback(); check('b. self-approval ditolak', 'SELF_APPROVAL_FORBIDDEN' in str(e))

# c. checker kosong -> ditolak
try:
    c.execute("UPDATE finance_payouts SET status='DISETUJUI' WHERE id='po1'")
    c.commit(); check('c. persetujuan tanpa checker ditolak', False)
except sqlite3.IntegrityError as e:
    c.rollback(); check('c. persetujuan tanpa checker ditolak', 'CHECKER_REQUIRED' in str(e))

# d. checker B menyetujui -> DISETUJUI
c.execute("UPDATE finance_payouts SET status='DISETUJUI',checker_id='B',checked_at=datetime('now') WHERE id='po1' AND status='DIAJUKAN'")
c.commit()
check('d. checker berbeda dapat menyetujui', status() == 'DISETUJUI')

# e. checker yang sama membayar -> DIBAYAR, satu jurnal seimbang (debit 2102, kredit 1101)
c.execute("""INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,source_id,actor_type,status)
             VALUES('j1','payout:k1',date('now'),'Pencairan MEAL','PAYOUT','po1','STAFF','DRAFT')""")
c.execute("""INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah)
             VALUES('e1','j1','fa-meal-payable','DEBIT',5000000)""")
c.execute("""INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah)
             VALUES('e2','j1','fa-main-bank','CREDIT',5000000)""")
# Kedua akun harus punya saldo dulu: bank berisi uang, dan utang ke pengelola
# makan memang sudah pernah diakui lewat alokasi santri. Tanpa itu trigger
# menolak dengan FINANCE_ACCOUNT_NEGATIVE - dan itu benar: sistem tidak boleh
# membayar utang yang tidak pernah tercatat.
c.execute("INSERT INTO finance_account_balances(account_id,balance_rupiah) VALUES('fa-main-bank',9000000)")
c.execute("INSERT INTO finance_account_balances(account_id,balance_rupiah) VALUES('fa-meal-payable',5000000)")
c.execute("UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id='j1'")
c.execute("UPDATE finance_payouts SET status='DIBAYAR',journal_id='j1',paid_at=datetime('now') WHERE id='po1' AND status='DISETUJUI'")
c.commit()
check('e. pembayaran menghasilkan tepat satu jurnal', status() == 'DIBAYAR'
      and c.execute("SELECT COUNT(*) FROM finance_journals WHERE source_id='po1'").fetchone()[0] == 1)

d, k = c.execute("""SELECT SUM(CASE WHEN side='DEBIT' THEN amount_rupiah ELSE 0 END),
                           SUM(CASE WHEN side='CREDIT' THEN amount_rupiah ELSE 0 END)
                    FROM finance_journal_entries WHERE journal_id='j1'""").fetchone()
check('e. jurnal pencairan seimbang (%s = %s)' % (f'{d:,}', f'{k:,}'), d == k == 5000000)

# f. idempotensi - kunci jurnal yang sama tidak bisa dipakai dua kali
try:
    c.execute("""INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,source_id,actor_type,status)
                 VALUES('j2','payout:k1',date('now'),'ulang','PAYOUT','po1','STAFF','DRAFT')""")
    c.commit(); check('f. pembayaran ulang ditolak idempotency', False)
except sqlite3.IntegrityError:
    c.rollback(); check('f. pembayaran ulang ditolak idempotency', True)

check('g. tidak ada kolom executor_id di skema',
      'executor_id' not in [r[1] for r in c.execute("PRAGMA table_info(finance_payouts)")])

check('h. tidak ada kolom usable_after (cooling period) di skema',
      'usable_after' not in [r[1] for r in c.execute("PRAGMA table_info(finance_recipients)")])

print('LULUS %d, GAGAL %d\n' % (len(ok), len(fail)))
for x in ok:
    print('  OK   ', x)
for x in fail:
    print('  GAGAL', x)
raise SystemExit(1 if fail else 0)
