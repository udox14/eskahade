import io, re

GANTI = [
    ('app/dashboard/keuangan-terpusat/payout/_payout-client.tsx', [
        ('Rekening baru wajib diverifikasi orang lain dan menunggu masa tenang 24 jam sebelum dapat menerima transfer.',
         'Rekening baru wajib diverifikasi petugas lain sebelum dapat menerima transfer.'),
        ('Setiap rekening tetap wajib diverifikasi petugas lain dan tetap menunggu masa tenang 24 jam.',
         'Setiap rekening tetap wajib diverifikasi petugas lain sebelum bisa dipakai.'),
        ('<li>Impor tidak melewati pengaman: rekening masuk berstatus belum diverifikasi dan belum bisa menerima transfer sampai masa tenang berakhir.</li>',
         '<li>Impor tidak melewati pengaman: rekening masuk berstatus belum diverifikasi dan belum bisa menerima transfer sampai ada petugas lain yang memverifikasinya.</li>'),
        ("'Belum ada rekening yang siap. Daftarkan dan verifikasi rekening lebih dulu.'",
         "'Belum ada rekening yang siap. Daftarkan lalu minta petugas lain memverifikasinya.'"),
    ]),
    ('app/dashboard/keuangan-terpusat/payout/page.tsx', [
        ('"Mengira masa tenang 24 jam bisa dilewati setelah verifikasi. Verifikasi dan masa tenang adalah dua syarat terpisah.",', ''),
        ("{ term: 'Masa tenang 24 jam', meaning: 'Jeda wajib sejak rekening didaftarkan sampai boleh menerima transfer, supaya rekening palsu sempat ketahuan.' },", ''),
    ]),
]

for path, subs in GANTI:
    s = io.open(path, encoding='utf-8').read()
    n = 0
    for a, b in subs:
        if a in s:
            s = s.replace(a, b)
            n += 1
        else:
            print('  LEWAT di %s: %s...' % (path, a[:50]))
    io.open(path, 'w', encoding='utf-8').write(s)
    print(path, '->', n, 'ganti')

# hoursLeft jadi tak terpakai
p = 'app/dashboard/keuangan-terpusat/payout/_payout-client.tsx'
s = io.open(p, encoding='utf-8').read()
s2 = re.sub(r"  function hoursLeft\(ms: number\) \{\n(?:.*?\n)*?  \}\n", "", s, count=1)
print('hoursLeft dibuang' if s2 != s else 'hoursLeft LEWAT')
io.open(p, 'w', encoding='utf-8').write(s2)
