"""Memastikan setiap tabel & kolom yang disebut demo-seed.ts benar-benar ada di skema baru.

Kesalahan di demo-seed tidak tertangkap tsc (isinya string SQL) dan baru meledak
saat admin menekan Reset Data Demo. Uji ini menutup celah itu.
"""
import sqlite3, io, os, re

if os.path.exists('tmp/seed.db'):
    os.remove('tmp/seed.db')
c = sqlite3.connect('tmp/seed.db')
for f in ['0001a_drop_legacy', '0001b_tables_core', '0001c_tables_billing', '0001d_tables_loket',
          '0001e_tables_payout', '0001f_tables_support', '0001g_triggers', '0001h_seed', '0003_payroll_per_sesi',
          '0004_cooperative_item_payments', '0006_central_billing_workspaces']:
    c.executescript(io.open('migrations-finance/%s.sql' % f, encoding='utf-8').read())
c.commit()

skema = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
kolom = {t: {r[1] for r in c.execute('PRAGMA table_info(%s)' % t)} for t in skema}

src = io.open('lib/finance/demo-seed.ts', encoding='utf-8').read()
ok, fail = [], []

# finance_sandbox_state dibuat migrasi demo terpisah (0002), bukan 0001*
DILUAR_SKEMA_INTI = {'finance_sandbox_state'}

# Hanya nama tabel sungguhan. String 'finance_*' lain di berkas ini adalah KUNCI
# SETELAN (finance_meal_cutoff dsb.), bukan tabel - jadi pemindaian string bebas
# dipersempit ke blok RESET_TABLES saja.
tabel_disebut = set(re.findall(r"(?:INSERT INTO|UPDATE|DELETE FROM)\s+([a-z_]+)", src))
blok_reset = src[src.index('const RESET_TABLES = ['):src.index('] as const')]
tabel_disebut |= set(re.findall(r"'([a-z_]+)'", blok_reset))
hilang = sorted(t for t in tabel_disebut if t not in skema and t not in DILUAR_SKEMA_INTI)
(ok if not hilang else fail).append(
    'semua tabel yang disebut demo-seed ada di skema' if not hilang else 'tabel tidak ada: %s' % hilang)

# kolom pada tiap INSERT INTO tabel(kolom,...)
for tabel, daftar in re.findall(r"INSERT INTO\s+([a-z_]+)\s*\n?\s*\(([^)]+)\)", src):
    if tabel not in skema:
        continue
    diminta = {k.strip() for k in daftar.split(',') if k.strip()}
    tidakada = sorted(diminta - kolom[tabel])
    if tidakada:
        fail.append('%s: kolom tidak ada %s' % (tabel, tidakada))
    else:
        ok.append('%s: %d kolom cocok' % (tabel, len(diminta)))

# nilai enum yang dipakai seed harus lolos CHECK
for nilai, label in [
    ('student_credentials', 'inventaris kartu QR'),
    ('token_hmac', 'token QR berbasis HMAC'),
    ('token_encrypted', 'token QR terenkripsi'),
]:
    (ok if nilai in src else fail).append(
        '%s dipakai seed' % label if nilai in src else '%s TIDAK dipakai seed' % label)

for terlarang in ['RFID_UID', 'HYBRID', 'BOTH_TRANSITION', 'SUSPENDED_BY_POLICY',
                  'finance_outbox', 'finance_break_glass', 'finance_staff_mfa',
                  'finance_teaching_attendance', 'finance_payroll_policies',
                  'finance_bank_transactions', 'finance_staff_snapshots']:
    (ok if terlarang not in src else fail).append(
        'tidak ada lagi %s' % terlarang if terlarang not in src else 'MASIH menyebut %s' % terlarang)

print('LULUS %d, GAGAL %d\n' % (len(ok), len(fail)))
for x in ok:
    print('  OK   ', x)
for x in fail:
    print('  GAGAL', x)
raise SystemExit(1 if fail else 0)
