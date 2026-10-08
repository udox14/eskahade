# AGENTS.md

## 1. Tujuan

File ini adalah instruksi wajib untuk AI/developer yang mengerjakan repository Eskahade, terutama **Sistem Keuangan Baru dan integrasi BRI**.

Jangan menganggap task finansial sebagai CRUD biasa.

Prioritas tertinggi:

1. integritas uang;
2. keamanan;
3. idempotency;
4. auditability;
5. business rule;
6. kompatibilitas dengan codebase;
7. UI/UX.

Keberhasilan build **bukan** bukti bahwa perubahan finansial benar.

---

# 2. Dokumen yang Wajib Dibaca

Untuk semua task Sistem Keuangan Baru, baca bagian relevan dari:

1. `docs/SISTEM_KEUANGAN_BARU_PRD.md`
2. `docs/BRI_INTEGRATION_PRD.md`
3. `docs/UI_UX_GUIDELINES.md`
4. `docs/IMPLEMENTATION_PLAN.md` jika masih relevan
5. codebase/migration existing yang terkait task

Jika file BRI PRD diletakkan dengan nama/lokasi berbeda, cari file dengan judul:

> Integrasi BRIAPI, BRIVA Online, QLola & Penyaluran Dana

## 2.1 Source of Truth Priority

Jika ada konflik:

1. **`BRI_INTEGRATION_PRD.md`** menang untuk:
   - BRI;
   - BRIVA;
   - payment online;
   - fee bank;
   - admin Koperasi;
   - settlement bank;
   - QLola;
   - penyaluran terintegrasi;
   - penghapusan Duitku.

2. **`SISTEM_KEUANGAN_BARU_PRD.md`** menang untuk business rule finance umum yang tidak diubah BRI PRD.

3. **Dokumentasi/kontrak resmi BRI yang berlaku saat implementasi** menang untuk detail:
   - endpoint;
   - signature;
   - header;
   - field;
   - error code;
   - timeout;
   - credential;
   - limit;
   - security requirement.

4. `UI_UX_GUIDELINES.md` menang untuk pola UI/UX.

5. Existing code adalah source of truth untuk pola teknis **hanya jika tidak bertentangan dengan PRD**.

Jangan diam-diam mengubah requirement agar cocok dengan code lama.

---

# 3. Keputusan Arsitektur yang Sudah Final

Jangan membuka kembali keputusan ini tanpa instruksi eksplisit user.

- Provider online aktif: **BRI saja**.
- Duitku: **retired/dihapus dari sistem aktif**.
- QRIS Duitku: **dihapus**.
- Setiap santri billable: **1 Fixed BRIVA permanen**.
- Rekening collection: **1 rekening Koperasi BRI**.
- Fee BRI: ditanggung wali sesuai kontrak BRI.
- Admin operasional Koperasi: **terpisah**, configurable, hak Koperasi.
- `PAID != SETTLED`.
- Settlement/reconciliation menggunakan sumber bank authoritative seperti Bank Statement.
- Distribution recipient:
  - Pesantren;
  - Katering;
  - Laundry.
- Distribution method:
  - `BRI_QLOLA`;
  - `CASH`;
  - `MANUAL_TRANSFER`.
- BRI/QLola distribution **WAJIB non-STP**.
- Petugas mengajukan; Signer mengapprove di QLola.
- Cash/manual tetap ada.
- Uang Jajan tetap dana titipan.

---

# 4. Financial Model

Pertahankan pemisahan:

`Obligation → Payment Order → Payment → Allocation → Settlement → Distribution`

Pisahkan juga:

- Refund;
- Reversal;
- Void;
- Correction;
- Uang Jajan Ledger;
- Cash Session;
- Reconciliation;
- Gateway Event;
- QLola/Bank Transfer Instruction.

Jangan membuat satu tabel `transactions` besar yang menghilangkan makna finansial.

---

# 5. Aturan Uang

1. Semua nominal internal disimpan sebagai **integer Rupiah**.
2. Jangan memakai floating point untuk accounting.
3. Payload BRI yang menggunakan string decimal harus dikonversi secara eksplisit dan aman.
4. Nominal frontend tidak authoritative.
5. Server menghitung ulang:
   - obligation amount;
   - installment balance;
   - cooperative admin fee;
   - total order;
   - distribution amount.
6. Jangan menerima nilai negatif.
7. Jangan membulatkan uang diam-diam.

