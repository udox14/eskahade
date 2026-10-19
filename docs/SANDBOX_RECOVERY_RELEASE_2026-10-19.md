# Eskahade — paket eksekusi recovery sandbox dan rilis produksi

19 Oktober 2026. Baseline kode: `031e7f3d5878ba81beab443f8d58554af74d2af2`. Exact commit kandidat, hash SQL, hash input build dan seluruh gate final ada pada `release-manifest.json` paket ini. Ini melanjutkan stabilisasi sebelumnya, bukan mengulang inventaris aplikasi.

Tidak ada migrasi, reset, deployment, push/merge, resource baru, perubahan R2/cache/kredensial atau aktivasi BRI/QLola di remote. Pembacaan baru hanya schema, ledger migrasi, konfigurasi menu/CRUD dan agregat jumlah baris demo. Seluruh hasil D1 yang dipakai mencatat `rows_written=0`. Tidak ada export isi database atau identitas/transaksi produksi untuk fixture.

## Kandidat yang dapat dieksekusi

Empat migration baru berada di **subdirektori sandbox khusus**, sehingga tidak masuk urutan migration produksi. Nomor diverifikasi terhadap repo terakhir 0191 serta ledger demo terbaru yang berisi 0187–0191. Operator wajib memeriksa lagi nomor/ledger pada jendela eksekusi; collision atau drift berarti STOP, bukan rename/replay otomatis.

| Urutan | Berkas | Perubahan |
|---|---|---|
| 1 | `migrations/sandbox-recovery/0192_sandbox_missing_module_tables.sql` | 78 tabel modul kosong yang dibutuhkan kode/FK/trigger: akademik, klinik, portal, supervisi, dashboard dan operasional. FTS shadow tables dibuat SQLite sendiri. Tidak menyalin baris produksi. |
| 2 | `0193_sandbox_compatibility_columns.sql` | 40 kolom dengan CHECK/FK/default asli; mapping 19 kolom finance; backfill identitas klinik baru dan sequence berdasar aturan asli 0126. Guard kosong diperiksa sebelum DDL. |
| 3 | `0194_sandbox_indexes_and_integrity.sql` | Index/view/trigger yang diperlukan; unique setoran mempertimbangkan tujuan; tambahan aritmetika wallet dan karantina penyaluran payment yang overallocated. |
| 4 | `0195_sandbox_dictionary_and_menu.sql` | Dictionary klinik/pelanggaran dan 18 konfigurasi fitur yang belum ada, berikut CRUD untuk fitur baru tersebut. Tidak mengubah role/password atau permission existing. |

Dua tabel lama `absensi_guru_kunci` dan `absensi_guru_kunci_log`, beserta indexnya, **sengaja tidak ditambahkan**: tidak ada dependency kode aktif atau FK wajib yang memerlukannya. Sequence kode klinik tetap diperlukan oleh trigger santri. Ini bukan penyamaan seluruh database dengan produksi.

`recovery-plan.json` mengklasifikasikan object/column/FK, dependency, SQL tiap stage dan hash. Perbedaan default `ehb_absensi_pengawas.status` tetap dipertahankan: kode memberi status eksplisit; tidak ada backfill absensi menjadi HADIR. FK existing `absen_malam_v2.override_by` yang berbeda tidak dipaksakan melalui table rebuild. `foreign_key_check` tidak membuktikan FK yang tidak dideklarasikan; batas ini dicatat, bukan disamakan dengan schema produksi. Default/nonfinancial metadata lain dan object demo khusus tetap dipertahankan. Tidak ada rebuild/DROP tabel/data keuangan.

Dua unique index setoran lama yang hanya memuat unit/asrama dan periode diganti sesudah index tujuan-aware dibuat. Ini mengikuti kebutuhan dua tujuan dalam 0116; bukan pelonggaran duplikasi pada `(unit_setor, bulan, tahun, tujuan_setoran)`. Stage berhenti jika unique index baru gagal.

Perbaikan aplikasi tambahan mencakup alias `/dashboard/guru` menuju master aktif `/dashboard/master/wali-kelas`, sehingga link sidebar lama tidak lagi 404. Tujuan tetap memakai guard halaman dan CRUD existing.

