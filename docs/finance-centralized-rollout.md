# Runbook Keuangan Terpusat — Koperasi dan Pembayaran Item

Keuangan Terpusat memakai binding FINANCE_DB ke database produksi
eskahade-finance (ID 8388b81f-c5c7-4523-9a72-437f947331a1). Sandbox memakai
DEMO_FINANCE_DB ke eskahade-demo-finance. DB utama hanya menyimpan identitas,
role, menu, serta sumber pengelola Katering & Laundry.

Alur operasionalnya adalah pilih item, bayar tepat, bukukan hak penerima,
cairkan manual, lalu terbitkan bukti dan laporan. Tidak ada top-up umum,
saldo titipan, pemindahan antarpos, payout API, approval berjenjang, atau payroll
di menu Keuangan Terpusat. Satu-satunya saldo santri di modul ini adalah JAJAN.

## Berkas migrasi rewrite

- migrations-finance/0004_cooperative_item_payments.sql menambah tagihan mandiri,
  pesanan, VA tetap, hak penerima, pencairan, mutasi kas, exception pembayaran,
  rekonsiliasi, dan guard kartu QR. Migrasi ini additive dan tidak mereset data.
- migrations-finance/0005_demo_cooperative_reset.sql hanya untuk database demo.
- migrations/0147_cooperative_finance_access.sql diterapkan ke DB utama untuk
  role dan metadata menu. Berkas ini tidak menulis transaksi keuangan.
- scripts/apply-finance-migration.py dipakai untuk instalasi finance baru dari
  keadaan kosong. Pada database yang sudah memiliki 0001 sampai 0003, jalankan
  0004 saja. Jangan menjalankan 0001a pada database berisi transaksi.

Struktur setelah instalasi penuh: 51 tabel finance/credential, 41 trigger,
28 index eksplisit, dan 18 akun.

## Pemeriksaan wajib sebelum migrasi remote

1. Export eskahade-finance dan eskahade-demo-finance ke lokasi aman di luar repo.
2. Periksa jumlah jurnal POSTED, pesanan, wallet movement, payout, serta rentang
   tanggal transaksi.
3. Jika ada transaksi nyata, jangan reset. Terapkan 0004 secara additive dan
   susun migrasi data khusus setelah rekonsiliasi.
4. Pastikan hasil restore export sudah diuji.
5. Terapkan berurutan: lokal, demo, lalu produksi.

Contoh pemeriksaan baca:

    npx wrangler d1 execute eskahade-finance --remote --command "SELECT COUNT(*) jumlah, MIN(posted_at) awal, MAX(posted_at) akhir FROM finance_journals WHERE status='POSTED';"

Backup:

    npx wrangler d1 export eskahade-finance --remote --output ../backup-eskahade-finance.sql
    npx wrangler d1 export eskahade-demo-finance --remote --output ../backup-eskahade-demo-finance.sql

## Urutan penerapan

Lokal:

    npx wrangler d1 execute eskahade-finance --local --file migrations-finance/0004_cooperative_item_payments.sql

Demo finance:

    npx wrangler d1 execute eskahade-demo-finance --remote --file migrations-finance/0004_cooperative_item_payments.sql
    npx wrangler d1 execute eskahade-demo-finance --remote --file migrations-finance/0005_demo_cooperative_reset.sql

DB utama demo/produksi harus menerima migrations/0147_cooperative_finance_access.sql
melalui jalur migrasi aplikasi yang biasa dipakai repo.

Produksi finance, setelah UAT demo lulus:

    npx wrangler d1 execute eskahade-finance --remote --file migrations-finance/0004_cooperative_item_payments.sql

Jalankan setiap berkas sebagai satu perintah --file. Bila satu langkah gagal,
berhenti dan pulihkan dari backup; jangan menambal sebagian skema secara manual.

## Konfigurasi Duitku SNAP

Endpoint callback pembayaran yang aktif:

    /api/finance/gateway/duitku/snap/payment

Endpoint callback lama dan payout callback mengembalikan HTTP 410. Transfer
kepada penerima dicatat manual, dengan referensi dan bukti.

Environment yang wajib tersedia:

- DUITKU_SNAP_PARTNER_ID
- DUITKU_SNAP_PRIVATE_KEY
- DUITKU_SNAP_PUBLIC_KEY
- DUITKU_SNAP_CLIENT_SECRET
- DUITKU_SNAP_VA_PREFIX
- DUITKU_PRODUCTION
- FINANCE_ENCRYPTION_KEY
- CREDENTIAL_HMAC_SECRET

Online harus tetap nonaktif sampai create, delete, status inquiry, callback sah,
callback duplikat, nominal salah, VA salah, kedaluwarsa, dan urutan pembayaran
berikutnya untuk VA tetap lulus di sandbox Duitku.

## Verifikasi

    npm run test:finance
    npx tsc --noEmit
    npm run build

Tes mencakup regresi ledger lama, skema rewrite, checkout campuran, idempotensi,
benturan order, hak penerima, pencairan tunai/manual, koreksi, shift kas,
setor/tarik JAJAN dengan QR dan PIN, batch kartu, scope role, generator bulanan,
serta UI pada 360, 390, 768, dan 1366 piksel.

UAT wajib menuntaskan dua perjalanan:

1. bayar item, pembukuan, pencairan, bukti, laporan;
2. terbit/ganti/blokir kartu, setor JAJAN, lalu tarik dengan QR dan PIN.

PDF kartu memakai A4 portrait, delapan kartu CR80 per halaman. Uji cetak duplex,
alignment depan-belakang, scanner desktop, dan kamera mobile sebelum penerbitan
massal.

## Catatan kegagalan akses

Jika Wrangler memberi error 7403 atau menyatakan account tidak berwenang, jangan
mencoba mutasi remote. Perbaiki login/token Cloudflare, ulangi pemeriksaan baca,
lalu mulai lagi dari backup dan urutan lokal, demo, produksi.