---

# 6. Admin Koperasi vs Fee BRI

Ini adalah invariant penting.

## Admin Koperasi

- pendapatan Koperasi;
- configurable;
- snapshot pada order;
- sekali per online checkout secara default;
- masuk perhitungan internal Eskahade;
- bukan fee BRI;
- tidak didistribusikan ke Pesantren/Katering/Laundry.

## Fee BRI

- biaya layanan bank;
- mengikuti kontrak;
- bukan pendapatan Koperasi;
- jangan hardcode Rp2.000/Rp1.500/dll;
- jangan jadikan obligation;
- jangan alokasikan ke item pembayaran;
- jika BRI memberikan fee metadata, simpan dengan semantics yang jelas.

Jangan pernah menjumlahkan dua konsep ini sebagai satu `gateway_fee` tanpa definisi yang tegas.

---

# 7. Fixed BRIVA

## 7.1 Invariant

- satu santri billable maksimal satu Fixed BRIVA aktif;
- VA unik;
- VA tidak berpindah antar-santri;
- VA bukan dynamic checkout VA;
- VA inactive tidak otomatis dihapus.

## 7.2 Non-Billable

Patuhi helper existing:

- `isAsramaBebasTagihan`
- `assertSantriBillable`
- `isSantriBebasItem`
- `assertSantriBillableUntukItem`
- predicate SQL terkait

AL-BAGHORY:
- tidak punya VA;
- tidak punya payment online.

SADESA:
- bebas UANG_MAKAN dan UANG_NYUCI;
- tetap dapat memiliki VA untuk item lain.

Jangan duplikasi logic non-billable di banyak file.

---

# 8. Payment Order

## 8.1 Satu Active Online Order

Enforce:

> maksimum satu Payment Order BRI `PENDING/ACTIVE` per santri.

Jika order baru dibuat:

- order lama harus diganti/cancel/expired sesuai policy;
- jangan meninggalkan dua order online aktif.

Gunakan database constraint/index/transaction bila memungkinkan, bukan hanya pengecekan frontend.

## 8.2 Order Snapshot

Order menyimpan snapshot:

- item;
- amount;
- cooperative admin fee;
- total internal charged;
- Fixed VA;
- effective config;
- timestamps.

Perubahan tarif/admin setelah order dibuat tidak mengubah order lama.

---

# 9. BRI Protocol Rules

## 9.1 Jangan Menebak Protokol

Sebelum implementasi endpoint BRI:

1. buka dokumentasi resmi BRIAPI terbaru;
2. cocokkan versi produk yang diaktifkan untuk Koperasi;
3. cocokkan sample/Postman resmi jika ada;
4. cocokkan UAT requirement.

Dilarang:

- copy adapter Duitku dan rename `BRI`;
- memakai algoritma signature berdasarkan ingatan;
- mengarang field;
- mengarang endpoint;
- mengarang response code;
- mengarang retry policy.

## 9.2 Cryptography

Gunakan algoritma tepat sesuai BRI.

Private key:

- server-side only;
- Cloudflare Secret;
- tidak masuk Git;
- tidak masuk D1;
- tidak di-log.

Public key/certificate mengikuti onboarding BRI.

## 9.3 Time

Perhatikan:

- ISO8601;
- timezone;
- clock skew;
- expiry;
- timestamp signature.

Jangan memakai string waktu lokal tanpa timezone untuk protokol bank bila spesifikasi meminta offset.

---

# 10. Cloudflare Stack

Pertahankan stack existing:

- Next.js;
- OpenNext;
- Cloudflare Workers;
- `nodejs_compat`;
- D1;
- KV;
- R2.

Jangan pindah hosting hanya karena integrasi bank.

Gunakan kemampuan `node:crypto`/Web Crypto yang tersedia.

Jika BRI secara kontraktual mewajibkan static outbound IP:

- dokumentasikan bukti requirement;
- jangan refactor seluruh app;
- gunakan egress bridge minimal jika perlu.

Jangan menambah VPS berdasarkan asumsi.

---

# 11. Secrets

Contoh secret:

- BRI client ID;
- client secret;
- private key;
- certificate private material;
- token credentials.

Dilarang berada di:

- `.env` yang committed;
- `wrangler.jsonc`;
- frontend env `NEXT_PUBLIC_*`;
- D1 plaintext;
- log;
- test snapshot;
- issue/PR description.