Browser juga membuktikan master kelas gagal memuat karena guard database membaca cookie di dalam `unstable_cache`, yang dilarang Next.js. Helper cache baru memilih binding dan memeriksa role **sebelum** callback cache. AsyncLocalStorage meneruskan binding yang sudah diperiksa hanya selama callback, tanpa membaca cookie lagi; namespace key baru memisahkan demo/primary dan meninggalkan cache lama tanpa purge. Master data dan monitoring pimpinan memakai helper yang sama. Guard tester dan kegagalan lookup role tetap fail closed, termasuk pada cache yang sudah hangat. Enam regresi menguji cold/warm cache, outage role, pemisahan dataset, konkurensi dan larangan write tester. Ini memperbaiki dependency aplikasi pada konteks database, bukan mengubah aturan bank atau hak akses.

## Pemetaan 19 kolom finance

Snapshot baru membuktikan: `tabungan_log=0`, `psb_payment_receipt=0`, `upk_pemasukan=0`, `spp_setoran=0`, `pembayaran_tahunan=0`; `spp_log=2`, `santri=9`. Angka ini bukan izin mengasumsikan keadaan tetap sama saat eksekusi.

| Kolom | Dasar / tindakan |
|---|---|
| `psb_payment_receipt.is_void, void_reason, voided_by, voided_at, metode` (5) | Tabel kosong. Default/aspek pembatalan berlaku untuk insert mendatang; tidak mengklasifikasikan receipt historis menjadi TUNAI atau non-void. |
| `tabungan_log.dompet, source, transfer_group_id, auto_rule_id, run_date` (5) | Tabel kosong. Definisi asal 0062 dipertahankan. Tidak mengubah dompet/source transaksi lama. Bila ada satu baris pun, guard STOP dan mapping per-record diperlukan. |
| `upk_pemasukan.lembar_100, lembar_50, nominal_tambahan` (3) | Tabel kosong. Tidak mengarang pecahan kas atau nominal untuk penerimaan historis. |
| `spp_setoran.tujuan_setoran` (1) | Tabel kosong, sehingga tidak menebak penerima setoran lama. CHECK asli dipertahankan. |
| `pembayaran_tahunan.portal_submission_id` (1) | Tabel kosong; FK nullable, tidak membuat bukti portal fiktif. |
| `spp_log.psb_receipt_id, portal_submission_id` (2) | Tidak ada receipt PSB atau submission portal historis (tabel portal belum ada). Nullable tetap NULL; tidak mengarang korelasi. |
| `spp_log.tujuan_setoran` (1) | Atribut baru dihitung memakai predicate asli 0116: Juli + `psb_flow` + tahun masuk yang cocok menuju BENDAHARA_PUSAT, selainnya DEWAN_SANTRI. Tidak match nominal/latest order. Semua kolom lama/hash baris tetap sama. |

Kolom ke-19, `santri.saldo_tabungan`, ditambahkan sebagai **projection baru atas ledger TABUNGAN yang kosong**, sehingga hasil SUM adalah nol. Ini bukan klaim saldo rekening bank atau keputusan atas dana eksternal yang belum dicatat. `saldo_uang_jajan` existing tidak dipindahkan, disalin, di-reset atau dikurangi; ledger finance baru tidak disentuh. Rehearsal memakai saldo jajan existing 777 untuk membuktikan nilainya tetap 777 dan projection baru nol. Jika operator mengetahui dana tabungan di luar ledger, STOP dan buat opening-ledger/evidence plan tersendiri sebelum modul dipakai; jangan memasukkan angka manual ke projection. Tidak ada replay 0062 yang memindahkan/reset saldo. Daftar exact dan gate jumlah 19 tersedia pada `mapping-19-columns.json`.

Semua asumsi empty-source adalah guard SQL yang fail closed, dan `ehb_pengawas` juga wajib kosong sebelum menambahkan default jenis kelamin. Perubahan data sejak snapshot memerlukan pemetaan baru; jangan melonggarkan constraint untuk meloloskannya.

## Discrepancy payment/alokasi

Satu mismatch demo yang sudah diketahui tetap terbuka. Migrasi tidak menaikkan gross, menghapus/mengubah allocation, mengubah status PAID/SETTLED, menghapus reservation, atau mengirim transfer. Trigger karantina menolak INSERT/UPDATE item penyaluran yang sumber payment-nya memiliki total allocation melebihi gross; semua metode memakai tabel yang sama.

Prosedur terpisah yang siap direview:

