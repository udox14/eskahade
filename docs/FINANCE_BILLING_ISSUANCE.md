# Penerbitan tagihan tanpa ketergantungan Portal Ortu

## Perilaku

- Penerbitan berjalan memakai `billing-issuance.ts`, melalui adapter request dan
  binding D1 eksplisit pada Worker. Tidak ada perubahan auth/session global.
- Bulanan terbit pada periode berjalan; tahunan mengikuti tahun ajaran Juli–Juni.
  Batas pergantian memakai WIB. Sisa bulan/tahun ajaran yang sudah lewat adalah
  tunggakan. USPP tetap sisa cicilan lifetime.
- Portal, formulir Status Pembayaran, dan Loket menyediakan pilihan bayar di
  muka terpisah. Periode mendatang tidak dipilih otomatis dan tidak masuk total
  kewajiban berjalan/tunggakan. Rentangnya sama dengan jendela portal existing:
  sisa tahun ajaran dan hingga enam bulan mendatang.
- Tarif, pembebasan semua/sebagian item, AL-BAGHORY, SADESA, dan kepesertaan
  layanan memakai aturan existing. Pembebasan SPP permanen dan peniadaan bulan
  pada modul lama dibaca tanpa mengubah pengaturannya.
- CUTOVER tetap Juli 2026 untuk bulanan dan 2026 untuk tahunan. Pengaturan
  `spp_tagihan_mulai`, tanggal masuk, serta waktu santri dicatat tetap membatasi
  awal SPP. Kewajiban existing tidak diperbarui oleh penerbitan.
- Mesin kewajiban, pembaca tarif, dan pembaca legacy diekstrak menjadi runtime
  yang dapat menerima database eksplisit; API request existing tetap tersedia.
  Kegagalan membaca konfigurasi pada penerbitan baru tidak dijadikan fallback
  sukses. Override tarif memakai snapshot nominal dan FK tarif dasar yang valid
  atau NULL; ID tabel override tidak dimasukkan sebagai FK finance_tariffs.
- USPP santri lama tanpa bukti kewajiban tidak dihidupkan ulang. PSB atau tanggal
  masuk baru sejak CUTOVER dapat memakai tarif USPP global yang sudah diatur;
  saldo awal/pembayaran lama yang belum sesuai masuk pemeriksaan.

## Pembayaran lama dan keamanan alokasi

Sumber `spp_log` dan `pembayaran_tahunan` diperiksa bersama allocation/correction
hasil bridge. Nominal berubah, mirror belum ada, periode ambigu, void yang belum
direversal, dan sumber terhapus dengan mirror tersisa menahan penagihan ulang.
Kondisi tersebut tidak dianggap lunas dan tidak dibuatkan pembayaran sintetis.

Pemeriksaan berlaku pada daftar dan total, pembuatan order, dan eksekusi payment.
Trigger additive menutup race ketika bukti legacy berubah setelah precheck.
Bridge legacy tetap dapat memposting mirror melalui jalurnya sendiri.

Guard pada layanan BRIVA hanya memengaruhi kelayakan alokasi lokal. Endpoint,
signature, header, serta kode respons existing tidak diubah. Bukti callback
terautentikasi yang konflik disimpan melalui mekanisme recovery existing;
principal, admin income, dan top-up wallet tidak diposting. Jalur BRI tetap
mengikuti kill switch existing, tanpa aktivasi baru.