Gunakan Wrangler/Cloudflare secrets.

Sandbox dan production credential harus terpisah.

---

# 12. Inbound BRIVA

Urutan minimum:

1. read raw request jika dibutuhkan signature;
2. verify signature/auth;
3. validate timestamp;
4. validate mandatory fields;
5. idempotency;
6. resolve VA/customer;
7. billability guard;
8. correlate order;
9. validate amount;
10. atomic financial write;
11. event log sanitized;
12. response resmi.

Jangan melakukan financial write sebelum signature valid.

---

# 13. Idempotency

Payment event harus idempotent.

Gunakan identifier resmi BRI, misalnya yang tersedia:

- `trxId`;
- `paymentRequestId`;
- `X-EXTERNAL-ID`;
- official reference number.

Jangan hanya mengandalkan in-memory check.

Gunakan:

- unique database constraints;
- transactional insert/check;
- deterministic event key.

Duplicate callback harus menghasilkan response aman tanpa double posting.

---

# 14. Atomicity

Operasi berikut wajib atomik:

- Payment + Allocation;
- Payment + wallet top-up;
- obligation balance update;
- order status update jika satu unit transaksi;
- cooperative admin posting;
- distribution item reserve/commit;
- correction.

Jika satu step gagal, jangan meninggalkan state setengah jadi.

Audit kemampuan D1 `batch()`/transaction pattern existing sebelum implementasi.

---

# 15. Ambiguous Payment

Jangan pernah menebak.

Jika tidak dapat menemukan order yang authoritative:

- record payment sesuai evidence bank;
- `allocation_status = UNALLOCATED`;
- create reconciliation item;
- tampilkan ke user berwenang.

Dilarang:
- memilih latest order hanya karena paling baru bila ada ambiguity;
- match hanya berdasarkan amount jika ada lebih dari satu candidate;
- silent drop payment.

---

# 16. PAID != SETTLED

`PAID`:
- payment confirmation/status BRI valid.

`SETTLED`:
- sudah matched dengan evidence bank/reconciliation.

Jangan menandai `SETTLED` langsung dari callback BRIVA kecuali requirement bank diubah secara eksplisit dan PRD direvisi.

Bank Statement/reconciliation harus menjadi lapisan terpisah.

---

# 17. Bank Statement

Gunakan versi API yang benar-benar diaktifkan BRI.

Saat scheduling/inquiry:

- ikuti rekomendasi interval BRI;
- hindari EOD jika dokumentasi mengatakan demikian;
- gunakan pagination/window aman;
- simpan cursor/reference bila relevan;
- query tidak boleh menyebabkan duplicate settlement.

Matching gunakan beberapa signal authoritative.

Jangan hanya match nominal.

---

# 18. Payment Recovery

Jika request/callback timeout:

**JANGAN retry finansial secara buta.**

Urutan:

1. mark status pending/unknown;
2. gunakan Transaction Status Inquiry;
3. gunakan Bank Statement bila perlu;
4. resolve berdasarkan evidence;
5. baru lanjut/retry jika aman.

Prinsip ini berlaku untuk incoming payment dan outgoing distribution.

---

# 19. Duitku Retirement

Duitku tidak lagi provider aktif.

Saat fase cleanup:

- search seluruh repo case-insensitive:
  - `duitku`;
  - `DUITKU`;
  - `DUITKU_VA`;
  - `DUITKU_QRIS`;
- audit:
  - `lib/finance`;
  - `app/api`;
  - Portal Ortu;
  - report/export;
  - settings;
  - dashboard/history;
  - settlement;
  - reconciliation;
  - type definitions;
  - tests;
  - env/config.

Remove active code/config/UI references.

### Jangan Edit Applied Migration Lama

Migration historis boleh tetap menyebut Duitku.

Jangan rewrite file migration yang sudah pernah applied.

Buat migration baru untuk schema/check constraints.

### Tidak Perlu Backward Compatibility Duitku

Karena tidak ada payment produksi Duitku pada Sistem Keuangan Baru:

- jangan membangun dual provider;
- jangan mempertahankan branch aktif Duitku “untuk jaga-jaga”;
- jangan membuat abstraction multi-gateway yang kompleks tanpa kebutuhan.

Tetap pertahankan separation layer antara core finance dan BRI adapter agar protokol bank tidak bocor ke core.

---

# 20. Database & Migration

Sebelum migration:

