# Eskahade — stabilisasi dan paket rilis, 19 Oktober 2026

Laporan ini menggabungkan temuan, perbaikan, bukti pengujian, perbedaan lingkungan, serta runbook sandbox dan produksi. Status final, commit, Git tree, hash source, hash bundle, dan hasil gate dibaca dari `release-manifest.json` dalam paket rilis. Tidak ada push, merge, deployment, migrasi remote, reset demo, perubahan akses R2, atau aktivasi bank dalam pekerjaan ini. Operasi remote yang berhasil adalah pembacaan metadata/configuration dan SELECT; hasil D1 mencatat nol baris ditulis.

## Perbaikan kode

| ID | Masalah yang dibuktikan | Hasil perbaikan dan regresi |
|---|---|---|
| S01 | GET `/api/migrate` dan `/api/update-db` menulis schema/configuration tanpa autentikasi | Kedua endpoint historis mengembalikan 410/no-store tanpa akses DB. Perubahan schema hanya melalui proses migrasi yang direview. |
| S02 | Kegagalan hidrasi pengguna mengembalikan role JWT lama | Sesi gagal tertutup; akun terhapus, role dicabut, atau DB gagal tidak memulihkan hak lama. Bootstrap memeriksa kolom sebelum DDL dan memakai cache per request, sehingga DB produksi dan demo tidak berbagi boolean kesiapan schema. |
| S03 | Guard tester bergantung pada role token lama dan awalan SQL sederhana | Role tersimpan diperiksa per request. Komentar, CTE mutasi, SQL majemuk, ATTACH dan PRAGMA tulis tidak melewati guard. SELECT/CTE baca/introspeksi tetap tersedia. Kegagalan lookup izin halaman juga gagal tertutup. |
| S04 | Form login sebelum hydration mengirim password melalui query string | Form staf dan wali menggunakan POST. Browser benar-benar mereproduksi kasus awal menggunakan kredensial sintetis. Tidak ada password pengguna nyata yang dipakai. |
| S05 | JSON rusak/non-string pada API login menghasilkan 500 | API staf dan wali menolak payload tersebut dengan 400 sebelum akses akun. |
| S06 | Lookup login mengikuti cookie sesi demo; form login dan API memiliki aturan fallback berbeda | Helper bersama memilih DB autentikasi secara eksplisit. Kredensial akun admin di DEMO_DB tidak dapat menghasilkan token admin produksi walaupun ID/email sama. Akun demo wajib diautentikasi dari DEMO_DB dan mendapat penanda asal; perubahan role melintasi batas dataset memerlukan login ulang. |
| S07 | Revoke kartu lama dan insert kartu pengganti terpisah; PIN/audit/token dan hitungan salah tidak atomik | Penggantian kartu memakai satu batch. Pembuatan/reset/unlock PIN dan audit atomik. Sepuluh percobaan paralel mencapai lock tiga percobaan, dengan satu audit LOCK. Verifikasi memakai compare-and-set hash/lock dalam batch penerbitan token atau penggantian PIN. Reset/lock mengakhiri token penarikan yang belum dipakai. |
| S08 | Laporan penyaluran lama memakai metode TRANSFER, mengabaikan draft tanpa transferred_at dan menghitung status belum tersalur sebagai penyaluran | Perubahan lokal yang sudah ada dipertahankan dan diuji: tiga metode aktual, status, tanggal aktivitas, referensi bank yang sebenarnya dan KPI hanya DISTRIBUTED. Filter tanggal menormalkan timestamp D1/ISO dan batas akhir hari eksklusif. Format tanggal mengikuti Jakarta di server/browser. |
| S09 | Fixture regresi bergantung pada kalender saat dijalankan | Suite BRI memakai jam fixture konsisten dengan window statement. Tes absensi tanpa tanggal acuan menguji antrean tiga bulan, tidak menganggapnya satu pekan. Aturan aplikasi tidak dilonggarkan untuk meloloskan tes. |
| S10 | Dua alias BRIVA `/api/v1.0/...` melempar exception konfigurasi tanpa respons JSON terkontrol | Boundary error disamakan dengan canonical handler: General Error tersanitasi/no-store memakai konstanta existing, tanpa financial write. Tidak ada endpoint/signature/versi baru. Kode 5002400/5002500 diverifikasi kembali pada dokumentasi publik BRI tanggal 19 Oktober. |

