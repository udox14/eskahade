# Runbook remediation keuangan / BRI — 18 Oktober 2026

Dokumen ini menggantikan instruksi rilis lama yang bertentangan dengan audit/remediation 18 Oktober. Pekerjaan pada branch remediation hanya lokal. Tidak ada izin push, deploy, migrasi remote, perubahan secret/flag/R2, atau transaksi bank.

## Baseline dan schema

- Baseline audit: `6ee5debfb39881aba7bd74b4c3f1058a97210308`.
- Branch: `fix/finance-bri-audit-20261018`.
- Migration **0182–0186 sudah applied secara manual**. Jangan diedit atau diaplikasikan ulang.
- `d1_migrations` tidak mewakili seluruh sejarah applied migration repository ini. Gunakan schema aktual, manifest audit, dan catatan penerapan manual.
- Migration baru, berurutan: `0187_finance_controlled_remediation.sql`, `0188_bri_evidence_guards.sql`, `0189_finance_snapshot_and_reporting.sql`.
- Ketiganya **belum diaplikasikan remote**. Aplikasi baru memerlukan ketiganya. Jangan deploy kode ini ke schema lama.
- Tidak ada DROP tabel/data finansial atau penulisan ulang migration applied. View rekening UI memakai master recipient account yang sudah ada; tabel provider account historis tetap dipertahankan.

## Verifikasi lokal yang dapat diulang

```powershell
node scripts/test-finance-remediation.cjs
node scripts/test-finance-bri-remediation.cjs
node scripts/test-finance-operations-remediation.cjs
npm run build:cf
```

Suite lama `scripts/test-finance-*`, `scripts/test-bri-*`, dan `scripts/test-migration-0182.cjs` sampai `0186` juga wajib dijalankan. Bukti hasil terdaftar di laporan remediation. Test baru memakai migration finance asli, foreign key aktif, batch SQLite dengan rollback, identitas sintetis, dan mock transport/bucket; tidak mengakses bank/Cloudflare remote.

Build di Windows dapat memerlukan izin membuat file generated. Cache `.next/dev/types` lama yang merujuk route Duitku sudah dipertahankan di `output/remediation-cache/next-dev-types` dengan ekstensi `.cache`; ini bukan source aplikasi. Jangan menonaktifkan pemeriksaan TypeScript atau menghidupkan kembali route Duitku untuk mengatasi cache lama.

## Gate sebelum penerapan yang kelak disetujui

1. Reviewer mengaudit diff, hasil tes, dan semua temuan yang masih berstatus partial/blocked.
2. Verifikasi target database secara eksplisit, schema/trigger/index aktual, foreign key, dan catatan manual migration. Jangan memakai bulk `migrations apply` terhadap ledger yang belum diselaraskan.
3. Siapkan backup dan rehearsal pemulihan. Preflight harus menghitung row count/hash data finansial, nominal non-integer/negatif/overflow, duplikasi VA/order/event, rule biaya yang overlap, dan reservasi aktif. Jangan mengoreksi data lama secara otomatis untuk meloloskan preflight.
4. Hentikan dan drain seluruh mutasi keuangan selama jendela penerapan. Terapkan schema dan kode sebagai satu rilis terkoordinasi; jangan membiarkan worker lama yang memiliki jalur mutasi tidak aman tetap menerima operasi selama pergantian.
5. Setelah persetujuan terpisah, jalankan hanya tiga migration baru secara berurutan pada target yang sudah diverifikasi; verifikasi schema dan data kembali sebelum membuka mutasi. **Runbook ini tidak menjalankan langkah tersebut.**
6. Lakukan UAT D1 nyata dan browser smoke test di lingkungan yang disetujui. Pengujian SQLite lokal bukan bukti perilaku distributed D1 atau interoperabilitas bank.
7. Hasil preflight yang berbeda dari manifest, constraint failure, atau perbedaan kepemilikan uang menghentikan penerapan. Gunakan restore/recovery yang direview; jangan DROP financial history atau menghapus guard.

## Privasi bukti

- `/api/file/penyaluran-proofs/...` dan `/api/file/proofs/...` ditolak. Aset publik lain tetap melalui route publik.
- Unggah bukti lewat `/api/finance/proofs`; baca lewat `/api/finance/proofs/<key>`. Akses memerlukan sesi, feature/role, hubungan dengan penyaluran atau kepemilikan unggahan. Respons privat menggunakan `private, no-store`.
- Transfer manual wajib memiliki referensi bank dan bukti privat milik operator. Fallback reference tanpa object R2 tidak diterima sebagai unggahan yang berhasil.
- **Status akses langsung `r2.dev`/custom domain bucket belum diverifikasi dalam remediation lokal ini.** Memblokir route Worker tidak menutup public bucket secara otomatis.
- Di produksi, penyimpanan diblokir jika `FINANCE_PROOFS_PRIVATE_STORAGE_CONFIRMED` belum bernilai `true`. Variabel ini **tidak diaktifkan dalam task ini**. Penetapannya hanya setelah administrator membuktikan bukti baru dan lama tidak dapat dibaca melalui R2 public access/custom domain; gunakan bucket privat atau tutup public access sesuai keputusan infrastruktur yang direview. Pastikan aset publik tetap dapat dilayani melalui Worker.
- Bukti lama yang mungkin sudah publik memerlukan penanganan cache/object/domain terpisah oleh pemilik infrastruktur. Tidak ada object R2 yang dipindah, dihapus, atau diubah dalam task ini.

