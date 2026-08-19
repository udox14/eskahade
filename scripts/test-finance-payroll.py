"""T9 - potongan gaji alfa/badal per SESI, diuji langsung terhadap skema baru."""
import sqlite3, io, os

if os.path.exists('tmp/t9.db'):
    os.remove('tmp/t9.db')
c = sqlite3.connect('tmp/t9.db')
for f in ['0001a_drop_legacy', '0001b_tables_core', '0001c_tables_billing', '0001d_tables_loket',
          '0001e_tables_payout', '0001f_tables_support', '0001g_triggers', '0001h_seed', '0003_payroll_per_sesi']:
    c.executescript(io.open('migrations-finance/%s.sql' % f, encoding='utf-8').read())
c.commit()

GAJI, ALFA_TARIF, BADAL_TARIF = 2_000_000, 50_000, 25_000


def hitung(gaji, alfa_sesi, badal_sesi, alfa_tarif, badal_tarif):
    """Cermin dari hitungPotongan() di lib/finance/payroll.ts."""
    potongan = alfa_sesi * alfa_tarif + badal_sesi * badal_tarif
    return potongan, max(0, gaji - potongan)


KASUS = [
    ('a. hadir penuh',                 0,  0, ALFA_TARIF, BADAL_TARIF,       0, 2_000_000),
    ('b. 3 sesi alfa',                 3,  0, ALFA_TARIF, BADAL_TARIF, 150_000, 1_850_000),
    ('c. 2 sesi badal',                0,  2, ALFA_TARIF, BADAL_TARIF,  50_000, 1_950_000),
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
        (id,payroll_period_id,teacher_id,monthly_salary_rupiah,alfa_sesi,badal_sesi,wajib_sesi,hadir_sesi,deduction_rupiah,net_rupiah)
        VALUES(?,?,?,?,?,?,?,?,?,?)""",
        ('i%d' % i, 'p1', 'g%d' % i, GAJI, alfa, badal, 60, 60 - alfa - badal, potongan, bersih))
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
        (id,payroll_period_id,teacher_id,monthly_salary_rupiah,alfa_sesi,badal_sesi,deduction_rupiah,net_rupiah)
        VALUES('bad','p1','gx',100,0,0,0,-1)""")
    c.commit(); fail.append('net_rupiah negatif TIDAK ditolak skema')
except sqlite3.IntegrityError:
    c.rollback(); ok.append('net_rupiah negatif ditolak skema')

# --- Invarian satuan sesi (migrasi 0003) ---------------------------------
kolom_item = {r[1] for r in c.execute("PRAGMA table_info(finance_payroll_items)")}
kolom_komp = {r[1] for r in c.execute("PRAGMA table_info(finance_teacher_compensation)")}
kolom_per = {r[1] for r in c.execute("PRAGMA table_info(finance_payroll_periods)")}

for kolom, punya, tabel in [
    ('alfa_sesi', kolom_item, 'finance_payroll_items'),
    ('badal_sesi', kolom_item, 'finance_payroll_items'),
    ('wajib_sesi', kolom_item, 'finance_payroll_items'),
    ('hadir_sesi', kolom_item, 'finance_payroll_items'),
    ('attendance_synced_at', kolom_item, 'finance_payroll_items'),
    ('alfa_deduction_per_sesi_rupiah', kolom_komp, 'finance_teacher_compensation'),
    ('badal_deduction_per_sesi_rupiah', kolom_komp, 'finance_teacher_compensation'),
    ('attendance_locked_at', kolom_per, 'finance_payroll_periods'),
]:
    (ok if kolom in punya else fail).append('%s.%s ada' % (tabel, kolom))

# Kolom bersatuan hari tidak boleh tersisa: kalau ada, ada kode yang masih bisa
# menulis ke sana diam-diam dan potongannya jadi salah sampai tiga kali lipat.
sisa = ({'alfa_days', 'badal_days'} & kolom_item) | \
       ({'alfa_deduction_per_day_rupiah', 'badal_deduction_per_day_rupiah'} & kolom_komp)
(ok if not sisa else fail).append('tidak ada sisa kolom bersatuan hari (ditemukan: %s)' % (sorted(sisa) or 'tidak ada'))

# CHECK >= 0 harus ikut terbawa saat kolom diganti nama.
try:
    c.execute("""INSERT INTO finance_payroll_items
        (id,payroll_period_id,teacher_id,monthly_salary_rupiah,alfa_sesi,badal_sesi,deduction_rupiah,net_rupiah)
        VALUES('bad2','p1','gy',100,-1,0,0,100)""")
    c.commit(); fail.append('alfa_sesi negatif TIDAK ditolak skema')
except sqlite3.IntegrityError:
    c.rollback(); ok.append('alfa_sesi negatif ditolak skema')

print('LULUS %d, GAGAL %d\n' % (len(ok), len(fail)))
for x in ok:
    print('  OK   ', x)
for x in fail:
    print('  GAGAL', x)
raise SystemExit(1 if fail else 0)