Tidak ada dependency npm baru, refactor desain, atau perubahan algoritma signature/penyaluran QLola. Perbaikan S07 adalah bug keamanan pada kredensial finance yang sudah menjadi baseline; tidak mengubah alokasi hak dana, settlement, atau protokol bank. Histori kartu/PIN tetap dipertahankan.

Migration 0190 dan 0191 sudah ada saat pekerjaan dimulai. Keduanya tidak diedit. Ledger demo yang dibaca sudah mencatat keduanya serta 0187–0189. Kolom `saldo_uang_jajan` juga sudah ada di produksi: **0191 tidak boleh diterapkan ulang pada kedua target**. Migration 0182–0186 tidak disentuh.

## Cakupan dan arti bukti

Inventaris AST/dependency memetakan halaman, route handler, file server action, fungsi ekspor, guard, SQL dependency dan flag. CSV/JSON dalam `coverage/` adalah matriks per file, bukan klaim bahwa setiap tombol/fungsi sudah diuji dengan setiap kombinasi role. SQL dependency hasil ekstraksi diberi label inferensi dan dibandingkan dengan schema aktual.

| Kelompok modul | Bukti yang dipakai |
|---|---|
| Login, logout, session, tester, demo dan RBAC | Regresi keamanan, request HTTP nyata, serta login dan navigasi browser; konfigurasi fitur/CRUD lokal berasal dari snapshot konfigurasi read-only, bukan grant universal buatan. |
| Dashboard dan navigasi | Rendering HTTP semua halaman statis serta browser pada shell sebenarnya. |
| Santri, guru, kelas, foto | Rendering route/detail/edit, interaksi browser yang dicatat, regresi filter santri/guru dan privasi foto. |
| Akademik, pengajian, absensi, disiplin, supervisi | Rendering halaman serta suite absensi, discipline, pengajian dan supervisi yang menjalankan implementasi sebenarnya pada fixture sintetis. |
| Koperasi/loket, tagihan, payment, allocation, wallet, koreksi | Suite finance/migration, fault injection, browser POS dan pemeriksaan ledger lokal. Tidak ada nominal client yang menjadi sumber kebenaran. |
| Penyaluran/rekening/evidence/rekonsiliasi/laporan | Suite finance/BRI, native D1 batch, laporan dan ekspor; interaksi browser yang tercatat terpisah dari pengujian service. |
| Operasional dan bukti | Rendering serta suite R2 yang menguji route/action sebenarnya, scope unit, ownership, HEAD dan penyimpanan privat. |
| Portal Ortu | Login HTTP nyata, seluruh halaman portal, logout, ownership/privacy regression dan browser. |
| POSKESTREN, PSB, UPK, pimpinan dan modul lain | Seluruh route statis dirender; suite klinis/obat/laporan/manajemen yang tersedia dijalankan. Interaksi browser hanya dinyatakan pada kasus yang benar-benar dicatat. |
| BRIVA, statement dan QLola | Regresi sebelumnya dijalankan kembali; HTTP tanpa credential menguji gagal tertutup dan sanitasi, bukan UAT bank. QLola tetap non-STP/hard-disabled. |

Bukti pengujian utama:

Hasil final lokal: **58 suite PASS, 0 FAIL, 4 NOT_RUN; 159 URL render PASS; 59 pemeriksaan HTTP tambahan PASS; TypeScript dan build OpenNext PASS; 0 error lint baru pada diff**. Lint penuh memiliki 1.874 error existing dan tetap berstatus FAIL. Inventaris mencakup 817 file source, 173 halaman, 26 route handler dan 143 file server action, dengan 16 role dari katalog aplikasi. Daftar role pembuatan akun dan katalog dashboard berbeda; harmonisasi konfigurasi role existing dicatat sebagai backlog terpisah, bukan perubahan izin dalam rilis ini.

E2E browser final memakai akun/santri sintetis pada workerd lokal: PIN valid, pembayaran kas gabungan SPP Rp20.000 dan titipan Rp10.000, penyaluran cash parsial Rp10.000, tutup sesi impas Rp120.000, login wali, saldo/riwayat wali, filter serta detail santri. Top-up **cash** tetap dicatat sebagai ledger titipan tersendiri dalam batch/receipt yang sama; finance payment dan allocation hanya Rp20.000 untuk SPP. Hal ini berbeda dari top-up online BRI yang melewati payment/allocation. Pemeriksaan SQL lokal memastikan conservation dan nol pelanggaran FK. Dua percobaan awal penyaluran berhenti karena dictionary penerima/metode belum disertakan pada fixture schema-only; dictionary sintetis dilengkapi, batch gagal tidak mencatat distribusi, dan percobaan final menghasilkan tepat satu distribusi. Tidak ada transaksi bank atau uang nyata.

