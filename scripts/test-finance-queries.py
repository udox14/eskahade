"""Menjalankan setiap query SQL yang menyentuh tabel finance_ terhadap skema baru.

Kesalahan nama kolom di string SQL tidak tertangkap TypeScript maupun build. Yang
menangkapnya hanya menjalankan query itu sungguhan. Uji ini menyaring seluruh
berkas TypeScript, mengambil setiap SQL yang menyebut tabel finance_, lalu
menyiapkannya (PREPARE) di atas skema hasil migrasi. Query yang menyebut tabel
atau kolom yang sudah tidak ada akan gagal di sini.

Cakupannya SELURUH repo, bukan hanya lib/finance dan app/dashboard/keuangan-
terpusat. Halaman slip gaji guru sempat lolos berhari-hari justru karena berada
di luar dua folder itu.
"""
import sqlite3, io, os, re, glob

if os.path.exists('tmp/q.db'):
    os.remove('tmp/q.db')
c = sqlite3.connect('tmp/q.db')
for f in ['0001a_drop_legacy', '0001b_tables_core', '0001c_tables_billing', '0001d_tables_loket',
          '0001e_tables_payout', '0001f_tables_support', '0001g_triggers', '0001h_seed',
          '0002_demo_sandbox_reset', '0003_payroll_per_sesi']:
    c.executescript(io.open('migrations-finance/%s.sql' % f, encoding='utf-8').read())
c.commit()

# Tabel milik DB aplikasi utama, bukan DB keuangan. Query yang menyebutnya
# memang tidak bisa disiapkan di sini - dilewati, bukan dianggap gagal.
DB_UTAMA = re.compile(
    r'\b(santri|users|data_guru|app_settings|spp_log|portal_payment_submission|kamar|asrama|'
    r'pembayaran_tahunan|finance_transaction|finance_category|biaya_settings|spp_settings)\b', re.I)

berkas = []
for pola in ['app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts', 'workers/**/*.ts']:
    berkas += glob.glob(pola, recursive=True)

diperiksa, dilewati, gagal = 0, 0, []
for path in sorted(set(berkas)):
    src = io.open(path, encoding='utf-8').read()
    if 'finance_' not in src:
        continue
    for raw in re.findall(r'`([^`]+)`', src):
        sql = raw.strip()
        if not re.match(r'^(SELECT|INSERT|UPDATE|DELETE)\b', sql, re.I):
            continue
        if not re.search(r'\bfinance_[a-z_]+|\bstudent_credentials\b', sql):
            continue
        if DB_UTAMA.search(sql):
            dilewati += 1
            continue
        # ${...} adalah potongan dinamis (filter scope, daftar placeholder).
        # Diganti sesuatu yang netral supaya query tetap sah secara sintaks.
        # Dibuang berulang supaya interpolasi bersarang ikut terangkat, lalu
        # sisa daftar placeholder kosong diisi satu tanda tanya.
        bersih = sql
        for _ in range(6):
            baru = re.sub(r'\$\{[^{}]*\}', ' ', bersih)
            if baru == bersih:
                break
            bersih = baru
        bersih = re.sub(r'\bIN \(\s*\)', 'IN (?)', bersih)
        bersih = re.sub(r',\s*\)', ')', bersih)
        bersih = re.sub(r'\(\s*,', '(', bersih)
        if '${' in bersih:
            dilewati += 1
            continue
        diperiksa += 1
        # Jumlah parameter dicocokkan supaya kegagalan yang tersisa benar-benar
        # soal skema, bukan sekadar binding yang tidak seimbang.
        try:
            c.execute('EXPLAIN ' + bersih, tuple([None] * bersih.count('?')))
        except sqlite3.Error as e:
            pesan = str(e)
            if 'no such column' in pesan or 'no such table' in pesan:
                gagal.append((path, pesan, bersih[:150].replace('\n', ' ')))
            else:
                # Sisa kegagalan adalah sintaks yang pecah akibat interpolasi
                # dibuang, bukan masalah skema.
                dilewati += 1
                diperiksa -= 1

print('LULUS %d, GAGAL %d' % (diperiksa - len(gagal), len(gagal)))
print('Query diperiksa : %d' % diperiksa)
print('Dilewati        : %d (query DB utama, interpolasi dinamis, atau sintaks pecah)' % dilewati)
print('GAGAL           : %d\n' % len(gagal))
for path, pesan, sql in gagal:
    print('  GAGAL %s' % path)
    print('        %s' % pesan)
    print('        %s...' % sql)
raise SystemExit(1 if gagal else 0)
