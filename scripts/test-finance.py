"""Menjalankan seluruh uji invarian Keuangan Terpusat.

Dipanggil lewat `npm run test:finance`. Tiap berkas membangun D1 lokal sendiri
dari migrations-finance/0001*, jadi tidak ada urutan yang saling bergantung dan
tidak ada state yang bocor antar uji.
"""
import subprocess, sys, os

UJI = [
    ('schema', 'T1-T7  skema, ledger seimbang, dompet, limit penarikan'),
    ('payroll', 'T9     potongan gaji alfa/badal'),
    ('payout', 'T8     pencairan maker-checker'),
    ('gateway', 'T10-11 idempotensi & replay callback Duitku'),
    ('demo-seed', '       demo-seed cocok dengan skema'),
]

os.makedirs('tmp', exist_ok=True)
gagal = []
for nama, keterangan in UJI:
    berkas = 'scripts/test-finance-%s.py' % nama
    hasil = subprocess.run([sys.executable, berkas], capture_output=True, text=True)
    baris = [b for b in hasil.stdout.splitlines() if b.startswith('LULUS')]
    ringkas = baris[0] if baris else 'tidak menghasilkan ringkasan'
    if hasil.returncode == 0:
        print('  OK    %-12s %s  -> %s' % (nama, keterangan, ringkas))
    else:
        gagal.append(nama)
        print('  GAGAL %-12s %s  -> %s' % (nama, keterangan, ringkas))
        print(hasil.stdout[-2000:])
        print(hasil.stderr[-2000:])

print()
if gagal:
    print('UJI KEUANGAN GAGAL: %s' % ', '.join(gagal))
    raise SystemExit(1)
print('Seluruh uji keuangan lulus (%d berkas).' % len(UJI))