- Semua suite lokal aman yang ditemukan runner dijalankan; hasil final berada di `verification/regression/results.json`. Runner tidak menjalankan seed/UAT mutasi remote.
- `verification/d1-native-batch.json`: 12 kasus/97 query guard finansial pada workerd/D1 lokal, bukan Cloudflare D1 remote.
- `verification/credentials-native.json`: empat kasus fungsi kredensial sebenarnya pada batch D1 native, termasuk konkurensi dan rollback.
- `verification/http-smoke.json`: seluruh URL statis yang diuji. Hasil HTTP 200 berarti render berhasil, bukan seluruh interaksi/hydration.
- `verification/http-additional.json`: validasi input, sesi/role, route dinamis, privasi GET/HEAD, bank nonaktif, isolasi demo dan seluruh portal.
- Bukti browser, screenshot dan pemeriksaan integritas lokal dicatat tersendiri. Kasus yang belum dijalankan tidak diberi PASS.
- `verification/build-release-result.json` dan hash input sebelum/sesudah mengikat build Next.js webpack/OpenNext pada source yang sama. Peringatan dukungan Windows OpenNext tetap dicatat; runtime workerd lokal diuji secara terpisah.
- Lint repository **masih FAIL karena backlog existing** (terutama `any`, require CommonJS dan pola React lama). `lint-delta.json` membandingkan file berubah terhadap HEAD awal; perbaikan ini tidak boleh menambah error lint. Lint lama tidak dinonaktifkan untuk memberi PASS palsu. Artefak arsip/generated dikecualikan dari lint dan TypeScript.

Empat entry runner NOT_RUN dijelaskan, bukan disembunyikan: UAT D1 remote yang melakukan mutasi; dua fixture UI mandiri yang memakai harness terpisah; serta entry D1 SQLite lama yang memiliki path bukti historis. Pengujian aplikasi browser dan D1 native terbaru dicatat sebagai bukti tersendiri, bukan relabeling suite-suit tersebut.

Backlog minor yang tidak mengubah gate integritas/security: link sidebar legacy `Guru` menuju `/dashboard/guru` menghasilkan 404; halaman master aktif berada di `/dashboard/master/wali-kelas` melalui menu `Guru & Jadwal`. Harmonisasi link/config tersebut dan katalog role dicatat untuk pekerjaan lanjutan. Lint legacy juga tetap terbuka. Cakupan browser ini tidak dianggap sebagai pengujian seluruh tombol CRUD pada semua modul/role.

## Lingkungan dan blocker faktual

Target produksi tetap Worker `eskahade`, D1 `a2010f08-f314-46af-88fd-dbb9b4ef1bb1`, KV produksi dan R2 `eskahade-foto`. Sandbox tetap Worker `eskahade-sandbox`, DB/DEMO_DB `677f05ba-9b52-4534-9542-96cc785f25e4`, KV sandbox dan R2 `eskahade-sandbox-foto`. Rehearsal lama tidak dipakai atau diubah. Local test memakai ID all-zero, penyimpanan lokal dan credential sintetis; `.env.local` tidak dimuat pada preview final.

Snapshot schema produksi memiliki 248 entry tabel; demo 165. Selisih meliputi lima shadow table FTS yang dibuat otomatis: rencana kandidat memetakan **80 tabel logis dan 40 kolom** yang belum ada di demo. **19 kolom historis finance memerlukan pemetaan bukti**, bukan default saldo nol, metode tunai, dompet atau penerima yang diasumsikan. Definisi tabel/kolom/index/view/trigger tersedia dalam draft per modul; rehearsal hanya membuktikan sintaks pada schema kosong, bukan kompatibilitas data remote.

Ledger produksi hanya mencatat 0001 meski schema aktual membuktikan migrasi manual lain. Jangan menggunakan `d1 migrations apply`. Produksi memerlukan review/penerapan spesifik 0187–0190. Demo sudah mencatat 0187–0191; jangan mengulangnya. Perbedaan constraint yang sudah ada tidak otomatis diganti dengan definisi produksi.