1. audit migration terakhir di repo;
2. cek `d1_migrations` remote;
3. jangan menebak nomor migration;
4. audit CHECK constraints existing;
5. audit data faktual;
6. buat backup/preflight plan bila perubahan besar;
7. jangan edit applied migration;
8. gunakan additive/new migration.

SQLite/D1 CHECK constraint sering membutuhkan table rebuild.

Jika rebuild:

- create new table;
- copy data dengan transformasi tervalidasi;
- verify row count;
- swap table;
- recreate indexes/triggers;
- test FK/invariants.

Jangan DROP data finansial tanpa eksplisit requirement.

---

# 21. Distribution Model

Allocation menentukan hak dana.

Default:

- SPP → Pesantren
- USPP → Pesantren
- EHB → Pesantren
- Ekstrakurikuler → Pesantren
- Kesehatan → Pesantren
- UANG_MAKAN → Katering
- UANG_NYUCI → Laundry
- Admin Koperasi → tetap Koperasi
- UANG_JAJAN → dana titipan, tidak didistribusikan

Jangan hardcode provider Katering/Laundry jika sudah ada `master_jasa`.

---

# 22. Distribution Methods

Supported:

- `BRI_QLOLA`
- `CASH`
- `MANUAL_TRANSFER`

Semua lewat Distribution Engine yang sama.

Jangan membuat perhitungan hak dana terpisah untuk tiap metode.

---

# 23. BRI/QLola Safety

Ini invariant paling penting untuk outgoing money.

## 23.1 Non-STP

**Dilarang membuat tombol Eskahade langsung mengeksekusi final transfer tanpa Signer.**

Target:

`Eskahade submit → PENDING_APPROVAL → QLola Signer → bank execute`

Jika interface BRI yang tersedia ternyata hanya STP/direct transfer:

- jangan diam-diam menggunakannya;
- laporkan conflict;
- cari interface Cash Management/H2H yang mendukung approval;
- tunggu keputusan user/BRI.

## 23.2 QLola Interface

Jangan berasumsi endpoint `Intrabank Transfer` publik otomatis masuk approval QLola.

Implementasikan adapter hanya berdasarkan:

- dokumentasi onboarding BRI;
- UAT spec;
- PIC IT BRI;
- interface resmi.

Business behavior tetap sesuai PRD.

## 23.3 Pending Reservation

Saat distribution sudah `PENDING_APPROVAL`:

- amount harus dianggap reserved;
- tidak boleh diajukan lagi;
- tidak boleh disalurkan cash atas allocation yang sama.

---

# 24. Switch dari QLola ke Cash/Manual

Jika penerima berubah pikiran:

1. request cancellation/reject bank instruction;
2. tunggu evidence status `CANCELLED/REJECTED`;
3. release reserved amount;
4. baru buat Cash/Manual distribution.

Dilarang:

- cash dulu lalu cancel belakangan;
- menganggap timeout = cancelled;
- membuat distribution kedua saat bank instruction masih mungkin dieksekusi.

---

# 25. QLola Status Handling

Minimum local state:

- `DRAFT`
- `PENDING_APPROVAL`
- `PROCESSING`
- `DISTRIBUTED`
- `FAILED`
- `REJECTED`
- `CANCEL_PENDING`
- `CANCELLED`

Map external status ke local state secara eksplisit.

Unknown status:

- jangan dianggap failed;
- simpan raw external status;
- masuk monitoring/reconciliation.

---

# 26. No Blind Retry Outgoing Transfer

Kasus:

```text
request dikirim
bank mungkin sukses
response timeout
```

Jangan kirim ulang transfer.

Lakukan:

- status inquiry;
- lookup reference;
- reconciliation;
- hanya retry bila BRI mengonfirmasi tidak pernah diproses dan retry aman.

Tujuan: mencegah Katering/Laundry/Pesantren menerima dua kali.

---

# 27. Distribution Database Guard

Pertahankan hard guard over-disbursement.

Authoritative calculation:

`SUM(distribution_items.amount committed/reserved as required) <= allocation.amount`

Audit existing trigger `trg_finance_dist_items_prevent_overdraw`.

Jika pending bank instruction belum masuk `distribution_items` final, buat mechanism reservation yang juga masuk perhitungan available balance.

Jangan hanya bergantung pada cached `disbursed_amount`.

---

# 28. Recipient Accounts

Pesantren, Katering, Laundry dapat memiliki rekening.

