"""Menyegarkan seluruh teks panduan 'Cara menggunakan halaman ini' yang masih
menyebut fitur yang sudah dihapus."""
import io

GANTI = [
    # ---------------- KREDENSIAL ----------------
    ('app/dashboard/keuangan-terpusat/kredensial/page.tsx', [
        ("Mendaftarkan ribuan kartu santri lewat alur scan berurutan dan batch yang dapat dilanjutkan bila terputus.",
         "Menerbitkan kartu QR santri secara massal, dalam batch yang dapat dilanjutkan bila terputus."),
        ("prerequisites={['Hubungkan USB reader dalam mode keyboard dan pastikan reader mengirim Enter setelah tiap scan.', 'Uji reader lebih dulu di tab Pengaturan sebelum memulai antrean panjang.', 'Izinkan akses kamera bila memakai scan QR lewat perangkat.']}",
         "prerequisites={['Uji scanner lebih dulu di tab Pengaturan; scanner harus mengirim Enter setelah tiap scan.', 'Izinkan akses kamera bila memindai QR lewat perangkat.']}"),
        ("        'Jalankan batch QR, atau mulai antrean RFID untuk scan satu per satu.',\n",
         "        'Jalankan batch penerbitan QR.',\n"),
        ("        'Memulai antrean RFID tanpa menguji reader dulu, lalu semua scan tertahan karena reader tidak mengirim Enter.',\n",
         "        'Menguji scanner hanya sekali lalu menganggap semua unit beres; scanner yang tidak mengirim Enter membuat scan tertahan.',\n"),
        ("        { term: 'RFID', meaning: 'Kartu tempel. Nomor uniknya dibaca reader; nomor itu sendiri tidak berarti apa-apa tanpa PIN.' },\n",
         ""),
        ("{ term: 'Mode kredensial', meaning: 'Jenis kartu yang diterima loket. Mode transisi menerima keduanya sampai tanggal tertentu.' },",
         "{ term: 'PIN santri', meaning: 'Enam digit milik santri. QR saja tidak cukup — tanpa PIN, kartu yang jatuh tidak bisa dipakai orang lain.' },"),
    ]),

    # ---------------- LOKET ----------------
    ('app/dashboard/keuangan-terpusat/loket/_cashier-client.tsx', [
        ("<li>Pastikan scanner RFID/QR dan keypad PIN siap.</li>",
         "<li>Pastikan scanner QR dan keypad PIN siap.</li>"),
        ("title: 'Scan kartu atau QR'", "title: 'Scan QR santri'"),
    ]),

    # ---------------- OPERASI ----------------
    ('app/dashboard/keuangan-terpusat/operasi/page.tsx', [
        ('description="Kendalikan tagihan, mutasi bank, settlement gateway, dan tutup buku."',
         'description="Kendalikan tagihan, pencocokan rekening koran, settlement gateway, dan tutup buku."'),
        ("        'Impor mutasi bank, lalu cocokkan baris yang belum terjelaskan ke jurnal.',\n",
         "        'Cocokkan saldo tiap rekening kas dengan rekening koran, lalu jelaskan selisihnya bila ada.',\n"),
        ("        'Reopen membutuhkan dua persetujuan berbeda dan hanya berlaku sekali pakai.',\n",
         "        'Membuka kembali periode tertutup butuh satu penyetuju selain yang mengajukan, dan alasannya tercatat permanen.',\n"),
    ]),
    ('app/dashboard/keuangan-terpusat/operasi/_operations-client.tsx', [
        ("title: 'Impor mutasi bank'", "title: 'Cocokkan rekening koran'"),
        ("'Membuka kembali memerlukan dua persetujuan dari orang berbeda.',",
         "'Membuka kembali memerlukan satu penyetuju selain Anda.',"),
        ("        'Kedua persetujuan yang terkumpul akan habis terpakai.',\n", ""),
    ]),

    # ---------------- PAYOUT ----------------
    ('app/dashboard/keuangan-terpusat/payout/page.tsx', [
        ('"Executor mengirim dana — via API atau transfer manual dengan nomor bukti.",',
         '"Checker yang sama mengirim dana — via API atau transfer manual dengan nomor bukti.",'),
    ]),

    # ---------------- KONTROL ----------------
    ('app/dashboard/keuangan-terpusat/kontrol/page.tsx', [
        ("        'Kunci MFA dan hash identitas tidak pernah ditampilkan di layar.',\n", ""),
    ]),

    # ---------------- RINGKASAN ----------------
    ('app/dashboard/keuangan-terpusat/page.tsx', [
        ("'Pastikan settlement gateway dan mutasi bank sudah diimpor di halaman Operasi.'",
         "'Pastikan settlement gateway sudah diposting dan rekening sudah dicocokkan di halaman Operasi.'"),
    ]),

    # ---------------- PORTAL ORTU ----------------
    ('app/portal-ortu/(app)/keuangan/_limit-modal.tsx', [
        ("Batas pencairan saldo jajan/makan di pesantren (RFID/QR). Isi 0 untuk tidak ",
         "Batas pencairan saldo jajan/makan di pesantren lewat kartu QR. Isi 0 untuk tidak "),
    ]),
]

for path, subs in GANTI:
    s = io.open(path, encoding='utf-8').read()
    n = 0
    for a, b in subs:
        if a in s:
            s = s.replace(a, b, 1)
            n += 1
        else:
            print('  LEWAT %s: %s...' % (path.split('/')[-1], a[:60]))
    io.open(path, 'w', encoding='utf-8').write(s)
    print('%-60s %d ganti' % (path, n))