Referensi publik [BRIVA Online SNAP BI BRI](https://developers.bri.co.id/id/snap-bi/apidocs-virtual-account-briva-online-snap-bi)
diperiksa ulang pada 21 Oktober 2026 untuk penggunaan kode Invalid Bill
existing pada guard tersebut. Kecocokan kontrak onboarding dan UAT tetap perlu
dibuktikan sebelum integrasi bank diaktifkan.

## Pelengkapan historis dan monitoring

Pada Status Pembayaran tersedia bagian **Pemeriksaan penerbitan tagihan**.
Pratinjau membaca dua santri per halaman dan membedakan kandidat aman, existing,
legacy, dibebaskan, dilewati, serta perlu pemeriksaan/gagal konfigurasi.
Pratinjau tidak menulis database.

Petugas yang memiliki izin mutasi dapat memilih sampai 25 kandidat. Server
membandingkan fingerprint pratinjau, memeriksa ulang bukti, dan menambahkan
record yang belum ada. Run manual menyimpan operator serta pilihan yang
ditinjau. Nominal dari client tidak digunakan sebagai nilai finansial.

Periode makan/nyuci lampau tidak diasumsikan memakai provider saat ini.
Tanggal masuk yang tidak jelas, masa nonaktif, dan bukti yang bertentangan
tetap memerlukan pemeriksaan. Kasus tersebut tidak dimaterialisasi otomatis.

Admin/Bendahara dapat mencatat hasil verifikasi provider khusus santri/item/
periode beserta referensi bukti. Verifikasi dan audit operator ditulis dalam
satu batch; hasil verifikasi sebelumnya tetap tercatat pada run audit. Setelah
verifikasi, petugas memuat ulang pratinjau dan memilih kandidat yang sudah
aman. Snapshot memakai provider historis tersebut, tanpa mengganti provider
aktif santri. Bukti provider tidak melewati guard pembayaran lama, masa aktif,
tarif, atau pembebasan, dan tidak dapat mengganti snapshot kewajiban existing.

Worker terpisah `finance-billing` dipicu tiap lima menit. Cursor dan lease
tersimpan di D1; putaran harian menggunakan keyset santri dan melanjutkan
putaran sebelumnya bila belum selesai. Halaman kecil dan batas waktu/query
membatasi satu invocation. Error per item tersimpan sebagai issue dan dicoba
lagi pada putaran berikutnya. Formulir pembayaran memastikan periode berjalan
tersedia tanpa menunggu seluruh putaran selesai.

## Schema dan status penerapan

**Sandbox/UAT lulus. Migration production 0196 applied pada 22 Oktober 2026;
rollout aplikasi dan aktivasi Worker mengikuti persetujuan pengguna pada hari yang sama.**
Akses D1 berhasil dipulihkan. Audit ledger aktual menemukan production sampai
0190, sandbox mempunyai 0191 serta pemulihan khusus 0192–0195. Schema finance
kedua target diperiksa; kolom saldo wallet production sudah ada sehingga 0191
**tidak boleh diulang**. Ledger historis parsial bukan alasan menjalankan bulk
`migrations apply`.

Migration additive baru: `migrations/0196_finance_billing_issuance.sql`.
SQL menambah tabel run/issue, indeks pembacaan legacy, serta guard order/allocation;
tidak memindahkan atau mengubah baris finansial existing. Migration dan entri
ledger 0196 sudah applied **hanya pada eskahade-demo-db**. Jangan replay.

Bukti sandbox:

- Backup privat 242 tabel biasa dan bookmark Time Travel tersimpan di `output/`.
  D1 menolak ekspor penuh karena virtual FTS5; virtual/shadow FTS dikecualikan.
  Ini bukan backup ekspor FTS lengkap; bookmark mencatat titik pemulihan D1.
- Rehearsal memakai ekspor aktual: 242 tabel lama identik sebelum/sesudah SQL;
  foreign key dan integrity check SQLite lokal lulus.
- Ekspor remote pascamigration dibandingkan per baris dengan backup: semua
  tabel lama identik, kecuali satu entri ledger 0196 yang memang ditambahkan.
  Foreign key remote bersih; integrity check pada salinan ekspor pasca lulus.
  `PRAGMA quick_check` remote ditolak D1 dengan SQLITE_NOMEM; tidak diklaim lulus.
- Pratinjau layanan pada salinan data sandbox: periode berjalan 32 READY,
  4 EXISTING, 34 SKIPPED; seluruh periode sejak CUTOVER 32 READY, 7 EXISTING,
  55 SKIPPED, 66 REVIEW. Tidak ada FAILED. Pratinjau tidak menulis data remote
  dan bukan persetujuan untuk mengeksekusi kandidat historis.
- Aplikasi sandbox: version `ad0c1b91-5ba7-48a8-8990-bc9f179135c3`.
- Worker sandbox: version `aeb732a4-3403-400c-a359-ad8432969e1c`, cron tiap
  lima menit, `FINANCE_BILLING_AUTO_ENABLED=false`. Binding DB/DEMO_DB hanya
  `677f05ba-9b52-4534-9542-96cc785f25e4`. Seluruh flag BRI tetap nonaktif.

Sisa gate rilis:

1. UAT tampilan Tagihan Portal Ortu, Loket setelah PIN, Status Pembayaran,
   pratinjau, dan pilihan periode petugas sudah diuji. Tinjau bukti dan hasil
   sandbox sebelum keputusan rollout production.
2. Tinjau pratinjau historis sebelum menyetujui kandidat; kasus REVIEW harus
   tetap tertahan. Tidak ada backfill historis yang dieksekusi pada tahap ini.
3. Cron nyata, pelanjutan cursor, dan replay handler pada D1 sandbox sudah
   diuji di bawah. Pantau batas query pada volume production yang lebih besar
   saat rollout; dataset sandbox hanya 10 santri. Default tetap false.
4. Production memerlukan langkah eksplisit setelah hasil sandbox diterima:
   preflight terbaru, backup privat/bookmark, hanya SQL 0196 beserta catatan
   ledger, postflight preservasi/FK, deploy aplikasi dan Worker production.
   Jangan bulk apply ledger parsial, mengulang 0191, atau menerapkan 0192–0195
   ke production. Jangan mengaktifkan BRI atau mengubah CUTOVER.

## UAT dengan sesi Administrator sandbox, 21 Oktober 2026

- Halaman Status Pembayaran, panel pratinjau, dan formulir petugas dimuat
  berhasil. Pratinjau AL-BAGHORY dilewati; kandidat historis tanpa bukti
  ditandai Perlu Pemeriksaan dan checkbox tidak dapat dipilih.
- Ahmad Billable (NIS001) tidak mempunyai baris `portal_ortu_credentials`
  pada backup sebelum UAT. Memilihnya pada formulir petugas menerbitkan SPP
  Oktober serta EHB/EKSKUL/KESEHATAN 2026, total berjalan Rp420.000.
- Memilih November menerbitkan SPP Rp70.000 berlabel Mendatang. Tidak ada
  checkbox otomatis terpilih setelah pemilihan periode; total pilihan Rp0.
  Tunggakan tetap Rp210.000 (Juli–September pada santri uji existing), tidak
  mencakup November maupun tagihan tahunan tahun ajaran berjalan.
- Pembayaran dan allocation tetap 4 dan 16; tidak ada posting pembayaran
  pada UAT formulir ini. Kewajiban uji yang sudah dibuat dipertahankan.
- Pada 22 Oktober, PIN dummy yang diberikan pengguna diverifikasi melalui UI
  existing. Loket menampilkan empat tagihan berjalan; pilihan November
  menampilkan lima, termasuk Mendatang, semua checkbox kosong dan total Rp0.
  Tidak ada transaksi disubmit. Tidak ada PIN/password yang direset atau guard
  yang dilewati. Bukti privat: `output/billing-uat-loket.jpg`.
- Login wali berhasil. Akun meminta pergantian password default melalui aturan
  existing sebelum Tagihan terbuka; pengguna menyelesaikan langkah credential
  sendiri. Kredensial tidak dicatat dalam laporan atau file pengujian.
- Teks KPI diperjelas menjadi item bulanan dan tahunan yang menunggak.
  Next build ulang dan lint file terkait lulus. Bukti layar privat:
  `output/billing-uat-advance-desktop.jpg`.

Untuk menghentikan penerbitan otomatis, set flag kembali `false` atau hentikan
schedule. Record kewajiban, transaksi, dan audit yang sudah dibuat dipertahankan.
Formulir masih dapat mematerialisasi periode pilihan sesuai izin operator.

## UAT cron, pelanjutan cursor, dan preservasi data sandbox

- Cron lima menit nyata pada 10:05 UTC menjalankan batch pertama; outcome `ok`,
  exception kosong, CPU 60 ms, wall time 31.581 ms. Cursor tersimpan di D1 dan
  lease dilepas. Batas wall time diperiksa antarbatches, bukan batas durasi
  setiap query; ini tidak membatasi satu batch ke tepat 20 detik.
- Untuk UAT saja schedule sempat diubah ke per menit. Bukti yang diklaim adalah
  invocation nyata lima menit di atas; propagasi schedule per menit tidak
  dijadikan bukti. Config repository tetap lima menit/default false.
- Cursor nyata itu dilanjutkan dengan handler Worker yang sama melalui
  `getPlatformProxy` dan binding `remote:true` yang dikunci ke demo D1.
  Tidak ada endpoint publik/manual trigger yang ditambahkan. Proxy lokal
  memakai runtime compatibility 2026-06-02; deployed Worker tetap 2026-10-21.
- Run `DAILY:2026-10-21` selesai: 28 created, 8 existing, 34 skipped,
  0 review, 0 failed. Replay setelah COMPLETED menghasilkan IDLE dan snapshot
  run/jumlah kewajiban identik. Penutupan proxy Windows mengeluarkan warning
  socket lokal setelah assertion lulus; hasil D1 diverifikasi ulang via CLI.
- Postflight remote: 48 kewajiban (15 lama + 4 berjalan/1 mendatang dari form
  + 28 otomatis), tetap 4 payments/16 allocations, tidak ada kunci kewajiban
  duplikat, foreign-key check bersih. Tidak ada tagihan AL-BAGHORY maupun
  makan/nyuci SADESA. Kasus historis REVIEW tidak dieksekusi.
- Ekspor akhir dibandingkan dengan backup pada 48 tabel finance/legacy:
  setiap baris lama identik; hanya 33 kewajiban baru yang ditambahkan.
  Integrity check SQLite pada salinan ekspor akhir juga lulus.
- Worker akhirnya dideploy kembali dengan `FINANCE_BILLING_AUTO_ENABLED=false`
  dan cron lima menit (version aeb732a4-3403-400c-a359-ad8432969e1c).
  Production tidak dimutasi atau diaktifkan pada seluruh UAT ini.

Bukti privat di `output/`: `billing-sandbox-cron.jsonl`,
`billing-remote-resume-result.json`, `billing-uat-final-db.json`, dan
`billing-uat-preservation.json`. Jangan commit ekspor database/kredensial.

## Bukti lokal dan batas verifikasi

- `npm run test:finance:billing`: 37 skenario perilaku penerbitan, periode, pembebasan,
  coexistence, pratinjau, concurrency, cursor, guard DB, dan preservasi data.
- `npm run test:finance:billing:d1`: 5 skenario binding D1 lokal Miniflare, issuance tanpa
  Next/session, concurrency, lease UPDATE RETURNING, dan rollback batch nyata.
  Runtime lokal terpasang dibatasi compatibility date 2026-06-02; konfigurasi
  deployment tetap memakai tanggalnya sendiri.
- Regresi finance, operasi, BRI, dan callback evidence; TypeScript; lint file
  yang berubah; serta bundle Worker melalui `wrangler deploy --dry-run`.

Pengujian sintetis lokal berjumlah 99 skenario dan lulus. Deployment sandbox
serta audit preservasi data remote di atas terpisah dari UAT login/tampilan dan
BRI UAT. Pemeriksaan visual halaman Tagihan dengan sesi wali
telah lulus di sandbox; pengujian petugas/Loket dan scheduler dijelaskan
terpisah di atas. Rilis production tetap memerlukan keputusan eksplisit.

Saran commit: `fix(finance): issue billing independently of parent portal access`.

## Optimasi setelah pengukuran UAT, 22 Oktober 2026

Wall budget awal 20 detik membuat invocation nyata hanya memproses tiga santri.
Pada lima menit per pemicu, kapasitas itu belum cukup untuk sekitar 2.500 santri
per hari. Worker diubah menjadi checkpoint satu santri, berhenti antarcheckpoint
pada 875 query atau 270 detik. Anggaran menyisakan satu santri sebelum plafon
D1 paid 1.000 query; pengujian model mengawasi plafon dan interval lima menit.

Penerbitan tidak lagi menjalankan preview engine lengkap lalu mengulang seluruh
validasi engine untuk insert. Jalur preview tetap read-only; jalur penerbitan
langsung ke engine yang memvalidasi dan menulis canonical INSERT OR IGNORE.
Eligibility awal dibaca sekali per santri; engine tetap membaca/memvalidasi
status aktif, billability, dan provider sebelum tiap insert. Bukti pembayaran,
nominal, saldo, dan pembebasan tidak dicache. Test perubahan SADESA di tengah
batch memastikan snapshot awal tidak melewati guard engine.

Model 100 santri yang belum memiliki kewajiban, dengan 300ms per query, mencapai
9 santri / 954 query / 286.200ms per invocation, tanpa kegagalan. Proyeksi nominal
9 x 288 pemicu = 2.592 santri/hari. Ini model bersyarat, bukan bukti beban nyata
2.500 santri production. Latensi lebih tinggi atau kegagalan berkepanjangan dapat
menunda putaran; cursor dan putaran tertua tetap dilanjutkan. Volume/latensi
production harus dipantau saat rollout.

99 uji lokal lulus setelah optimasi, termasuk binding D1 dan regresi pembayaran,
operasi, BRI serta callback. Build yang semula terhalang kuota approval review
pada 21 Oktober dijalankan ulang pada 22 Oktober dan lulus. Deployment akhir
aplikasi sandbox: ad0c1b91-5ba7-48a8-8990-bc9f179135c3; Worker nonaktif:
aeb732a4-3403-400c-a359-ad8432969e1c, cron lima menit.

Uji handler optimasi melalui binding remote demo D1 pada 22 Oktober memproses
10 santri sampai COMPLETED dalam satu invocation: 304 query, 27.452ms,
0 created, 36 existing, 34 skipped, 0 review/failed. Snapshot penuh kewajiban,
payment, allocation, dan wallet ledger sebelum/sesudah identik. Replay IDLE
dan snapshot run juga identik. Hasil dipastikan ulang via CLI serta FK bersih.
Ini uji handler remote eksplisit, bukan invocation cron otomatis; cron nyata
versi awal sudah dibuktikan pada 21 Oktober. Flag deployment tetap false.

## UAT Portal Ortu, 22 Oktober 2026

Pengguna menyelesaikan pergantian password default melalui alur existing.
Halaman Tagihan kemudian terbuka untuk santri dummy yang sama:

- Tagihan rutin Rp420.000: SPP Oktober Rp70.000, EHB Rp100.000, Ekstrakurikuler
  Rp50.000, dan Kesehatan Rp200.000 (tahun ajaran 2026/2027).
- November Rp70.000 ditampilkan di bagian terpisah berlabel Mendatang.
  Tombol Pilih Semua hanya memilih empat tagihan berjalan (Rp420.000),
  checkbox November tetap kosong. Jendela periode mendatang sama dengan Loket.
- Memilih November melalui selector server memuat ulang kewajiban canonical;
  tidak membuat pembayaran atau alokasi. Tidak ada order/checkout disubmit.

Bukti handler optimasi dan postflight privat: `output/billing-optimized-remote-result.json`,
`output/billing-optimized-cli-postflight.json`. UAT tetap tidak mengaktifkan BRI,
menjalankan transfer, ataupun mengubah database production.

UAT tambahan: setelah empat tagihan berjalan dan November dipilih eksplisit,
subtotal pilihan Rp490.000 sementara Tagihan rutin tetap Rp420.000. Tombol
Batal Semua diperbaiki agar menghapus seluruh pilihan, termasuk mendatang yang
dipilih manual. Pilih Semua tetap hanya menambahkan tagihan berjalan/tunggakan.
Test handler React aktual (diambil lewat parser TypeScript) menguji kedua
perilaku; total suite lokal kini 99 skenario. Bukti layar privat:
`output/billing-uat-portal-advance.jpg`.

Kandidat terakhir sudah dideploy ke sandbox (aplikasi version
ad0c1b91-5ba7-48a8-8990-bc9f179135c3), Next build dan lint terkait lulus.
UAT ulang dari reload versi ini: 5 pilihan Rp490.000 menjadi 0 pilihan Rp0
setelah Batal Semua, sementara tagihan rutin tetap Rp420.000. Seluruh checkbox
kosong; tidak ada order/pembayaran disubmit. Bukti akhir:
`output/billing-uat-portal-final.jpg`. UAT tampilan tiga modul selesai;
production tetap memerlukan preflight terbaru serta keputusan aktivasi eksplisit.

## Rollout production yang disetujui, 22 Oktober 2026

Pengguna mengizinkan penerapan production sampai push. Fresh preflight
menemukan ledger 0001/0187–0190, tanpa 0196, dan FK bersih. Backup privat
244 tabel biasa (virtual/shadow FTS dikecualikan) serta bookmark Time Travel
tersimpan di output lokal. Rehearsal pada ekspor production membuktikan seluruh
244 tabel lama identik, FK dan integrity check lulus.

Hanya 0196 diterapkan, beserta entri ledger, memakai guard drift. Sesudahnya
seluruh baris lama pada 48 tabel finance/legacy identik dengan backup;
17.749 kewajiban, 13.074 payments, 13.072 allocations tetap sama. Tidak ada
replay 0191 atau migration pemulihan sandbox ke production.

Preview read-only seluruh 2.485 santri aktif: 1.671 READY, 1.194 EXISTING,
6.402 LEGACY, 410 EXEMPTED, 5.043 SKIPPED, 667 REVIEW, 2.008 FAILED.
Seluruh FAILED adalah tarif UANG_MAKAN Oktober 2026 untuk TA 2 yang belum
dikonfigurasi pada finance_tariffs/override. Tarif tidak diisi dengan asumsi.
REVIEW memiliki bukti pembayaran legacy dan ditahan dari penagihan ulang.
Worker mencatat kegagalan konfigurasi dan kasus pemeriksaan; hanya kandidat
valid yang dapat diterbitkan. Pelengkapan historis tidak dieksekusi.

Migration sudah applied dan dipush terpisah sebelum push aplikasi, sesuai
prosedur manual migration. Workflow tetap menolak push yang membawa migration;
push aplikasi berikutnya memakai pipeline serial sandbox→production yang sama.
99 skenario finance ditambahkan ke job validasi CI. Bank tetap OFF. Worker
penerbitan terpisah memakai DB production saja dan default config false;
aktivasi production adalah override deployment eksplisit setelah aplikasi lulus
release, sesuai izin pengguna. Hentikan penerbitan dengan flag false tanpa
menghapus kewajiban atau riwayat.

Bukti final deployment, status CI, dan batch awal dicatat pada laporan
penyelesaian serta artefak privat output/billing-production-*. Tidak ada secret,
backup data pribadi, atau ekspor database yang dimasukkan ke Git.