Aturan:

- reuse master provider existing;
- account number tidak hardcoded;
- support primary account;
- account active/inactive;
- snapshot destination pada Distribution;
- edit master tidak mengubah distribution lama;
- validate beneficiary jika API mendukung.

Untuk Cash:
- bank account boleh null.

---

# 29. Cash Distribution

Cash harus tetap auditable.

Minimum:

- recipient;
- amount;
- item/period;
- date/time;
- received_by_name;
- handed_by;
- recorded_by;
- notes;
- receipt/proof bila policy mewajibkan.

Jangan menghapus cash hanya karena BRI/QLola tersedia.

---

# 30. Manual Transfer

Manual transfer:

- bukan QLola;
- bukan BRIAPI automated transfer;
- wajib punya bank/reference/proof;
- record user;
- record timestamp;
- snapshot destination.

UI/report harus membedakannya.

---

# 31. Corrections

Financial history tidak diedit/destructive.

Gunakan:

- VOID;
- REVERSAL;
- REFUND;
- correction/recovery.

Jika allocation sudah distributed:

- jangan auto-deduct period berikutnya tanpa explicit rule;
- create recovery/reconciliation case;
- require audit trail.

---

# 32. Uang Jajan

Tetap gunakan ledger.

Online top-up BRI:

- payment valid;
- allocation ke `UANG_JAJAN`;
- wallet ledger IN;
- atomik.

Tidak boleh:

- masuk Distribution;
- dianggap pendapatan Koperasi;
- diedit saldo langsung.

---

# 33. UI/UX

Ikuti `UI_UX_GUIDELINES.md`.

Hindari:

- generic banking dashboard;
- istilah teknis SNAP di layar wali;
- terlalu banyak badge/card;
- expose raw error bank ke user.

Gunakan istilah operasional:

- `Menunggu Pembayaran`
- `Pembayaran Diterima`
- `Menunggu Rekonsiliasi`
- `Menunggu Approval QLola`
- `Tersalurkan`
- `Ditolak`
- `Dibatalkan`

Untuk Distribution, tombol awal sebaiknya:
`Ajukan Penyaluran`

Jangan label:
`Transfer Sekarang`
jika masih perlu Signer.

---

# 34. Logging

Log harus membantu audit tanpa membocorkan secret.

Boleh log:

- internal correlation ID;
- event type;
- masked VA/account;
- external reference;
- status;
- response code;
- duration.

Jangan log:

- client secret;
- bearer token;
- private key;
- full authentication header;
- PIN;
- soft token;
- full sensitive payload jika tidak perlu.

---

# 35. Observability

Untuk error bank:

- correlation ID;
- sanitized request fingerprint;
- BRI response code;
- external ID;
- retry/status inquiry state;
- user-visible safe message.

Jangan swallow exception dan mengembalikan sukses palsu.

---

# 36. Tests Wajib

Setiap perubahan finansial harus punya test relevan.

Minimum untuk BRI:

- valid inquiry;
- invalid signature;
- duplicate event;
- exact payment;
- mismatch;
- order expired;
- order replaced;
- unknown VA;
- AL-BAGHORY;
- SADESA restriction;
- admin fee once;
- Uang Jajan;
- atomic failure;
- status recovery;
- PAID→SETTLED;
- Bank Statement discrepancy.

Minimum untuk Distribution:

- each recipient type;
- BRI/QLola submit;
- approval;
- rejection;
- timeout;
- cancel;
- cash;
- manual transfer;
- partial distribution;
- overdraw guard;
- duplicate submit;
- pending reservation;
- forbidden switch while pending.

---

# 37. Sandbox dan Production

Development:

- sandbox only;
- fake/test accounts;
- no production secret.

Production enable harus menjadi langkah eksplisit.

Jangan membuat code yang otomatis memilih production karena env tidak ditemukan.

Fail closed.

---

# 38. Cara Kerja per Fase

Untuk task kompleks:

1. baca PRD section relevan;
2. audit code/migration;
3. tulis scope;
4. identifikasi invariant;
5. implement hanya fase diminta;
6. test;
7. audit diff;
8. laporkan:
   - file berubah;
   - migration;
   - test;
   - risiko;
   - TODO eksternal;
9. berhenti.

Jangan otomatis lanjut fase berikutnya.

---

# 39. Program Fase BRI

Gunakan phase label:

