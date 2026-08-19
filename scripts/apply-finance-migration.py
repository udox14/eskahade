"""Menerapkan skema Keuangan Terpusat yang baru ke satu database D1.

    python scripts/apply-finance-migration.py eskahade-demo-finance
    python scripts/apply-finance-migration.py eskahade-finance

Kenapa skrip, bukan satu berkas SQL raksasa: pada 16 Agustus 2026 migrasi 0007
gagal separuh jalan di produksi dan menghilangkan tabel finance_bills. Skrip ini
menjalankan tiap berkas sebagai perintah --file terpisah dan BERHENTI di
kegagalan pertama, supaya tidak ada berkas berikutnya yang jalan di atas skema
yang sudah rusak sebagian.

Urutan berkas tidak boleh diacak: seluruh tabel dibuat lebih dulu, seluruh
trigger paling akhir. SQLite membuat trigger tanpa memvalidasi tabel yang hanya
disebut di dalam body-nya, jadi trigger yang dibuat terlalu awal akan
"menggantung" dan baru meledak belakangan.
"""
import subprocess, sys, shutil

BERKAS = [
    '0001a_drop_legacy',
    '0001b_tables_core',
    '0001c_tables_billing',
    '0001d_tables_loket',
    '0001e_tables_payout',
    '0001f_tables_support',
    '0001g_triggers',
    '0001h_seed',
]

if len(sys.argv) < 2:
    print('Pemakaian: python scripts/apply-finance-migration.py <nama-database-d1>')
    print('Contoh   : python scripts/apply-finance-migration.py eskahade-demo-finance')
    raise SystemExit(1)

DB = sys.argv[1]
NPX = shutil.which('npx') or 'npx'


def wrangler(args):
    # encoding/errors WAJIB diisi: wrangler mencetak karakter kotak (U+2500-an)
    # dan Python di Windows default ke cp1252, sehingga pembacaan output-nya
    # meledak dan pesan error aslinya hilang.
    return subprocess.run([NPX, 'wrangler', 'd1', 'execute', DB, '--remote'] + args,
                          capture_output=True, text=True, shell=False,
                          encoding='utf-8', errors='replace')


print('Menerapkan skema keuangan ke: %s' % DB)
print('Jumlah berkas: %d\n' % len(BERKAS))

for i, nama in enumerate(BERKAS, 1):
    print('[%d/%d] %-24s ... ' % (i, len(BERKAS), nama), end='', flush=True)
    hasil = wrangler(['--file', 'migrations-finance/%s.sql' % nama])
    if hasil.returncode == 0:
        print('OK')
        continue
    print('GAGAL\n')
    print('--- keluaran wrangler ---')
    print((hasil.stdout or '')[-2000:])
    print((hasil.stderr or '')[-2000:])
    print('\nBERHENTI. Jangan jalankan berkas berikutnya, jangan menambal manual.')
    print('Pulihkan dari berkas export lalu ulangi dari awal.')
    raise SystemExit(1)

print('\nVerifikasi struktur:')
# Filter nama TIDAK boleh dipakai untuk trigger: namanya diawali trg_, bukan
# finance_, jadi query lama selalu melaporkan 0 trigger secara diam-diam.
cek = wrangler(['--command',
                "SELECT (SELECT COUNT(*) FROM sqlite_master WHERE type='table' "
                "  AND (name LIKE 'finance_%' OR name='student_credentials')) tabel, "
                "(SELECT COUNT(*) FROM sqlite_master WHERE type='trigger') trigger_, "
                "(SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND sql IS NOT NULL) index_, "
                "(SELECT COUNT(*) FROM finance_accounts) akun;"])
print(cek.stdout or cek.stderr)
print('Yang harus terlihat: 37 tabel, 21 trigger, 24 index, 17 akun.')
print('Kalau angkanya meleset, JANGAN lanjut ke deploy - pulihkan dari export.')
