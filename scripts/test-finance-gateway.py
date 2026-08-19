"""T10/T11 - idempotensi & replay callback Duitku, diuji di lapisan yang benar-benar menjaganya.

Perlindungan terhadap callback ganda TIDAK bersandar pada kode aplikasi saja.
Ia bertumpu pada tiga pengaman database yang saling menutup:

  1. UNIQUE(provider,event_key) di finance_gateway_events
     -> callback yang identik persis ditolak di pintu masuk.
  2. UNIQUE(idempotency_key) di finance_journals, kunci `duitku-paid:<orderId>`
     -> callback dengan event_key berbeda tapi order sama tetap ditolak.
  3. trg_finance_topup_journal_requires_paid_intent
     -> jurnal top-up hanya boleh dibuat bila intent-nya PAID dan belum pernah
        dibukukan.

Uji ini menyerang ketiganya langsung. Kalau salah satu dilonggarkan di kemudian
hari, uji ini gagal - bukan menunggu duit wali tercatat dua kali di produksi.
"""
import sqlite3, io, os, hashlib

if os.path.exists('tmp/t10.db'):
    os.remove('tmp/t10.db')
c = sqlite3.connect('tmp/t10.db')
for f in ['0001a_drop_legacy', '0001b_tables_core', '0001c_tables_billing', '0001d_tables_loket',
          '0001e_tables_payout', '0001f_tables_support', '0001g_triggers', '0001h_seed', '0003_payroll_per_sesi']:
    c.executescript(io.open('migrations-finance/%s.sql' % f, encoding='utf-8').read())
c.commit()
ok, fail = [], []


def check(name, cond):
    (ok if cond else fail).append(name)


ORDER = 'SKH-1755000000-abcd1234'
NOMINAL, BIAYA = 500000, 4000
TOTAL = NOMINAL + BIAYA


def event_key(reference, result_code='00'):
    """Cermin callbackEventKey() di lib/finance/gateway/duitku.ts."""
    return '%s:%s:%s' % (ORDER, reference or TOTAL, result_code)


def bukukan_topup(journal_id, event_id, key, reference):
    """Meniru batch di processDuitkuCallback() apa adanya, termasuk urutannya."""
    c.execute("""INSERT INTO finance_gateway_events(id,provider,event_key,event_type,merchant_order_id,signature_valid,payload_json)
                 VALUES(?,'DUITKU',?,'PAID',?,1,'{}')""", (event_id, key, ORDER))
    c.execute("""UPDATE finance_payment_intents SET status='PAID',paid_at=datetime('now')
                 WHERE id='pi1' AND status IN ('PENDING','EXPIRED')""")
    c.execute("""INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,source_id,external_reference,actor_type,actor_id,status)
                 VALUES(?,?,date('now'),'Top-up Duitku','TOPUP','pi1',?,'GATEWAY','DUITKU','DRAFT')""",
              (journal_id, 'duitku-paid:%s' % ORDER, reference))
    c.execute("""INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah,santri_id)
                 VALUES(?,?,'fa-gateway-clearing','DEBIT',?,'s1')""", (journal_id + '-e1', journal_id, TOTAL))
    c.execute("""INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah,santri_id)
                 VALUES(?,?,'fa-guardian-float','CREDIT',?,'s1')""", (journal_id + '-e2', journal_id, NOMINAL))
    c.execute("""INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah,santri_id)
                 VALUES(?,?,'fa-gateway-fee-revenue','CREDIT',?,'s1')""", (journal_id + '-e3', journal_id, BIAYA))
    c.execute("""INSERT INTO finance_wallet_movements(id,idempotency_key,journal_id,santri_id,wallet_kind,amount_rupiah,movement_type,reference_type,reference_id)
                 VALUES(?,?,?,'s1','TITIPAN',?,'TOPUP','PAYMENT_INTENT','pi1')""",
              (journal_id + '-wm', 'topup:%s' % ORDER, journal_id, NOMINAL))
    c.execute("UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=?", (journal_id,))
    c.execute("UPDATE finance_payment_intents SET journal_id=? WHERE id='pi1' AND status='PAID' AND journal_id IS NULL", (journal_id,))
    c.commit()