Tiga belas pemeriksaan invariant read-only memberi nol pelanggaran pada snapshot produksi. Pada demo ada satu payment yang total alokasinya tidak sesuai pokok. Detail terbatas ada pada berkas review privat lokal, tidak dibundel sebagai data rilis. Tidak ada koreksi otomatis atau reset. Data produksi dapat berubah antara SELECT karena layanan tidak dibekukan: bukti ini bukan snapshot transaksi konsisten untuk jendela deployment.

Metadata deployment terbaru dipilih berdasarkan timestamp, bukan posisi array. Versi/deployment tersimpan dalam `environment/*-deployed-current.json`. Tidak ada anotasi Git immutable yang membuktikan pemetaan versi remote ke commit; pemetaan Git deployed tetap UNVERIFIED. Tidak ada klaim candidate ini telah dideploy.

R2 produksi: akses publik `r2.dev` **aktif**, tanpa custom domain pada inspeksi terakhir. R2 sandbox: `r2.dev` nonaktif dan tidak ada custom domain. Penutupan produksi belum dilakukan. Guard route aplikasi tidak menutup akses langsung bucket. Legacy foto/avatar/dashboard tetap memakai allowlist origin yang sudah ada; unknown/private prefixes gagal tertutup. Direct-proof canary, cache exposure dan smoke media deployed setelah closure tetap gate tersendiri.

## GO / NO-GO

| Gate | Keputusan eksekusi remote |
|---|---|
| A — Sandbox demo | NO-GO sampai schema modular, pemetaan data historis, satu discrepancy demo dan smoke setelah deployment disetujui/diselesaikan. |
| B — Produksi internal, BRI/QLola nonaktif | NO-GO sampai backup/recovery, preflight beku, 0187–0190, kompatibilitas routing DEMO_DB, privasi R2, dan deployment/smoke lulus. Hasil lokal tidak berarti produksi READY. |
| C — BRI/QLola live | NO-GO. Kontrak onboarding, canonical paths/identity, token entitlement, status inquiry/recovery, authoritative statement identity, non-STP QLola/Signer/cancel evidence dan UAT masih memerlukan BRI. Tidak ada aktivasi dalam rilis ini. |

`LOCAL_CODE_READY`, `SANDBOX_DEPLOYED_VERIFIED`, dan `PRODUCTION_DEPLOYED_VERIFIED` ditulis secara terpisah di manifest final. Keduanya yang berhubungan dengan deployment hanya boleh benar setelah deployment dan smoke benar-benar terjadi.

## Runbook terpadu — hanya rencana, semua mutasi memerlukan persetujuan

### 1. Identitas, backup dan persiapan

1. Checkout commit persis dari manifest di lingkungan operator yang disetujui, gunakan lockfile dan runtime/version yang tercatat. Verifikasi SHA256 paket/source dan diff. Jangan menyalin `.env`, credential fixture atau data sintetis ke remote.
2. Verifikasi account/Worker/D1/KV/R2/self-service target secara eksplisit. Ambil metadata deployment terbaru dan sebelumnya. Pastikan semua flag bank nonaktif; jangan mencetak secret. Commit Git tidak boleh disamakan dengan versi Cloudflare tanpa bukti.
3. Setelah persetujuan jendela perubahan, hentikan/drain mutasi aplikasi terkait dan worker terjadwal. Tidak ada kill switch global baru yang diasumsikan. Konfirmasikan cara maintenance oleh operator; jika tidak tersedia, STOP.
4. Ambil bookmark Time Travel dan export lengkap masing-masing database ke penyimpanan privat terenkripsi di luar Git/paket rilis. Verifikasi file/hash, retention, izin restore serta rehearsal pemulihan. Backup produksi dan demo terpisah. Metadata backup boleh diringkas; data/nominal/detail orang tidak dimasukkan paket.

```powershell
# PLAN ONLY — jalankan hanya setelah target, direktori privat dan jendela disetujui.
$Wrangler = 'node_modules/wrangler/bin/wrangler.js'
node $Wrangler d1 time-travel info eskahade-db --json
node $Wrangler d1 export eskahade-db --remote --output $ApprovedPrivateProductionBackup
node $Wrangler d1 time-travel info eskahade-demo-db --json
node $Wrangler d1 export eskahade-demo-db --remote --output $ApprovedPrivateDemoBackup
# Periksa exit code setelah setiap command; STOP pada kegagalan.
```

5. Dalam kondisi beku, rekam schema lengkap, FK/quick_check, row count, hash seluruh kolom lama, private sums/status/sequence, money integer/range, unique VA/order/event, outstanding reservations, wallet/obligation projections dan 13 conservation predicates. Bedakan pelanggaran awal dari perubahan stage. Salin config fitur/CRUD dan inventaris legacy URL counts-only. Jangan memperbaiki data agar preflight tampak lulus.

