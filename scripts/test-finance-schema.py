import sqlite3, io, os

os.remove('tmp/test.db') if os.path.exists('tmp/test.db') else None
c = sqlite3.connect('tmp/test.db')
for f in ['0001a_drop_legacy', '0001b_tables_core', '0001c_tables_billing', '0001d_tables_loket',
          '0001e_tables_payout', '0001f_tables_support', '0001g_triggers', '0001h_seed', '0003_payroll_per_sesi']:
    c.executescript(io.open('migrations-finance/%s.sql' % f, encoding='utf-8').read())
c.commit()
ok, fail = [], []


def check(name, cond):
    (ok if cond else fail).append(name)


def journal(jid, entries, wallet=None, source='MANUAL', src_id=None):
    c.execute("INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,source_id,actor_type,status)"
              " VALUES(?,?,date('now'),?,?,?,'STAFF','DRAFT')", (jid, jid, 'uji ' + jid, source, src_id))
    for i, (acc, side, amt) in enumerate(entries):
        c.execute("INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah,santri_id)"
                  " VALUES(?,?,?,?,?,?)", (jid + str(i), jid, acc, side, amt, 'S1'))
    for i, (kind, amt) in enumerate(wallet or []):
        c.execute("INSERT INTO finance_wallet_movements(id,idempotency_key,journal_id,santri_id,wallet_kind,"
                  "amount_rupiah,movement_type,reference_type,reference_id) VALUES(?,?,?,'S1',?,?,'T','T',?)",
                  (jid + 'w' + str(i), jid + 'w' + str(i), jid, kind, amt, jid))
    c.execute("UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'", (jid,))


def saldo(kind):
    r = c.execute("SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id='S1' AND wallet_kind=?", (kind,)).fetchone()
    return r[0] if r else 0


# --- T1a: top-up seimbang masuk ke dompet ---
journal('j1', [('fa-gateway-clearing', 'DEBIT', 500000), ('fa-guardian-float', 'CREDIT', 500000)],
        [('TITIPAN', 500000)])
c.commit()
check('T1a top-up 500.000 masuk TITIPAN', saldo('TITIPAN') == 500000)
bb, ba = c.execute("SELECT balance_before,balance_after FROM finance_wallet_movements WHERE journal_id='j1'").fetchone()
check('T1a balance_before/after terisi benar (0 -> 500.000)', bb == 0 and ba == 500000)

# --- T1b: alokasi TITIPAN -> SPP ---
journal('j2', [('fa-guardian-float', 'DEBIT', 300000), ('fa-spp-revenue', 'CREDIT', 300000)],
        [('TITIPAN', -300000), ('SPP', 300000)])
c.commit()
check('T1b alokasi: TITIPAN 200.000', saldo('TITIPAN') == 200000)
check('T1b alokasi: SPP 300.000', saldo('SPP') == 300000)

# --- T2: jurnal tidak seimbang ditolak ---
try:
    journal('j3', [('fa-gateway-clearing', 'DEBIT', 100), ('fa-guardian-float', 'CREDIT', 99)])
    c.commit(); check('T2 jurnal tidak seimbang ditolak', False)
except sqlite3.IntegrityError as e:
    c.rollback(); check('T2 jurnal tidak seimbang ditolak', 'UNBALANCED' in str(e))

# --- T2b: jurnal satu baris ditolak ---
try:
    journal('j4', [('fa-gateway-clearing', 'DEBIT', 100)])
    c.commit(); check('T2b jurnal satu baris ditolak', False)
except sqlite3.IntegrityError as e:
    c.rollback(); check('T2b jurnal satu baris ditolak', 'MINIMUM_TWO_ENTRIES' in str(e))

# --- T4: dompet tidak boleh negatif ---
try:
    journal('j5', [('fa-guardian-float', 'DEBIT', 999000), ('fa-spp-revenue', 'CREDIT', 999000)],
            [('TITIPAN', -999000)])
    c.commit(); check('T4 saldo negatif ditolak', False)
except sqlite3.IntegrityError as e:
    c.rollback(); check('T4 saldo negatif ditolak', 'INSUFFICIENT' in str(e))
check('T4 saldo utuh setelah penolakan (200.000)', saldo('TITIPAN') == 200000)

# --- T2c: jurnal POSTED immutable ---
try:
    c.execute("UPDATE finance_journals SET description='diubah' WHERE id='j1'"); c.commit()
    check('T2c jurnal POSTED tidak bisa diubah', False)
except sqlite3.IntegrityError as e:
    c.rollback(); check('T2c jurnal POSTED tidak bisa diubah', 'IMMUTABLE' in str(e))

# --- T2d: neraca global seimbang ---
row = c.execute("""SELECT
  COALESCE(SUM(CASE WHEN a.account_type IN ('ASSET','EXPENSE') THEN b.balance_rupiah ELSE 0 END),0),
  COALESCE(SUM(CASE WHEN a.account_type IN ('LIABILITY','EQUITY','REVENUE') THEN b.balance_rupiah ELSE 0 END),0)
  FROM finance_account_balances b JOIN finance_accounts a ON a.id=b.account_id""").fetchone()
check('T2d neraca seimbang (aset+beban == utang+modal+pendapatan): %d vs %d' % row, row[0] == row[1])

# --- T12: periode tertutup menolak posting ---
c.execute("INSERT INTO finance_periods(period_key,status) SELECT strftime('%Y-%m','now'),'CLOSED'")
c.commit()
try:
    journal('j6', [('fa-gateway-clearing', 'DEBIT', 1000), ('fa-guardian-float', 'CREDIT', 1000)])
    c.commit(); check('T12 periode tertutup menolak posting', False)
except sqlite3.IntegrityError as e:
    c.rollback(); check('T12 periode tertutup menolak posting', 'PERIOD_CLOSED' in str(e))

print('LULUS %d, GAGAL %d\n' % (len(ok), len(fail)))
for x in ok:
    print('  OK   ', x)
for x in fail:
    print('  GAGAL', x)
raise SystemExit(1 if fail else 0)