1. Dalam maintenance, jalankan counts-only, lalu inspeksi internal di konsol privat memakai `scripts/stabilization/recovery-data/conservation-inspection.sql`. Jangan mempublikasikan output detail atau mengambil identitas orang. Periksa reserved/inflight/distributed, koreksi dan referensi evidence.
2. Dengan approval khusus pencatatan kasus, jalankan `record-conservation-case.sql`. Script idempotent hanya membuka `AMOUNT_MISMATCH`, `resolution_action=NONE`, alasan `INTERNAL_OVERALLOCATION_BANK_UNVERIFIED`. `external_amount=0` secara eksplisit menandai evidence eksternal belum tersedia, mengikuti pola internal recovery existing, bukan amount bank. Selisih berasal dari dua nilai internal yang tersimpan, bukan uang baru. Jangan menandai RESOLVED atau MATCHED.
3. Operator menetapkan authoritative evidence payment/order/bank dan hak per item. Approval akses bukti diperlukan jika belum tersedia. Jangan mengambil latest order atau match nominal saja.
4. Jika allocation salah dan belum tersalur, pilih correction/reversal existing yang tepat, dengan approval, idempotency dan audit; jika sudah tersalur, buat recovery case/pengembalian berdasarkan bukti. Jangan mengurangi periode berikutnya. Jika bank instruction masih mungkin dieksekusi, lakukan inquiry/cancel/reject resmi dan tunggu evidence; jangan switch cash atau release reservation.
5. Jika gross internal salah, jangan UPDATE nominal historis. Tetapkan correction/recovery dan bukti sumber; script penyeimbang otomatis memang tidak disediakan karena fakta bank belum tersedia.
6. Ulang conservation predicates, hak dana, wallet dan reserved/distributed; hanya pemilik finance yang boleh menyetujui resolution. Karantina tidak dihapus hanya karena case dibuka. Jangan menambah trigger bypass.

Ketiadaan evidence untuk menyelesaikan mismatch adalah blocker keputusan finance spesifik. Hal itu tidak diubah menjadi nominal tebakan agar rehearsal tampak bersih. Fixture mempertahankan mismatch sintetis serupa dan 21 histori distribution, termasuk PENDING_APPROVAL, agar guard dan preservasi dapat diuji.

## Bukti pengujian dan batasnya

Hasil exact berada di manifest dan `evidence/`. Rehearsal dimulai dari **DDL demo aktual**, bukan mengganti demo dengan schema produksi. Pengujian SQLite memeriksa hash semua kolom lama, guard tabel nonempty, mapping/constraint, ledger migration, replay, rollback kegagalan tengah stage, kasus reconciliation idempotent, wallet/quarantine, FK dan integrity. D1 native menguji seluruh stage melalui `batch()` pada dua binding lokal, dengan injeksi error DDL dan rollback stamp.

Runtime aplikasi adalah build OpenNext pada workerd lokal dengan persistence `.wrangler/sandbox-recovery-candidate/v3`, semua ID all-zero/`remote:false`, tanpa `.env.local` saat preview. Akun/password/PIN dan data transaksi lokal seluruhnya sintetis. BRI inbound/outbound, statement dan QLola tetap nonaktif; hanya metode cash lokal di-enable untuk E2E. Kredensial portal remote **tidak** dibuat atau di-reset otomatis. Jika operator ingin akun wali demo baru, tetapkan santri sintetis yang disetujui dan lakukan enrollment melalui UI setelah schema/deployment; jangan menaruh default password pada SQL rilis.

Batas emulator dicatat: native `PRAGMA quick_check` seluruh DB menghasilkan `SQLITE_NOMEM`. Full `integrity_check` pada rehearsal SQLite dan native quick_check per tujuh tabel inti lulus, begitu pula native foreign_key_check. Hasil per-tabel bukan pengganti bukti integritas seluruh database remote; pemeriksaan aktual oleh operator tetap STOP gate sebelum mutasi/approval. Tidak ada klaim NOMEM berarti database rusak atau sudah diperbaiki.

Rute statis, login/isolasi demo/role, API/private GET/HEAD dan bank-disabled diuji ulang. Bukti browser memisahkan interaksi yang benar-benar dijalankan dari rendering HTTP. Build/TypeScript tidak dianggap E2E. Lint delta wajib nol error baru; backlog lint penuh yang sudah dicatat di rilis sebelumnya tetap terbuka. Empat harness NOT_RUN sebelumnya tetap beralasan, tidak diberi PASS palsu. UAT bank dan smoke remote tidak dijalankan.