### 2. Perbaikan sandbox

1. Verifikasi kembali bahwa DB sandbox masih ID demo yang ditentukan; jangan menjalankan perbaikan pada production/rehearsal.
2. Jangan mengulang 0182–0191 yang sudah ada atau menjalankan reset. Review `schema-repair-plan/sandbox-plan.json`, dependency lintas modul dan raw CHECK/FK/trigger. Draft SQL bukan izin eksekusi dan bukan migrasi baru yang sudah disahkan.
3. Tentukan pemetaan 19 kolom finance secara eksplisit berdasarkan histori/evidence. Selidiki payment demo yang mismatch, termasuk hak alokasi yang sudah reserved/distributed. Gunakan correction/recovery yang disetujui; jangan mengubah gross amount atau menghapus allocation untuk memaksakan keseimbangan.
4. Setelah approval per modul, beri nomor migrasi baru berdasarkan ledger/repo terbaru, buat perubahan additive spesifik dan rehearsal pada salinan privat yang disetujui. Seed dictionary/configuration yang diperlukan direview terpisah; tidak menyalin identitas/transaksi produksi.
5. Terapkan stage yang disetujui satu per satu. Sesudah masing-masing stage: cocokkan delta schema, row hash kolom lama, counts, FK, CHECK/index/trigger dan invariants. STOP jika berbeda, jangan retry file lengkap setelah partial execution.

### 3. Migrasi produksi

Prasyarat: produksi cocok dengan schema/reference awal yang direview, backup/recovery terbukti, semua write drained, dan routing demo juga kompatibel. Hanya file berikut yang direncanakan; cek hash dari manifest dan exit code/hasil setelah **setiap file**.

```powershell
# PLAN ONLY — APPROVAL REQUIRED, jangan mengganti dengan migrations apply.
node $Wrangler d1 execute eskahade-db --remote --file migrations/0187_finance_controlled_remediation.sql
node $Wrangler d1 execute eskahade-db --remote --file migrations/0188_bri_evidence_guards.sql
node $Wrangler d1 execute eskahade-db --remote --file migrations/0189_finance_snapshot_and_reporting.sql
node $Wrangler d1 execute eskahade-db --remote --file migrations/0190_retire_removed_finance_sidebar.sql
# 0191 DILARANG di target yang sudah memiliki saldo_uang_jajan.
```

Verifikasi 0187, lalu 0188, lalu 0189, lalu 0190; jangan mengeksekusi empat command tanpa checkpoint. Seluruh kolom lama/uang/histori harus tetap sesuai baseline beku. Tabel baru kosong, view compile, FK=0 dan conservation tidak memburuk. Jangan menulis ledger applied palsu untuk migrasi manual lama. Jika sesuatu sudah applied di luar snapshot ini, STOP dan petakan ulang.

### 4. Deployment kedua lingkungan

Build kandidat dari commit yang sama, pin hash worker/assets, dan verifikasi input build tidak berubah. Reproduksi build dari lockfile bila diperlukan; jangan rebuild diam-diam sebagai bagian deploy. Perintah berikut memodifikasi Worker/assets dan mengisi cache KV sesuai OpenNext; kedua efek memerlukan persetujuan eksplisit.

```powershell
# PLAN ONLY — APPROVAL REQUIRED; gunakan artefak yang hash-nya sudah direview.
node node_modules/@opennextjs/cloudflare/dist/cli/index.js deploy --config wrangler.jsonc --env sandbox --keep-vars
# Sesudah sandbox smoke PASS dan approval produksi TERPISAH:
node node_modules/@opennextjs/cloudflare/dist/cli/index.js deploy --config wrangler.jsonc --keep-vars
```

Pastikan `--env sandbox` hanya dipakai pada command sandbox; produksi memakai root config. `--keep-vars` bukan bukti flag aman: cocokkan semua flag aktual setelah deploy. Tidak ada resource Worker/D1/KV/R2 baru yang boleh dibuat otomatis. Jika CLI menawarkan provisioning atau binding/config berubah, STOP. Pertahankan blok mutasi selama schema/code/privacy belum serasi.

### 5. Privasi R2 dan smoke