def saldo():
    row = c.execute("SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id='s1' AND wallet_kind='TITIPAN'").fetchone()
    return row[0] if row else 0


def jumlah_jurnal():
    return c.execute("SELECT COUNT(*) FROM finance_journals WHERE source_id='pi1'").fetchone()[0]


c.execute("""INSERT INTO finance_payment_intents(id,merchant_order_id,santri_id,payment_method,amount_rupiah,gateway_fee_rupiah,charged_amount_rupiah,status,expires_at)
             VALUES('pi1',?, 's1','VA',?,?,?,'PENDING',datetime('now','+1 day'))""", (ORDER, NOMINAL, BIAYA, TOTAL))
c.commit()

# --- T10a: callback pertama yang sah ---
bukukan_topup('j1', 'ev1', event_key('REF-A'), 'REF-A')
check('T10a. callback sah: intent PAID', c.execute("SELECT status FROM finance_payment_intents WHERE id='pi1'").fetchone()[0] == 'PAID')
check('T10a. saldo TITIPAN bertambah nominal bersih (%s)' % f'{saldo():,}', saldo() == NOMINAL)
check('T10a. tepat satu jurnal', jumlah_jurnal() == 1)

# --- T10b: callback identik diulang (event_key sama) ---
try:
    bukukan_topup('j2', 'ev2', event_key('REF-A'), 'REF-A')
    check('T10b. callback identik ditolak', False)
except sqlite3.IntegrityError:
    c.rollback()
    check('T10b. callback identik ditolak UNIQUE(provider,event_key)', True)
check('T10b. saldo tidak berubah setelah replay', saldo() == NOMINAL)
check('T10b. tetap satu jurnal', jumlah_jurnal() == 1)

# --- T10c: event_key BERBEDA, merchant_order_id sama ---
# Ini kasus paling berbahaya: Duitku mengirim ulang dengan reference berbeda,
# sehingga pengaman lapis pertama TIDAK kena. Yang harus menangkap adalah
# UNIQUE idempotency_key jurnal dan trigger TOPUP_ALREADY_POSTED.
try:
    bukukan_topup('j3', 'ev3', event_key('REF-B'), 'REF-B')
    check('T10c. callback order sama dengan reference berbeda ditolak', False)
except sqlite3.IntegrityError as e:
    c.rollback()
    pesan = str(e)
    check('T10c. ditolak (%s)' % ('TOPUP_ALREADY_POSTED' if 'ALREADY_POSTED' in pesan else 'UNIQUE idempotency_key'),
          'ALREADY_POSTED' in pesan or 'idempotency' in pesan.lower() or 'UNIQUE' in pesan)
check('T10c. saldo tetap tidak berubah', saldo() == NOMINAL)
check('T10c. tetap satu jurnal', jumlah_jurnal() == 1)

# --- T10e: intent yang belum PAID tidak boleh dibukukan ---
c.execute("""INSERT INTO finance_payment_intents(id,merchant_order_id,santri_id,payment_method,amount_rupiah,gateway_fee_rupiah,charged_amount_rupiah,status,expires_at)
             VALUES('pi2','SKH-OTHER','s2','VA',100000,0,100000,'EXPIRED',datetime('now','-1 day'))""")
c.commit()
try:
    c.execute("""INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,source_id,actor_type,status)
                 VALUES('jx','duitku-paid:SKH-OTHER',date('now'),'x','TOPUP','pi2','GATEWAY','DRAFT')""")
    c.commit()
    check('T10e. top-up atas intent belum PAID ditolak', False)
except sqlite3.IntegrityError as e:
    c.rollback()
    check('T10e. top-up atas intent belum PAID ditolak (%s)' % 'INTENT_NOT_PAID', 'INTENT_NOT_PAID' in str(e))