Hasil kandidat final: **60 suite PASS, 0 FAIL, 4 NOT_RUN; 13 kasus migrasi SQLite PASS; 16 pemeriksaan D1 native PASS; 159 render halaman dan 60 pemeriksaan HTTP tambahan PASS; TypeScript/build OpenNext PASS; 0 error lint baru.** Sepuluh kasus browser final memiliki nol console error. Master kelas yang sebelumnya kosong kini menampilkan tahun aktif, marhalah dan satu rombel. Kegiatan supervisi sintetis dengan target guru tersimpan dan tetap terlihat setelah refresh; penulisan awalnya terjadi sebelum perbaikan cache, lalu persistensinya diverifikasi pada build final.

Dua sesi transaksi sintetis dipertahankan, masing-masing modal Rp100.000, penerimaan Rp30.000 (SPP Rp20.000 + ledger titipan Rp10.000), penyaluran parsial Rp10.000, dan kas tutup Rp120.000. Sesi terakhir dijalankan ulang penuh pada build cache yang diperbaiki. Postflight native memverifikasi dua payment/alokasi SPP total Rp40.000, dua mutasi titipan total Rp20.000, penyaluran bersih Rp20.000, FK, histori mismatch dan 21 item distribution lama beserta reservation yang tetap utuh. Portal wali menunjukkan saldo Rp20.000 dan riwayat receipt/ledger yang terpisah. Tidak ada uang atau bank nyata yang dipakai.

Konfigurasi permission per-user Supervisi tidak diwariskan secara universal: admin berizin dapat memakai modul, sedangkan role demo tanpa grant explicit tetap ditolak dengan pesan aman. Jika demo harus memperagakan Supervisi, operator perlu menyetujui dan memberi grant melalui pengelolaan akses modul setelah deployment. Seed recovery tidak mengubah izin existing atau memberi `can_manage_all` kepada semua akun.

## Checklist eksekusi sandbox — semua mutasi di bawah masih memerlukan approval

Jalankan dari checkout **exact commit manifest** dengan lockfile. Jangan memakai `d1 migrations apply`: ledger parsial historis tidak menggambarkan semua schema yang pernah dipasang. Jangan menjalankan ulang 0182–0191. Jangan provisioning apa pun jika CLI menawarkan resource baru.

### 0. Preflight, maintenance dan backup

1. Verifikasi account `a170ed4144c00927988a828aa9a41896`, Worker `eskahade-sandbox`, DB/DEMO_DB `677f05ba-9b52-4534-9542-96cc785f25e4`, R2/KV sandbox dan self-reference. STOP jika target berbeda.
2. Approval maintenance/drain yang benar-benar menghentikan penulis aplikasi, cron, bank job dan sesi operator. Tidak ada kill switch global baru yang diasumsikan. Tetapkan pemilik perubahan/recovery dan jangan mengubah credential/permission Cloudflare.
3. Buktikan seluruh flag bank OFF, bukan hanya tidak ada di config. Pertahankan bank OFF sebelum/sesudah setiap stage. Jangan cetak nilai secret.
4. Setelah approval backup, ambil Time Travel bookmark dan export penuh ke penyimpanan privat yang disetujui di luar Git/ZIP rilis. Catat hash, retention dan rehearsal recovery. Backup/restore adalah tindakan operator, belum dijalankan di pekerjaan ini.

```powershell
$Wrangler = 'node_modules/wrangler/bin/wrangler.js'
node $Wrangler d1 time-travel info eskahade-demo-db --json
node $Wrangler d1 export eskahade-demo-db --remote --output $ApprovedPrivateDemoBackup
# STOP jika exit code nonzero; verifikasi isi/hash/bookmark secara privat.
```

5. Ambil snapshot schema/ledger/counts/config terbaru melalui reader allowlist. Reader hanya SELECT dan menolak target ID lain. Gunakan direktori preflight terpisah, jangan mengganti plan/hash baseline di paket.

```powershell
$env:ESKAHADE_RECOVERY_SNAPSHOT_DIR = $ApprovedPreflightDirectory
node scripts/stabilization/read-recovery-snapshot.cjs
node scripts/stabilization/check-recovery-preflight.cjs $PackageEvidenceDirectory $ApprovedPreflightDirectory 1
```

