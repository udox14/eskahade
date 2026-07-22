# Runbook Keuangan Terpusat

Sistem baru memakai seluruh tabel berawalan `finance_` dan tidak mengambil saldo dari `santri.saldo_uang_jajan` atau `saldo_tabungan`. Migrasi tidak otomatis mengaktifkan cohort baru.

## Urutan deployment

1. Isi secret berdasarkan `docs/finance-env.example` di Cloudflare untuk production dan preview. Jangan memakai secret yang sama untuk JWT, HMAC credential, dan enkripsi rekening.
2. Terapkan `migrations/0120_finance_application_bridge.sql` ke `DB` dan `DEMO_DB`.
3. Terapkan seluruh berkas `migrations-finance/` ke `FINANCE_DB` dan `DEMO_FINANCE_DB`. Jangan pernah menerapkan migrasi keuangan ini ke DB utama.
4. Pastikan callback cash-in adalah `/api/finance/gateway/duitku/callback` dan callback disbursement adalah `/api/finance/gateway/duitku/payout-callback` pada dashboard Duitku.
5. Uji sandbox cash-in, callback replay, settlement, inquiry rekening, payout, callback payout, dan rekonsiliasi.
6. Buat unit kas, rekening penerima, kebijakan limit, PIN santri, serta credential pilot 20–50 kartu. Rekening penerima tetap tidak dapat dipakai sampai diverifikasi dan cooling period 24 jam selesai.
7. Pilih satu asrama pilot dengan mengubah setting `finance_legacy_mode`. Set `new_system_enabled=true`, `pilot_asrama`, dan masukkan asrama yang sama ke `auto_wallet_worker_disabled_cohorts`. Trigger database dan worker akan menghentikan dompet legacy untuk cohort tersebut.
8. Jalankan satu siklus bulanan, rekonsiliasi semua exception, tutup buku, lalu lakukan uji restore sebelum menambah cohort.

## Database terpasang

- `FINANCE_DB` → `eskahade-finance` (`8388b81f-c5c7-4523-9a72-437f947331a1`)
- `DEMO_FINANCE_DB` → `eskahade-demo-finance` (`c610762b-dec7-4b83-b5f4-5d5ab3036f43`)
- Deployment awal pemisahan DB: Worker version `a924861c-66c2-4d33-afda-da9feac83e25`.
- Mode sistem baru tetap nonaktif; aktivasi cohort harus menjadi keputusan go-live terpisah.

Contoh setting pilot (sesuaikan nama asrama persis dengan master data):

```json
{
  "new_system_enabled": true,
  "pilot_asrama": "Nama Asrama Pilot",
  "legacy_new_writes_disabled": false,
  "auto_wallet_worker_disabled_cohorts": ["Nama Asrama Pilot"]
}
```

## Kontrol wajib sebelum produksi

- Onboarding payment dan disbursement Duitku sudah berstatus aktif. Disbursement menggunakan dua tahap inquiry–transfer dan menunggu callback sebelum dianggap sukses provider.
- Telaah tertulis model titipan dan pencairan cash selesai.
- Cloudflare berbayar, backup D1 harian terenkripsi, arsip bulanan bertanda hash, NAS dan salinan luar lokasi Indonesia sudah berjalan.
- Restore diuji dan dicatat minimal tiap kuartal; retensi jurnal/dokumen pembukuan minimal 10 tahun.
- Minimal dua reader RFID, dua scanner QR, keypad privat, dan koneksi cadangan sudah lulus pilot beban.
- Akun admin teknis tidak dapat membuka panel keuangan tanpa break-glass 30 menit; setiap aktivasi masuk outbox untuk notifikasi dan review auditor.
- Session staf baru berlaku delapan jam. Infrastruktur MFA/revocation tersedia di migration; enrollment MFA organisasi harus diselesaikan sebelum kewajiban MFA diaktifkan untuk seluruh staf.

## Perintah verifikasi

```powershell
npm.cmd run test:finance
npx.cmd tsc --noEmit --pretty false
npm.cmd run build
```

`test:finance` membuat D1 lokal terisolasi dan menguji posting seimbang, rollback saldo negatif, jurnal tidak seimbang, idempotensi, periode tertutup, larangan self-approval, mode `HYBRID`, constraint credential aktif, dan resume batch 1.000 santri tanpa duplikasi.

## Peralihan RFID dan QR

Mode dapat diubah dari panel Kredensial menjadi `RFID`, `QR`, `HYBRID`, atau `BOTH_TRANSITION`. `HYBRID` mengaktifkan RFID dan QR permanen secara bersamaan. Mode transisi wajib mempunyai metode asal, tujuan, dan batas waktu. Scan pertama setelah batas waktu akan menyelesaikan transisi secara atomik: metode lama menjadi `SUSPENDED_BY_POLICY`; saldo, limit, PIN, foto, dan histori santri tidak berubah.

Credential berstatus `LOST` atau `REVOKED` tidak pernah diaktifkan kembali. Token QR disimpan terenkripsi memakai `FINANCE_ENCRYPTION_KEY`, sedangkan resolver tetap membandingkan HMAC. Token mentah tidak pernah dikirim dari client saat export kartu.

Sebelum migrasi `0002_credential_fast_enrollment.sql` dan deploy Worker, pastikan secret `FINANCE_ENCRYPTION_KEY` serta `CLOUDFLARE_BROWSER_RENDERING_API_TOKEN` sudah tersedia. Terapkan migrasi ke `FINANCE_DB` dan `DEMO_FINANCE_DB`; jangan menerapkannya ke DB utama. PDF kartu memakai A4 portrait, delapan kartu CR80 per lembar, serta pasangan halaman belakang yang dicerminkan untuk duplex long-edge.