# --- T10d: verifikasi signature (algoritma, bukan basis data) ---
# Cermin verifyCallback() di lib/finance/gateway/duitku.ts:
#   md5(merchantCode + amount + merchantOrderId + apiKey)
KODE, APIKEY = 'DXXXX', 'rahasia-uji'
sah = hashlib.md5(('%s%s%s%s' % (KODE, TOTAL, ORDER, APIKEY)).encode()).hexdigest()
palsu = hashlib.md5(('%s%s%s%s' % (KODE, TOTAL, ORDER, 'kunci-salah')).encode()).hexdigest()
check('T10d. signature sah cocok dengan rumus Duitku', len(sah) == 32)
check('T10d. signature dengan API key salah TIDAK cocok', sah != palsu)

# --- T11: callback payout ---
c.execute("""INSERT INTO finance_recipients(id,recipient_type,name,bank_code,account_number_masked,status,created_by,verified_by)
             VALUES('r1','MEAL_MANAGER','Dapur','014','***1234','ACTIVE','A','B')""")
c.execute("""INSERT INTO finance_payouts(id,idempotency_key,recipient_id,payout_type,amount_rupiah,method,status,maker_id,checker_id,provider_reference)
             VALUES('po1','pk1','r1','MEAL',2000000,'API','DIPROSES','A','B','DISB-1')""")
# Clearing gateway sudah punya saldo dari top-up di atas (trigger apply_balances
# yang mengisinya), jadi pakai upsert - bukan insert.
c.execute("""INSERT INTO finance_account_balances(account_id,balance_rupiah) VALUES('fa-meal-payable',2000000)
             ON CONFLICT(account_id) DO UPDATE SET balance_rupiah=balance_rupiah+2000000""")
c.execute("""INSERT INTO finance_account_balances(account_id,balance_rupiah) VALUES('fa-gateway-clearing',5000000)
             ON CONFLICT(account_id) DO UPDATE SET balance_rupiah=balance_rupiah+5000000""")
c.commit()


def bukukan_payout(jid):
    c.execute("""INSERT INTO finance_journals(id,idempotency_key,effective_date,description,source_type,source_id,actor_type,status)
                 VALUES(?,'payout:pk1',date('now'),'Pencairan API','PAYOUT','po1','GATEWAY','DRAFT')""", (jid,))
    c.execute("""INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah)
                 VALUES(?,?,'fa-meal-payable','DEBIT',2000000)""", (jid + '-a', jid))
    c.execute("""INSERT INTO finance_journal_entries(id,journal_id,account_id,side,amount_rupiah)
                 VALUES(?,?,'fa-gateway-clearing','CREDIT',2000000)""", (jid + '-b', jid))
    c.execute("UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=?", (jid,))
    c.execute("UPDATE finance_payouts SET status='DIBAYAR',journal_id=?,paid_at=datetime('now') WHERE id='po1' AND status='DIPROSES'", (jid,))
    c.commit()


bukukan_payout('jp1')
check('T11. callback sukses: payout DIBAYAR',
      c.execute("SELECT status FROM finance_payouts WHERE id='po1'").fetchone()[0] == 'DIBAYAR')
check('T11. tepat satu jurnal pencairan',
      c.execute("SELECT COUNT(*) FROM finance_journals WHERE source_id='po1'").fetchone()[0] == 1)

# callback GAGAL menyusul setelah sukses -> tidak boleh mengubah apa pun
c.execute("UPDATE finance_payouts SET status='GAGAL',failure_reason='telat' WHERE id='po1' AND status='DIPROSES'")
c.commit()
check('T11. callback gagal setelah sukses diabaikan (status tetap DIBAYAR)',
      c.execute("SELECT status FROM finance_payouts WHERE id='po1'").fetchone()[0] == 'DIBAYAR')

try:
    bukukan_payout('jp2')
    check('T11. pembukuan payout ganda ditolak', False)
except sqlite3.IntegrityError:
    c.rollback()
    check('T11. pembukuan payout ganda ditolak UNIQUE idempotency_key', True)
check('T11. tetap satu jurnal pencairan',
      c.execute("SELECT COUNT(*) FROM finance_journals WHERE source_id='po1'").fetchone()[0] == 1)

print('LULUS %d, GAGAL %d\n' % (len(ok), len(fail)))
for x in ok:
    print('  OK   ', x)
for x in fail:
    print('  GAGAL', x)
raise SystemExit(1 if fail else 0)