6. Preflight offline tidak membuktikan data utuh. Operator wajib memeriksa private row hashes seluruh kolom lama, FK/quick_check, sums/status/sequences, one VA/order/event, obligation/wallet/cash invariants, serta mismatch yang diketahui. Simpan privately dan bedakan baseline violation dari delta. STOP pada pelanggaran baru atau data pribadi/bank yang belum disetujui untuk diakses.

### 1–4. Penerapan stage berurutan

```powershell
# APPROVAL REQUIRED. Satu command/stage saja, jangan paste semua tanpa gate.
node $Wrangler d1 execute eskahade-demo-db --remote --file migrations/sandbox-recovery/0192_sandbox_missing_module_tables.sql
# Baca ulang snapshot ke direktori stage baru; check ... 2; periksa row hashes/FK/money.
node $Wrangler d1 execute eskahade-demo-db --remote --file migrations/sandbox-recovery/0193_sandbox_compatibility_columns.sql
# Baca ulang snapshot; check ... 3; periksa mapping dan saldo existing tidak berubah.
node $Wrangler d1 execute eskahade-demo-db --remote --file migrations/sandbox-recovery/0194_sandbox_indexes_and_integrity.sql
# Baca ulang snapshot; check ... 4; periksa triggers/unique/FK dan reservation.
node $Wrangler d1 execute eskahade-demo-db --remote --file migrations/sandbox-recovery/0195_sandbox_dictionary_and_menu.sql
# Baca ulang snapshot; check ... 5; periksa roles/CRUD existing hash-identik.
```

SQL menulis stamp ledger di akhir setiap stage dan menolak stage yang sudah tercatat. **Jangan menganggap import remote memiliki atomicity yang sama dengan batch D1 lokal.** Setelah error, timeout, hasil ambigu atau kehilangan koneksi: STOP, simpan hasil dan schema aktual, periksa stamp dan fingerprint. Tidak adanya stamp bukan bukti tidak ada perubahan. Jangan retry file atau melanjutkan stage. Operator membandingkan exact statement yang sudah terjadi dan menyiapkan roll-forward khusus yang direview; tidak ada recovery lewat DROP/rollback histori.

Fingerprint stage dari rehearsal merupakan gate ketat: perbedaan engine/normalisasi DDL pun harus direview, tidak diabaikan otomatis. Sebelum reopen, lakukan seluruh postflight pada data aktual: old-column hashes/counts, data sums/status/foreign keys, constraints dan seluruh 13 invariant; mismatch lama tetap dikarantina. Case opening memerlukan approval tersendiri. Tidak ada seed universal role, bank account, tariff, amount atau credential di stage SQL.

### 5. Deploy sandbox, assets/cache dan smoke

Hanya setelah schema/config/data gates diterima, gunakan build dari **kandidat commit yang sama**. Deploy melalui OpenNext dengan existing bindings; jangan membuat Worker/D1/KV/R2 atau menggunakan preview produksi untuk sandbox.

```powershell
npm ci
npm run build:cf
# APPROVAL DEPLOY REQUIRED:
node node_modules/@opennextjs/cloudflare/dist/cli/index.js deploy --config wrangler.jsonc --env sandbox --keep-vars
```

STOP jika binding/target/provisioning berbeda atau flag bank ON. Verifikasi version/deployment ID dan assets; jangan menyamakan Git commit dengan versi deployed tanpa bukti. `--keep-vars` bukan bukti flags aman.

Smoke berizin: login staf/demo, dashboard, guru alias, kelas/santri, klinik/pengajian/supervisi, POS/cash/report dan portal wali; role read-only/forbidden, malformed input, refresh/logout, hydration/console/network, proof GET/HEAD/no-store, unknown/private R2 prefix dan foto legacy. Transaksi sintetis hanya pada santri/batas nominal sandbox yang secara spesifik disetujui. Jangan menyentuh histori mismatch atau mencoba transfer bank. Enrollment portal baru adalah aksi operator tersendiri. Setelah smoke, putuskan reopen write dan simpan evidence privat yang disanitasi.

## Production — kode yang sama, migration plan berbeda

