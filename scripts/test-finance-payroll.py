"""T9 - potongan gaji alfa/badal, diuji langsung terhadap skema baru."""
import sqlite3, io, os

if os.path.exists('tmp/t9.db'):
    os.remove('tmp/t9.db')
c = sqlite3.connect('tmp/t9.db')
for f in ['0001a_drop_legacy', '0001b_tables_core', '0001c_tables_billing', '0001d_tables_loket',
          '0001e_tables_payout', '0001f_tables_support', '0001g_triggers', '0001h_seed']:
    c.executescript(io.open('migrations-finance/%s.sql' % f, encoding='utf-8').read())
c.commit()

GAJI, ALFA_TARIF, BADAL_TARIF = 2_000_000, 50_000, 25_000


def hitung(gaji, alfa_days, badal_days, alfa_tarif, badal_tarif):
    """Cermin dari hitungPotongan() di lib/finance/payroll.ts."""
    potongan = alfa_days * alfa_tarif + badal_days * badal_tarif
    return potongan, max(0, gaji - potongan)


KASUS = [
    ('a. hadir penuh',                 0,  0, ALFA_TARIF, BADAL_TARIF,       0, 2_000_000),
    ('b. 3 hari alfa',                 3,  0, ALFA_TARIF, BADAL_TARIF, 150_000, 1_850_000),
    ('c. 2 badal',                     0,  2, ALFA_TARIF, BADAL_TARIF,  50_000, 1_950_000),
    ('d. 3 alfa + 2 badal',            3,  2, ALFA_TARIF, BADAL_TARIF, 200_000, 1_800_000),
    ('e. dibayar penuh (tarif 0)',     5,  5,          0,           0,       0, 2_000_000),
    ('f. potongan melebihi gaji',     50,  0, ALFA_TARIF, BADAL_TARIF, 2_500_000,       0),
]

ok, fail = [], []
c.execute("INSERT INTO finance_payroll_periods(id,period_key,status) VALUES('p1','2026-08','DIHITUNG')")

for i, (nama, alfa, badal, ta, tb, potongan_harap, bersih_harap) in enumerate(KASUS):
    potongan, bersih = hitung(GAJI, alfa, badal, ta, tb)
    cocok = potongan == potongan_harap and bersih == bersih_harap
    (ok if cocok else fail).append(
        '%-30s alfa=%2d badal=%2d -> potongan %9s bersih %9s' % (nama, alfa, badal, f'{potongan:,}', f'{bersih:,}'))
    # simpan ke DB agar CHECK net_rupiah>=0 dan deduction>=0 ikut teruji
    c.execute("""INSERT INTO finance_payroll_items
        (id,payroll_period_id,teacher_id,monthly_salary_rupiah,alfa_days,badal_days,deduction_rupiah,net_rupiah)
        VALUES(?,?,?,?,?,?,?,?)""", ('i%d' % i, 'p1', 'g%d' % i, GAJI, alfa, badal, potongan, bersih))
c.commit()

# guru dengan bersih 0 tidak boleh menghasilkan jurnal
nol = c.execute("SELECT COUNT(*) FROM finance_payroll_items WHERE net_rupiah=0").fetchone()[0]
(ok if nol == 1 else fail).append('guru dengan gaji bersih nol: %d (harap 1, tidak menghasilkan jurnal)' % nol)

total = c.execute("SELECT SUM(net_rupiah) FROM finance_payroll_items WHERE net_rupiah>0").fetchone()[0]
harap = 2_000_000 + 1_850_000 + 1_950_000 + 1_800_000 + 2_000_000
(ok if total == harap else fail).append('total kredit 2104 harus %s, dapat %s' % (f'{harap:,}', f'{total:,}'))

# net negatif harus ditolak skema
try:
    c.execute("""INSERT INTO finance_payroll_items
        (id,payroll_period_id,teacher_id,monthly_salary_rupiah,alfa_days,badal_days,deduction_rupiah,net_rupiah)
        VALUES('bad','p1','gx',100,0,0,0,-1)""")
    c.commit(); fail.append('net_rupiah negatif TIDAK ditolak skema')
except sqlite3.IntegrityError:
    c.rollback(); ok.append('net_rupiah negatif ditolak skema')

print('LULUS %d, GAGAL %d\n' % (len(ok), len(fail)))
for x in ok:
    print('  OK   ', x)
for x in fail:
    print('  GAGAL', x)
raise SystemExit(1 if fail else 0)