Sesudah application-media code yang kompatibel terpasang, review canary publik yang memang disetujui dan URL legacy. Dengan approval closure terpisah, nonaktifkan public-development URL produksi, pastikan tidak ada custom domain lain, dan verifikasi denial atas canary yang diketahui ada. 404 dari key tebakan bukan bukti privasi. Jangan mengambil proof nyata untuk smoke. Penanganan cache lama memerlukan keputusan terpisah; jangan menghapus/memindah object secara otomatis.

```powershell
# READ ONLY; closure berikut tetap memerlukan approval tersendiri.
node $Wrangler r2 bucket dev-url get eskahade-foto
node $Wrangler r2 bucket domain list eskahade-foto
# APPROVAL REQUIRED, setelah media compatibility PASS:
node $Wrangler r2 bucket dev-url disable eskahade-foto
node $Wrangler r2 bucket dev-url get eskahade-foto
```

Hanya setelah bukti privat/legacy benar-benar terlindungi, operator boleh menetapkan `FINANCE_PROOFS_PRIVATE_STORAGE_CONFIRMED=true` melalui perubahan config yang disetujui. Flag itu tidak ditetapkan pada remote dalam pekerjaan ini.

Smoke pada masing-masing environment: periksa deployment/version/bindings, anonymous login redirect, login/logout staf dan wali yang disetujui, role tanpa izin, halaman santri/guru/kelas, POS/sesi kas, status pembayaran, report/filter/Excel, operational proofs dan foto legacy. Uji denied GET/HEAD/private cache, form validation, refresh, hydration/console dan failed network. Pastikan BRIVA/statement/QLola nonaktif. Sandbox boleh memakai fixture/transaksi sintetis hanya jika perubahan data tersebut disetujui; **produksi tidak memakai tes tulis finansial sintetis atau transaksi nyata sebagai smoke**. Reopen mutasi hanya sesudah operator menerima hasil dan semua gate wajib lulus.

### 6. Rollback / recovery

- Simpan versi Cloudflare sebelumnya beserta snapshot config/bindings/flag dan hash artefak. Rollback Worker memakai versi tersebut hanya setelah keputusan operator. Jangan menganggap Git parent adalah versi deployed sebelumnya.
- Worker lama mengandung jalur yang sudah diperbaiki: rollback bukan izin membuka write. Pertahankan maintenance dan seluruh bank kill switch.
- Perubahan schema additive tidak dibalik dengan DROP, edit migration applied atau rewrite histori. Utamakan roll-forward yang direview.
- Restore D1/bookmark hanya dengan approval eksplisit, setelah mengamankan aktivitas sesudah backup dan menilai dampaknya. Restore sistem tidak membatalkan transaksi yang mungkin sudah dieksekusi bank; reconciliation tetap diperlukan. Jangan retry transfer, menghapus reservation, atau switch cash ketika hasil bank belum authoritative.
- Jika stage parsial, preserve error/schema actual/bookmark dan hentikan urutan. Jangan mengulang semua migration atau reset demo.

## Satu daftar persetujuan yang tersisa

1. Jendela maintenance/drain, backup privat dan rehearsal recovery untuk setiap target.
2. Schema/data repair sandbox per modul, pemetaan 19 kolom dan satu discrepancy; serta seed konfigurasi/demo yang spesifik bila diperlukan.
3. Penerapan produksi 0187–0190 setelah preflight beku; tanpa reapply 0182–0186/0191.
4. Deployment sandbox beserta assets/KV population, smoke dan fixture tulis sintetis yang disetujui.
5. Closure R2 produksi dan penanganan cache/domain/canary; kemudian penetapan privacy-confirmation flag jika terbukti.
6. Deployment produksi beserta smoke nonfinansial, keputusan reopen write dan pemilik rollback.
7. Aktivasi BRI/QLola bukan bagian approval di atas: kontrak/UAT/non-STP Signer dan keputusan aktivasi terpisah tetap wajib.

Referensi protokol yang diperiksa ulang: [BRIVA Online SNAP BI BRI](https://developers.bri.co.id/id/snap-bi/apidocs-virtual-account-briva-online-snap-bi). Redirect streaming diverifikasi terhadap [referensi Next.js](https://nextjs.org/docs/app/api-reference/functions/redirect); HTTP 200 dengan meta/NEXT_REDIRECT tidak dianggap sebagai keberhasilan akses role terlarang.

Commit message yang sesuai pekerjaan ini: `fix(stability): isolate login datasets and harden financial credentials`; perbaikan report/schema history dan paket bukti dapat memakai commit terpisah sesuai manifest. Tidak ada klaim fase BRI live selesai atau diaktifkan.