Jangan menerapkan 0192–0195 sandbox ke produksi yang sudah memiliki object/kolom tersebut. Ambil fresh frozen preflight dan backup privat produksi; review pending **0187 → 0188 → 0189 → 0190** satu per satu sesuai runbook baseline. Kolom 0191 sudah ada: jangan reapply. Jangan memperbaiki ledger dengan memasang ulang histori 0182–0186 atau memakai migrations apply massal. Candidate tetap tidak memuat perubahan protokol bank.

Verifikasi kompatibilitas DEMO_DB sesudah recovery, existing KV/self-service/assets, seluruh bank OFF, dan exact Worker production. Closure R2 produksi masih approval terpisah: origin r2.dev publik pada inspeksi baseline. Deploy media-compatible code terlebih dahulu, uji canary yang disetujui/legacy URLs/cache, baru nonaktifkan public-development URL dan verifikasi denial; jangan menganggap 404 key tebakan membuktikan privasi. Jangan mengubah cache/object/R2 sebagai bagian implicit deployment.

Setelah approval produksi tersendiri:

```powershell
# Exact same code commit as sandbox; root environment targets production.
node node_modules/@opennextjs/cloudflare/dist/cli/index.js deploy --config wrangler.jsonc --keep-vars
```

Smoke produksi memakai akun/nonfinancial read/write yang disetujui; tidak ada transaksi finansial sintetis atau uang nyata sebagai smoke. BRI/QLola live tetap di luar scope: kontrak/UAT, authoritative status/statement, non-STP QLola Signer/cancel dan activation approval terpisah wajib.

## Recovery dan STOP conditions

- Simpan versi Worker/config/flag/binding sebelumnya dan bookmark/hash backup. Rollback Worker hanya dengan keputusan operator; kode lama mungkin memiliki bug yang sudah diperbaiki, sehingga write tetap dibatasi.
- Schema additive dipulihkan lewat roll-forward yang direview; tidak ada DROP/rewrite financial history. Restore D1/bookmark memerlukan approval eksplisit dan analisis aktivitas setelah backup. Restore DB tidak membatalkan instruksi bank yang mungkin sudah dieksekusi.
- STOP pada target/nomor/schema berubah, checksum gagal, source table tak lagi kosong, old-column hash/money berubah, FK/unique/integrity gagal, error/timeout partial-stage, resource creation prompt, flag bank ON, privilege existing berubah, atau bank status belum authoritative. Tidak ada blind retry, cash switch, reservation release atau auto-deduct.

## Satu daftar approval dan blocker tersisa

**Sandbox:** maintenance/drain dan backup privat/recovery rehearsal; penerapan empat stage beserta seed menu baru yang eksplisit; pencatatan case dan keputusan evidence/correction mismatch; deployment/assets dan smoke dengan fixture/akun serta batas transaksi sandbox yang disetujui; enrollment wali bila diinginkan; reopen write oleh pemilik finance/operator.

**Produksi:** maintenance/backup/preflight; penerapan spesifik 0187–0190; kompatibilitas DEMO_DB; privacy closure R2/cache/canary; deployment dan smoke produksi serta keputusan reopen/recovery. Ini approval terpisah dari sandbox.

**Blocker eksternal:** resolusi authoritative mismatch demo dan dana/instruction yang terkait; proses portal credential jika belum ada akun yang sah; evidence privasi R2 produksi; kontrak dan UAT BRI/QLola sebelum aktivasi. Tidak ada fakta bank yang dapat disimpulkan dari build/rehearsal.

Status final dipisahkan: `LOCAL_SANDBOX_REPAIR_READY`, `SANDBOX_REMOTE_REPAIR_PENDING_APPROVAL`, `SANDBOX_DEPLOY_PENDING_APPROVAL`, `PRODUCTION_RELEASE_PENDING_APPROVAL`. Tiga status terakhir bukan klaim sudah dieksekusi. Semua hash/build/test final ada pada manifest.

Referensi teknis yang diperiksa: [SQL/PRAGMA D1](https://developers.cloudflare.com/d1/sql-api/sql-statements/), [D1 batch dan rollback](https://developers.cloudflare.com/d1/worker-api/d1-database/). Dokumentasi transaksi lokal tidak digunakan untuk menjanjikan atomicity import remote.

Referensi cache/runtime: [batas request API dalam unstable_cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache), [AsyncLocalStorage Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/).

Commit message: `fix(sandbox): prepare guarded schema recovery and preserve finance history`.