## BRIVA dan biaya

- Referensi publik saat review: [BRIVA Online SNAP BI](https://developers.bri.co.id/id/snap-bi/apidocs-virtual-account-briva-online-snap-bi), [Bank Statement v2.1](https://developers.bri.co.id/id/node/54255), [OAuth SNAP BI](https://developers.bri.co.id/id/snap-bi/apidocs-oauth-snap-bi).
- Route v2.0 tersedia. Produksi wajib memiliki path canonical yang dikonfirmasi onboarding melalui `BRI_CANONICAL_INQUIRY_PATH` dan `BRI_CANONICAL_PAYMENT_PATH`. Alias `/api/bri/v1.0/...` tetap ditutup di produksi; route v1 hanya dapat dipakai bila kontrak/path yang berlaku memang ditetapkan demikian.
- `X-PARTNER-ID` berbeda dari Partner Service ID. Service ID berasal dari konfigurasi institusi yang tervalidasi, dipadding di wire; VA canonical mempertahankan digit/leading zero dan ownership permanen.
- Payment memakai `trxId` root bila tersedia; tidak diganti dengan request ID atau reference internal. `totalAmount` bukan field wajib Payment berdasarkan tabel request publik yang direview. Inquiry response mempunyai `totalAmount` wajib.
- `additionalInfo` Inquiry berada dalam data VA; Payment berada di root respons. Fee bank tidak diisi nol atau diperkirakan tanpa kontrak. Admin Koperasi dihitung server, sekali per checkout, dan memakai snapshot rule pada order/income.
- Inquiry ID dan snapshot tidak dapat dipindah ke order pengganti. Pembayaran terlambat/tidak berkorelasi dipertahankan sebagai evidence dan antrean review; jangan memperlakukannya sebagai allocation atau settlement berhasil.
- Inbound tetap default nonaktif; aktivasi dan token contract, UAT signing, channel, deadline, reference, serta versi produk harus dikonfirmasi BRI. Tidak ada aktivasi dalam remediation ini.

## Rekening koran, recovery, settlement

- Menu Rekonsiliasi Bank menampilkan mutasi, kandidat, target pembayaran/order, catatan pemeriksaan, dan konfirmasi operator.
- Pengambilan mutasi memerlukan dua gate: `BRI_STATEMENT_SYNC_ENABLED` dan outbound kill switch, serta collection account yang benar. Tidak ada scheduler baru atau jadwal bank yang dikarang.
- Parser memakai `transactionDate`, `detailInfo.remarkCustom`, total bertingkat, dan balance amount array. Baris/totals rusak, perubahan identitas transaksi, atau provider failure tidak memajukan cursor.
- Nominal/regex remark/issuer transaction ID tidak memadai untuk klaim otomatis lintas produk. Matching hanya kandidat selama kontrak identitas belum terbukti.
- Settlement baru menggunakan `MANUAL_RESOLVED` dengan bank evidence, case rekonsiliasi, operator berwenang, dan catatan. Claim baru `AUTHORITATIVE_EXACT` diblokir sampai contract mapping diverifikasi dan perubahan guard direview.
- Recovery order yang masih sah dilakukan atomik; expired/replaced/cancelled tidak dialokasikan otomatis. Bank credit yang belum dapat diidentifikasi tetap menjadi evidence/case review. Tidak ada pemilihan latest order atau penyamaan nominal untuk menebak penerima uang.
- Transaction Status Inquiry masih `CONTRACT_TBD`. Timeout tetap unknown/pending dan memerlukan inquiry resmi atau statement evidence; jangan retry transaksi finansial secara buta.

## Penyaluran

- CASH dan MANUAL_TRANSFER memakai draft/allocation engine yang sama, transisi/evidence yang sesuai, dan hard guard reservasi/overdraw. UI tidak mengeksekusi final transfer bank otomatis.
- CASH memerlukan sesi kas aktif, kas tersedia setelah reservasi, dan nama penerima; serah terima mengubah cash session dan status secara atomik.
- Manual transfer mencatat kejadian transfer yang sudah dibuktikan; membutuhkan master account, snapshot tujuan, referensi, bukti privat, operator dan timestamp. Data tujuan client tidak menggantikan master secara diam-diam.
- QLola produksi tetap hard-disabled/non-STP. Adapter simulasi hanya dapat dipakai dalam proses tes, bukan produksi. Tidak ada ACK, Signer approval, atau execution bank yang dibuat oleh Eskahade.
- Jangan switch ke cash/manual saat instruksi bank masih dapat dieksekusi. Pembatalan pending tidak melepas dana tanpa evidence yang sah.
- Beneficiary inquiry mengembalikan `NOT_VERIFIED`, tanpa nama/reference bank buatan. Verifikasi bank asli menunggu kontrak dan entitlement BRI.