- `BRI-0 Audit & Contract Mapping`
- `BRI-1 Data Model & Duitku Retirement`
- `BRI-2 BRI Security & Core Adapter`
- `BRI-3 BRIVA Collection`
- `BRI-4 Recovery, Settlement & Reconciliation`
- `BRI-5 Distribution BRI/QLola`
- `BRI-6 Cash & Manual Distribution Hardening`
- `BRI-7 Reports, Cleanup, UAT & Go-Live`

Jangan mencampur pekerjaan beberapa fase kecuali diminta.

---

# 40. LOCKED Rule

Jika user menyatakan suatu fase **LOCKED**:

- fase dianggap baseline;
- jangan refactor fase tersebut pada pekerjaan berikutnya kecuali:
  - bug;
  - security issue;
  - requirement baru eksplisit;
- setiap perubahan lintas fase harus dijelaskan dampaknya;
- completion report harus menyertakan **commit message Git yang sesuai**.

Contoh:

`feat(finance): lock BRI-3 BRIVA collection flow`

Gunakan message yang sesuai perubahan aktual, bukan copy contoh secara mekanis.

---

# 41. Completion Gate

Jangan menyatakan fase selesai sebelum:

- scope selesai;
- business rule PRD terpenuhi;
- tidak ada silent failure;
- financial write atomik;
- idempotency teruji;
- security check;
- no secret leak;
- migration aman;
- relevant test lulus;
- UI relevan sesuai guideline;
- tidak ada perubahan unrelated;
- audit diff selesai.

Untuk fase yang menyentuh BRI protocol:
- sandbox/UAT evidence diperlukan sesuai tahap.

---

# 42. Audit Setelah Implementasi AI

Karena implementasi dapat dilakukan oleh coding agent/AI, reviewer harus memperlakukan output AI sebagai **untrusted until audited**.

Audit minimum:

- apakah AI mengarang endpoint;
- apakah signature benar;
- apakah secret bocor;
- apakah retry berbahaya;
- apakah amount dari client dipercaya;
- apakah callback idempotent;
- apakah migration destructive;
- apakah Duitku masih bocor ke active code;
- apakah `PAID` disamakan dengan `SETTLED`;
- apakah QLola dibuat STP;
- apakah over-distribution mungkin;
- apakah status unknown dianggap failed;
- apakah cash/manual kehilangan audit trail.

Build success saja tidak cukup.

---

# 43. Dependency

Jangan menambah npm dependency baru jika platform/runtime sudah memiliki kemampuan.

Untuk crypto:
- prefer built-in Node/Web Crypto yang kompatibel dengan Cloudflare Workers.

Untuk HTTP:
- prefer `fetch`.

Untuk schema validation:
- reuse pola/library existing jika ada.

Dependency baru harus punya alasan kuat.

---

# 44. Batasan Refactor

Jangan melakukan refactor besar di luar scope.

Dilarang menyentuh modul tidak terkait seperti:

- Poskestren;
- PSB;
- Absensi;
- Perizinan;
- modul akademik lain;

kecuali dependency nyata dan dijelaskan.

Jangan mengubah auth/session global untuk kebutuhan BRI.

---

# 45. Dokumen BRI Selalu Diverifikasi Ulang

BRIAPI dapat berubah.

Setiap kali implementasi menyentuh:

- endpoint;
- signature;
- header;
- error code;
- version;
- UAT;

developer/AI wajib memeriksa dokumentasi BRI terbaru atau dokumen onboarding yang diberikan BRI.

PRD menetapkan behavior, bukan jaminan endpoint abadi.

---

# 46. Final Safety Invariants

Tidak boleh dilanggar:

1. no double payment;
2. no double allocation;
3. no double wallet top-up;
4. no double distribution;
5. no blind retry transfer;
6. no STP QLola distribution;
7. no financial write before auth verification;
8. no hard delete financial history;
9. no client-authoritative amount;
10. no ambiguous auto-allocation;
11. no switch to cash while bank instruction can still execute;
12. no secret in repo;
13. no BRI fee mixed with cooperative admin fee;
14. `PAID != SETTLED`;
15. Uang Jajan is titipan;
16. AL-BAGHORY remains fully non-billable;
17. SADESA remains exempt only from makan/nyuci automatically;
18. Duitku is not reintroduced as active provider.

Jika solusi yang diminta akan melanggar invariant di atas, berhenti, jelaskan konflik, dan usulkan solusi aman.
