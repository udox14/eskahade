# Product Requirements Document (PRD)
# Integrasi BRIAPI, BRIVA Online, QLola & Penyaluran Dana

**Status:** Ready for Implementation Planning  
**Versi:** 1.0  
**Tanggal:** 8 Oktober 2026  
**Produk:** Sistem Keuangan Baru — Eskahade  
**Institusi penerima utama:** Koperasi  
**Timezone:** Asia/Jakarta  
**Target skala awal:** ±2.500 santri, ±2.500–3.000 transaksi/bulan, estimasi nilai pembayaran ±Rp5–10 miliar/bulan

---

## 1. Kedudukan Dokumen

Dokumen ini adalah **source of truth khusus integrasi BRI** untuk Sistem Keuangan Baru.

Dokumen ini **menggantikan seluruh requirement lama yang spesifik Duitku** pada:

- `docs/SISTEM_KEUANGAN_BARU_PRD.md`
- `docs/IMPLEMENTATION_PLAN.md`
- dokumentasi teknis lain yang masih menganggap Duitku sebagai payment gateway aktif.

Requirement Sistem Keuangan Baru yang **tidak berhubungan dengan gateway** tetap berlaku, termasuk:

- Obligation;
- Payment Order;
- Payment;
- Payment Allocation;
- Settlement;
- Distribution;
- Rekonsiliasi;
- Koreksi;
- Uang Jajan;
- Cash Session;
- pembebasan AL-BAGHORY dan SADESA;
- audit trail;
- aturan non-destructive financial history;
- UI/UX yang telah ditetapkan.

Jika ada konflik:

1. Dokumen ini menang untuk seluruh requirement BRI, BRIVA, QLola, payment online, settlement bank, dan penyaluran terintegrasi BRI.
2. `SISTEM_KEUANGAN_BARU_PRD.md` tetap menang untuk business rule keuangan umum yang tidak diubah dokumen ini.
3. Dokumentasi resmi/kontrak BRI yang berlaku saat implementasi menang untuk detail protokol, signature, endpoint, field, limit, dan credential.

---

# 2. Latar Belakang dan Keputusan Bisnis

Koperasi/Pesantren memutuskan bekerja sama **sepenuhnya dengan BRI** untuk alur pembayaran online dan layanan bank yang terintegrasi dengan Sistem Keuangan Baru.

Keputusan final:

1. Duitku tidak digunakan.
2. Tidak ada transaksi produksi Duitku yang perlu dipertahankan.
3. Seluruh konfigurasi dan integrasi aktif Duitku harus dihapus dari sistem.
4. Setiap santri yang billable memiliki **satu Virtual Account BRI tetap/permanen**.
5. Pembayaran orang tua masuk ke **satu rekening utama Koperasi di BRI**.
6. Orang tua menanggung fee BRIVA/BRI sesuai tarif kerja sama BRI.
7. Koperasi dapat mengenakan **biaya administrasi operasional koperasi** yang terpisah dari fee BRI.
8. Biaya administrasi koperasi harus configurable dan menjadi hak Koperasi.
9. Payment notification dari BRI digunakan untuk menentukan `PAID`.
10. `PAID` dan `SETTLED` tetap dua kondisi berbeda.
11. Bank Statement/reconciliation digunakan untuk konfirmasi settlement.
12. Penyaluran dana dapat dilakukan ke:
    - Pesantren;
    - penyedia Katering;
    - penyedia Laundry.
13. Penyaluran dapat menggunakan:
    - integrasi BRI/QLola;
    - Cash;
    - Transfer Manual.
14. Untuk integrasi QLola, target business behavior adalah:
    - petugas mengajukan penyaluran dari Eskahade;
    - transaksi **tidak boleh Straight Through Processing (STP)**;
    - transaksi menunggu approval;
    - Signer melakukan approval melalui QLola/QLola Token;
    - setelah approval dan keberhasilan bank, Eskahade memperbarui status penyaluran.
15. Rekening tujuan Pesantren, Katering, dan Laundry dapat menggunakan rekening BRI yang didaftarkan sebagai rekening penerima.
16. Cash/manual tetap wajib tersedia sebagai fallback operasional.

---

# 3. Tujuan

## 3.1 Tujuan Utama

Membangun integrasi pembayaran dan penyaluran BRI yang:

- aman;
- real-time pada sisi payment acknowledgement;
- terrekonsiliasi dengan rekening bank;
- tidak dapat menggandakan payment atau penyaluran;
- auditable;
- sederhana bagi orang tua dan petugas non-teknis;
- tidak bergantung pada input manual untuk pembayaran BRIVA;
- mendukung approval berjenjang untuk pengeluaran dana;
- tetap memiliki fallback cash/manual untuk kondisi lapangan.

## 3.2 Prinsip Desain

1. **BRI adalah satu-satunya provider online aktif.**
2. **Fixed VA adalah identitas santri, bukan identitas satu transaksi.**
3. **Order menentukan apa yang dibayar; VA menentukan siapa santrinya.**
4. **Payment notification menentukan PAID; rekonsiliasi bank menentukan SETTLED.**
5. **Biaya admin koperasi berbeda dari fee BRI.**
6. **Allocation menentukan hak dana; Distribution menentukan cara dana diserahkan.**
7. **Tidak ada auto-transfer penyaluran tanpa approval Signer.**
8. **Tidak pernah menebak alokasi transaksi ambigu.**
9. **Tidak pernah retry transfer secara buta setelah timeout.**
10. **Tidak ada hard delete histori finansial.**
11. **Nominal uang selalu divalidasi server-side.**
12. **Dokumentasi resmi BRI saat implementasi adalah acuan protokol final.**

---

# 4. Non-Goals

Integrasi ini bukan:

- aplikasi internet banking pengganti QLola;
- pengganti sistem approval BRI;
- general ledger akuntansi penuh;
- sistem payroll;
- multi-payment-gateway;
- fitur QRIS pihak ketiga;
- integrasi Duitku;
- mekanisme STP untuk penyaluran dana;
- tempat menyimpan private key/secret BRI di database;
- sistem yang mengizinkan satu petugas mengirim uang besar tanpa approval.

Dukungan provider online selain BRI berada di luar scope kecuali diputuskan secara eksplisit di masa depan.

---

# 5. Arsitektur Konseptual

```text
PORTAL ORANG TUA
      |
      | pilih tagihan / top-up
      v
PAYMENT ORDER
      |
      | Fixed BRIVA santri
      v
BRI / BRIVA ONLINE
      |
      | Inquiry ke Eskahade
      | Payment Notification
      v
PAYMENT ENGINE
      |
      +--> Payment Allocation
      |       |
      |       +--> Pesantren
      |       +--> Katering
      |       +--> Laundry
      |       +--> Uang Jajan Ledger
      |       +--> Admin Koperasi
      |
      +--> PAID
              |
              | Bank Statement / reconciliation
              v
           SETTLED

DISTRIBUTION ENGINE
      |
      +--> BRI / QLola --> Pending Approval --> Signer --> Transfer
      |
      +--> CASH
      |
      +--> MANUAL TRANSFER
```

Core finance tetap mengikuti:

`Obligation → Payment Order → Payment → Allocation → Settlement → Distribution`

---

# 6. BRI Product Set yang Menjadi Target

Implementasi diharapkan menggunakan layanan BRI yang relevan dari ekosistem BRIAPI/SNAP BI, berdasarkan layanan yang benar-benar diaktifkan pada akun Koperasi.

Minimal capability yang dibutuhkan:

1. **OAuth SNAP BI**
   - access token;
   - RSA key pair sesuai spesifikasi BRI;
   - signature sesuai dokumentasi aktif.

2. **BRIVA Online**
   - inquiry Virtual Account/tagihan;
   - payment notification/flagging;
   - penggunaan Fixed VA.

3. **BRIVA Online Transaction Status Inquiry**
   - recovery saat callback/hasil transaksi ambigu;
   - monitoring status pembayaran.

4. **Bank Statement SNAP BI**
   - rekonsiliasi rekening Koperasi;
   - konfirmasi settlement.

5. **BRI/QLola Cash Management / Host-to-Host / API Integration**
   - membuat instruksi penyaluran;
   - transaksi masuk workflow approval;
   - Signer approve di QLola;
   - mendapatkan status/reference hasil transaksi.

Detail interface QLola **tidak boleh diasumsikan** sebagai endpoint transfer REST biasa sebelum BRI memberikan interface resmi untuk workflow approval.

Jika BRI menentukan bahwa integrasi approval QLola memakai Host-to-Host, SFTP, Cash Management API, atau interface khusus lain, sistem harus menggunakan interface tersebut tanpa mengubah business behavior PRD ini.

---

# 7. Fixed Virtual Account Santri

## 7.1 Satu Fixed VA per Santri

Setiap santri billable memiliki tepat satu Fixed BRIVA aktif.

VA:

- melekat pada `santri_id`;
- stabil untuk pembayaran berulang;
- tidak dibuat ulang setiap checkout;
- tidak boleh berpindah kepemilikan antar-santri;
- harus unik;
- harus dapat dinonaktifkan jika santri tidak lagi eligible.

Sistem harus mempertahankan tabel/mapping setara `finance_student_va`.

Data minimal:

- `santri_id`;
- `va_number`;
- `customer_no`;
- `partner_service_id` jika relevan;
- `bank_code = BRI`;
- `status`;
- `activated_at`;
- `deactivated_at`;
- metadata sync/provisioning bila diperlukan.

## 7.2 Santri Non-Billable

Aturan existing tetap berlaku.

### AL-BAGHORY

Santri AL-BAGHORY:

- tidak memiliki Fixed VA;
- tidak dapat dibuatkan Payment Order online;
- jika identifier/VA secara keliru mengarah ke santri ini, payment tidak boleh dialokasikan;
- event dicatat untuk audit/reconciliation.

### SADESA

SADESA tetap billable secara umum, tetapi tidak dikenai:

- UANG_MAKAN;
- UANG_NYUCI.

Fixed VA tetap dapat dimiliki.

## 7.3 Lifecycle VA

VA santri yang keluar/nonaktif tidak boleh didaur ulang secara sembarangan.

Default:

- mapping historis dipertahankan;
- status menjadi inactive;
- inquiry untuk VA inactive harus menghasilkan response aman sesuai kontrak BRI;
- reaktivasi hanya melalui proses eksplisit dan auditable.

---

# 8. Payment Order dan Checkout

## 8.1 Satu Active Online Order per Santri

Untuk Fixed BRIVA, sistem menerapkan:

> **maksimum satu Payment Order BRI berstatus aktif/PENDING per santri.**

Jika wali membuat checkout baru:

1. order lama yang belum dibayar ditandai `CANCELLED`, `REPLACED`, atau status setara;
2. order baru menjadi satu-satunya sumber nominal active inquiry;
3. order lama tidak boleh menerima auto-allocation baru.

Tujuan:

- menghindari dua nominal aktif untuk satu Fixed VA;
- mencegah matching berdasarkan tebakan nominal;
- membuat inquiry deterministic.

## 8.2 Isi Payment Order

Satu order dapat berisi:

- satu atau beberapa obligation;
- cicilan USPP;
- top-up Uang Jajan;
- biaya administrasi operasional koperasi.

Order menyimpan snapshot item dan nominal pada saat dibuat.

## 8.3 Exact Amount

Target behavior:

- orang tua membayar nominal order yang aktif;
- nominal kurang/lebih tidak boleh langsung dialokasikan;
- mismatch masuk reconciliation kecuali kontrak BRI memberikan mekanisme penolakan sebelum payment.

Fixed VA tetap dapat digunakan kembali untuk order berikutnya.

## 8.4 Expiry

Order harus memiliki expiry.

Jika order expired:

- inquiry tidak boleh menganggapnya sebagai order aktif;
- payment terlambat tidak boleh dialokasikan dengan tebakan;
- jika uang sudah masuk, catat sebagai payment/unallocated dan arahkan ke reconciliation.

---

# 9. Biaya Administrasi Koperasi

## 9.1 Definisi

Biaya administrasi koperasi adalah **pendapatan operasional Koperasi**, bukan fee BRI.

Contoh:

```text
Tagihan santri              Rp100.000
Admin operasional koperasi    Rp3.000
-------------------------------------
Nominal Eskahade             Rp103.000
```

Internal allocation:

```text
Rp100.000 -> kewajiban/tagihan santri
Rp  3.000 -> hak/pendapatan Koperasi
```

## 9.2 Konfigurasi

Biaya admin koperasi:

- configurable;
- tidak boleh hardcoded;
- dapat diaktifkan/dinonaktifkan;
- nominal dapat diubah oleh role berwenang;
- perubahan memiliki effective date;
- perubahan tidak mengubah order/payment historis;
- nilai selalu disnapshot ke Payment Order.

Versi awal menggunakan **nominal tetap per transaksi**.

Default business rule:

- dikenakan **sekali per checkout/payment order**, bukan per item;
- berlaku pada pembayaran online BRI;
- cash tidak dikenai kecuali kelak diaktifkan secara eksplisit;
- dapat memiliki exemption jika kemudian diperlukan.

Data konfigurasi minimal:

- `enabled`;
- `amount`;
- `effective_from`;
- `effective_until`;
- `applies_to_channel`;
- `created_by`;
- `updated_by`;
- timestamp.

## 9.3 Distribusi

Admin koperasi:

- tidak disalurkan ke Pesantren;
- tidak disalurkan ke Katering;
- tidak disalurkan ke Laundry;
- menjadi hak Koperasi;
- harus terlihat terpisah dalam laporan.

---

# 10. Fee BRI / Customer Fee

Fee BRI:

- merupakan biaya layanan BRI;
- ditanggung wali sesuai hasil kerja sama;
- tarif final mengikuti PKS/kontrak BRI;
- **tidak boleh hardcoded** di business logic sebagai Rp2.000 atau nominal tertentu;
- bukan pendapatan Koperasi;
- bukan Payment Allocation ke obligation;
- tidak boleh dicampur dengan admin koperasi.

Contoh konseptual bila tarif BRI Rp2.000:

```text
Tagihan                     Rp100.000
Admin Koperasi                Rp3.000
Nominal Eskahade             Rp103.000
Fee BRI                       Rp2.000
-------------------------------------
Total biaya wali             Rp105.000
```

Jika kontrak/API BRI menambahkan customer fee di luar `totalAmount`, Eskahade tetap mengirim nominal internal Rp103.000.

Jika kontrak teknis BRI menggunakan mekanisme berbeda, adapter BRI harus mengikuti kontrak tersebut **tanpa mengubah pemisahan akuntansi** antara:

- tagihan;
- admin koperasi;
- fee BRI.

Fee BRI boleh disimpan sebagai metadata/informasi bila tersedia dari BRI, tetapi bukan allocation internal.

---

# 11. Alur BRIVA Online

## 11.1 Inquiry

Saat BRI melakukan inquiry terhadap Fixed VA:

1. verifikasi authentication/signature;
2. validasi request field wajib;
3. resolve VA → santri;
4. cek santri billable;
5. cari satu active Payment Order;
6. pastikan order belum expired/cancelled/paid;
7. response nama/identifier yang aman;
8. response exact `totalAmount` sesuai active order;
9. simpan correlation/inquiry reference jika kontrak BRI menyediakan identifier.

Tidak boleh:

- menggunakan order expired;
- memilih order secara acak;
- menjumlahkan order PENDING ganda;
- membuat nominal dari frontend;
- menebak tagihan ketika data ambigu.

## 11.2 Payment Notification

Saat BRI memberi notifikasi pembayaran:

1. verifikasi signature/autentikasi sesuai kontrak;
2. cek idempotency;
3. validasi VA/customer;
4. validasi santri;
5. korelasikan dengan inquiry/order/reference;
6. validasi nominal;
7. record Payment;
8. buat Payment Allocation atomik;
9. update obligation/wallet;
10. mark order `PAID`;
11. mark payment `PAID`;
12. simpan external references;
13. simpan gateway event yang disanitasi;
14. response ke BRI sesuai SLA/protokol.

## 11.3 Idempotency

Idempotency wajib memanfaatkan identifier resmi yang tersedia, misalnya:

- `trxId`;
- `paymentRequestId`;
- `X-EXTERNAL-ID`;
- bank/reference number;
- kombinasi provider + official transaction identifier.

Duplicate notification tidak boleh:

- membuat Payment kedua;
- membuat Allocation kedua;
- menambah wallet dua kali;
- melunasi obligation dua kali.

Idempotency harus dijamin aplikasi **dan** database constraint bila memungkinkan.

---

# 12. Unallocated / Ambiguous Payment

Jika uang sudah tercatat sebagai pembayaran tetapi sistem tidak dapat menentukan order secara aman:

- jangan menebak allocation;
- record payment sebagai `PAID`;
- set `allocation_status = UNALLOCATED` atau status setara;
- buat reconciliation item;
- tampilkan di Modul Rekonsiliasi;
- user berwenang menyelesaikan dengan audit trail.

Contoh:

- payment untuk order expired;
- amount mismatch;
- unknown/ambiguous order;
- transfer ketika tidak ada active order;
- duplicate identifier yang tidak konsisten;
- payment ke santri non-billable.

---

# 13. Payment Status Recovery

Jika:

- callback timeout;
- response BRI ambigu;
- event tidak diterima;
- koneksi putus;
- sistem ragu transaksi berhasil atau tidak;

sistem **tidak boleh langsung retry payment atau mengubah status berdasarkan asumsi**.

Gunakan:

1. BRIVA Online Transaction Status Inquiry;
2. external reference resmi;
3. Bank Statement jika diperlukan;
4. reconciliation workflow.

Hasil inquiry harus idempotent dan tidak menghasilkan posting finansial ganda.

---

# 14. PAID dan SETTLED

## 14.1 PAID

`PAID` berarti:

- BRI telah memberikan payment confirmation valid; atau
- status transaction inquiry BRI secara valid mengonfirmasi pembayaran.

Pada `PAID`:

- tagihan dapat dianggap lunas;
- allocation dapat tercatat;
- top-up wallet dapat efektif;
- tetapi dana belum dianggap selesai direkonsiliasi terhadap rekening Koperasi.

## 14.2 SETTLED

`SETTLED` berarti payment `PAID` telah berhasil dicocokkan dengan data bank/rekening sesuai reconciliation policy.

Default source:

- BRI Bank Statement;
- official BRI reference/status data yang disepakati.

Bank Statement digunakan dengan memperhatikan rekomendasi BRI terkait:

- jeda setelah transaksi;
- window inquiry;
- periode End of Day;
- field reference resmi.

## 14.3 Rekonsiliasi

Matching harus menggunakan sebanyak mungkin identifier authoritative:

- VA;
- nominal;
- transaction/reference ID;
- payment/order reference;
- transaction time;
- bank statement reference/remark;
- field resmi lain yang disediakan BRI.

Match tidak boleh hanya berdasarkan nominal jika bisa ambigu.

---

# 15. Rekening Koperasi

Semua penerimaan pembayaran online utama masuk ke:

> **satu rekening utama Koperasi di BRI**

Rekening ini digunakan sebagai:

- rekening penerima collection BRIVA;
- sumber rekonsiliasi Bank Statement;
- sumber dana penyaluran terintegrasi BRI/QLola, sesuai setup BRI.

Detail rekening tidak boleh hardcoded di source code.

Konfigurasi nomor rekening non-secret dapat disimpan di konfigurasi aplikasi bila diperlukan, tetapi credential bank tidak boleh disimpan di database biasa.

---

# 16. Allocation dan Hak Dana

Allocation existing tetap authoritative untuk menentukan hak dana.

Mapping default:

| Item | Hak Dana |
|---|---|
| SPP | Pesantren |
| USPP / Uang Bangunan | Pesantren |
| EHB | Pesantren |
| Ekstrakurikuler | Pesantren |
| Kesehatan | Pesantren |
| UANG_MAKAN | Penyedia Katering aktif |
| UANG_NYUCI | Penyedia Laundry aktif |
| Admin Koperasi | Koperasi |
| UANG_JAJAN | Dana titipan santri, bukan distribusi |

Mapping tidak boleh ditentukan berdasarkan UI saja; backend harus menjadi source of truth.

---

# 17. Uang Jajan

Uang Jajan tetap merupakan dana titipan.

Top-up online menggunakan infrastruktur pembayaran BRI yang sama.

Satu Payment Order dapat mencakup top-up Uang Jajan sesuai business rule existing.

Setelah payment valid:

- allocation target `UANG_JAJAN`;
- wallet ledger bertambah secara atomik;
- admin koperasi, jika berlaku, tetap terpisah;
- uang jajan tidak masuk pool Distribution Pesantren/Katering/Laundry;
- uang jajan tidak boleh dianggap pendapatan Koperasi.

Aturan limit, kartu, PIN, withdrawal, dan ledger existing tetap berlaku.

---

# 18. Distribution Recipient

Distribution Engine harus mendukung penerima berikut:

1. **Pesantren**
2. **Katering**
3. **Laundry**

Penerima tidak boleh hardcoded sebagai satu rekening global.

Master recipient/rekening harus dapat menyimpan:

- recipient type;
- reference ke master existing jika tersedia;
- nama penerima;
- bank;
- account number;
- account holder;
- status active;
- primary/default account;
- effective period;
- created/updated by;
- audit history.

Katering/Laundry wajib reuse `master_jasa` atau master existing; jangan membuat duplicate provider master.

Rekening historis yang sudah dipakai pada Distribution tidak boleh berubah retroaktif ketika master account diedit.

Distribution harus menyimpan snapshot rekening tujuan yang digunakan saat transaksi dibuat.

---

# 19. Metode Penyaluran

Semua hak dana yang eligible dapat disalurkan menggunakan:

1. `BRI_QLOLA`
2. `CASH`
3. `MANUAL_TRANSFER`

Pilihan metode tidak mengubah perhitungan hak dana.

## 19.1 BRI/QLola

Target flow:

```text
Petugas Eskahade
  -> Ajukan Penyaluran
  -> BRI/QLola instruction created
  -> PENDING_APPROVAL
  -> Signer QLola review
  -> APPROVE / REJECT
  -> BRI executes
  -> Eskahade verifies final status
  -> DISTRIBUTED
```

### Aturan Mutlak

- penyaluran terintegrasi **tidak boleh STP**;
- tidak boleh dianggap sukses hanya karena request API diterima;
- hanya status bank/QLola final yang dapat menyatakan transfer berhasil;
- retry buta dilarang;
- timeout harus masuk status pending/unknown dan dilakukan status inquiry;
- reference BRI/QLola wajib disimpan;
- amount, source, recipient, dan account harus disnapshot.

Detail transport/interface mengikuti setup resmi BRI:

- BRIAPI REST;
- Host-to-Host;
- Cash Management API;
- SFTP;
- interface resmi lain.

PRD mengunci **behavior**, bukan transport.

## 19.2 Cash

Cash tetap didukung untuk:

- Pesantren;
- Katering;
- Laundry.

Data minimal:

- recipient;
- amount;
- period;
- item/source allocation;
- tanggal penyerahan;
- nama penerima uang;
- petugas penyerah;
- user pencatat;
- bukti/kuitansi/foto jika diwajibkan kebijakan;
- notes;
- confirmation/approval jika diperlukan;
- audit timestamps.

## 19.3 Manual Transfer

Digunakan bila transfer dilakukan di luar integrasi API/QLola.

Data minimal:

- source account/method jika relevan;
- destination bank;
- destination account;
- account holder;
- amount;
- date/time;
- bank/reference number;
- proof attachment;
- recorded_by;
- notes.

Manual transfer tidak boleh diberi label sebagai transaksi BRIAPI otomatis.

---

# 20. Distribution Status Lifecycle

Minimum status:

- `DRAFT`
- `PENDING_APPROVAL`
- `PROCESSING`
- `DISTRIBUTED`
- `FAILED`
- `REJECTED`
- `CANCEL_PENDING`
- `CANCELLED`

Manual/cash dapat tetap menggunakan `DISTRIBUTED` dengan method yang eksplisit, atau derived label `DISTRIBUTED_MANUAL`.

Status tidak boleh diubah sembarangan oleh frontend.

## 20.1 Ganti Metode Saat Pending

Jika penyaluran sudah diajukan melalui BRI/QLola lalu penerima meminta Cash/Manual:

1. jangan langsung membuat penyaluran baru;
2. request/instruksi bank harus dibatalkan bila masih cancellable;
3. sistem harus memperoleh confirmation bahwa instruksi tidak akan dieksekusi;
4. baru setelah status aman `CANCELLED/REJECTED`, channel baru boleh dibuat;
5. seluruh jejak cancellation disimpan.

Tujuannya mencegah:

> uang cash diserahkan dan transfer bank kemudian ikut approved.

---

# 21. Distribution Safety

## 21.1 No Double Distribution

Jumlah seluruh distribution item terhadap satu allocation tidak boleh melebihi allocation.

Hard database guard existing harus dipertahankan atau diperkuat.

## 21.2 Partial Distribution

Penyaluran parsial dan bertahap tetap boleh.

Status allocation:

- `UNDISBURSED`;
- `PARTIALLY_DISBURSED`;
- `DISBURSED`.

## 21.3 Pending Bank Instruction

Nominal yang sedang berada pada bank instruction berstatus `PENDING_APPROVAL/PROCESSING` harus dianggap **reserved** untuk mencegah dibuatnya penyaluran kedua atas amount yang sama.

## 21.4 Recipient Validation

Sebelum mengajukan transfer:

- account aktif;
- bank valid;
- beneficiary account inquiry jika tersedia;
- nama rekening ditampilkan pada confirmation;
- perubahan rekening setelah draft dibuat harus memaksa re-review.

---

# 22. Role dan Authorization

Role existing tetap dipakai sesuai permission system.

Capability minimum:

### Petugas Koperasi
- membuat payment cash sesuai permission;
- membuat draft/ajuan distribution;
- mencatat cash/manual distribution jika diberi permission;
- tidak boleh menjadi final bank signer hanya karena bisa mengakses Eskahade.

### Admin Koperasi
- mengatur admin operasional koperasi;
- mengelola recipient account sesuai permission;
- monitoring;
- reconciliation tertentu;
- tidak otomatis memiliki hak final bank signing.

### Bendahara/Pengurus Berwenang
- review;
- correction;
- reconciliation;
- distribution oversight.

### QLola Signer
Final bank approval dilakukan pada ekosistem QLola sesuai user/signing policy BRI.

Jika QLola menggunakan Maker–Checker–Signer atau Maker–Signer, konfigurasi user bank mengikuti keputusan Koperasi/BRI.

Eskahade tidak boleh menyimpan credential/soft-token Signer.

---

# 23. Security Requirement

## 23.1 Secrets

Credential seperti:

- BRI Client ID;
- Client Secret;
- private key;
- partner ID tertentu jika dikategorikan rahasia;
- certificate/password;
- token;

harus disimpan menggunakan **Cloudflare Workers Secrets / secret management yang setara**.

Dilarang menyimpan secret di:

- GitHub;
- `wrangler.jsonc`;
- frontend;
- D1 plaintext;
- log;
- screenshot dokumentasi internal.

## 23.2 Cryptography

Gunakan algoritma, canonical string, timestamp, header, dan key format **persis dokumentasi BRI yang berlaku**.

Jangan:

- copy-paste implementation Duitku lalu mengganti nama;
- menggunakan contoh signature lama tanpa verifikasi;
- membuat algoritma signature sendiri;
- men-disable verification agar sandbox lolos.

## 23.3 Webhook/Inbound

Inbound BRI:

- verify signature sebelum posting finansial;
- validate timestamp/replay window sesuai spesifikasi;
- validate content type dan mandatory fields;
- log event sanitized;
- reject invalid signature;
- idempotent.

## 23.4 Outbound

Outbound:

- server-side only;
- TLS/HTTPS;
- timeout eksplisit;
- no blind retry untuk transfer finansial;
- access token lifecycle aman;
- token tidak dikirim ke browser.

## 23.5 Static IP

Jangan menambahkan VPS/static egress hanya berdasarkan asumsi.

Jika PKS/UAT BRI ternyata mewajibkan IP whitelist/static egress:

- dokumentasikan requirement;
- pilih solusi minimal;
- jangan pindahkan seluruh Eskahade dari Cloudflare;
- gunakan controlled egress bridge hanya jika memang diperlukan.

---

# 24. Stack dan Infrastruktur

Stack existing dipertahankan:

- Next.js;
- OpenNext;
- Cloudflare Workers;
- `nodejs_compat`;
- Cloudflare D1;
- KV;
- R2;
- Cloudflare Secrets.

Tidak ada requirement untuk migrasi hosting hanya karena BRIAPI.

R2 dapat digunakan untuk bukti penyaluran/kuitansi bila pola existing mengizinkan.

---

# 25. Penghapusan Duitku

Karena Sistem Keuangan Baru belum digunakan untuk pembayaran produksi dan tidak memiliki transaksi Duitku yang harus dipertahankan, integrasi Duitku harus **dipensiunkan secara penuh dari sistem aktif**.

Scope cleanup:

- library gateway Duitku;
- Duitku Web API V2;
- Duitku SNAP adapter;
- QRIS Duitku;
- route callback/webhook;
- route inquiry/payment khusus Duitku;
- env/secret/config Duitku;
- UI pilihan payment Duitku;
- fee config yang spesifik Duitku;
- type union `DUITKU_*`;
- hardcoded channel `DUITKU`;
- settlement logic khusus Duitku;
- reconciliation logic khusus Duitku;
- dashboard/report/history label Duitku;
- Portal Ortu checkout Duitku;
- report export yang menyebut Fixed VA Duitku;
- active documentation yang menyatakan Duitku provider saat ini.

### Migration History

Migration SQL lama yang sudah pernah applied **tidak diedit** hanya untuk menghapus kata Duitku.

Buat migration baru untuk:

- mengubah CHECK constraints;
- mengubah provider/channel model;
- menambah field BRI;
- membangun schema yang sesuai.

Jangan merusak integrity D1 migration history.

---

# 26. Data Model Target

Nama final boleh disesuaikan setelah audit schema, tetapi capability berikut wajib tersedia.

## 26.1 Student VA

Perlu mendukung:

- BRI VA;
- customer identifier;
- active/inactive;
- timestamps.

## 26.2 Payment Order

Perlu membedakan:

- obligation subtotal;
- wallet top-up subtotal;
- cooperative admin fee;
- internal payable amount;
- active/expired/replaced status;
- BRI payment method;
- Fixed VA snapshot.

## 26.3 Payment

Perlu menyimpan:

- BRI channel/method;
- gross/internal amount;
- admin koperasi jika relevan;
- fee BRI metadata jika tersedia;
- net/accounting amount sesuai semantics;
- official transaction references;
- `PAID/SETTLED`;
- allocation status;
- timestamps.

Nama field existing `gateway_fee` tidak boleh dipakai dengan semantics ambigu. Jika sebelumnya berarti Duitku fee, audit dan definisikan ulang atau tambahkan field yang jelas.

## 26.4 Gateway Event

Provider aktif menjadi `BRI`.

Simpan:

- authoritative event key;
- signature validity;
- processing status;
- sanitized payload;
- correlation ID;
- timestamps.

## 26.5 Settlement/Reconciliation

Harus bisa mencocokkan:

- Payment;
- BRI reference;
- Bank Statement row;
- discrepancy;
- resolution.

## 26.6 Cooperative Admin Income

Harus dapat dibedakan dari obligation allocation.

Boleh menggunakan:

- order charge line;
- dedicated allocation target;
- ledger koperasi existing;
- model lain yang auditable.

Dilarang menyamarkannya sebagai SPP atau jenis obligation santri.

## 26.7 Distribution

Perlu menambah capability:

- recipient `PESANTREN`, `KATERING`, `LAUNDRY`;
- method `BRI_QLOLA`, `CASH`, `MANUAL_TRANSFER`;
- lifecycle status;
- external transfer/request/reference IDs;
- snapshot rekening;
- approval/status timestamps;
- cancellation;
- proof/manual fields;
- reserved amount handling.

---

# 27. UI / UX Requirement

## 27.1 Portal Orang Tua

Portal:

- hanya menampilkan BRI sebagai metode online aktif;
- menampilkan Fixed BRIVA santri;
- menampilkan breakdown:
  - tagihan;
  - admin Koperasi;
  - nominal yang ditagihkan Eskahade;
- fee BRI ditampilkan hanya jika data/tarif authoritative tersedia dari kontrak/integrasi;
- jangan hardcode fee BRI;
- status transaksi jelas;
- expired/replaced order tidak membingungkan wali;
- instruksi pembayaran dari bank lain mengikuti informasi resmi BRI.

Tidak ada tombol/label Duitku/QRIS Duitku.

## 27.2 Pengaturan Koperasi

UI admin fee:

- aktif/nonaktif;
- nominal;
- effective date;
- channel applicability;
- audit siapa yang mengubah.

## 27.3 Penyaluran

Layar harus menunjukkan:

- recipient;
- periode;
- sumber item;
- jumlah allocation eligible;
- sudah disalurkan;
- reserved/pending;
- sisa tersedia;
- rekening tujuan;
- metode;
- status;
- BRI/QLola reference;
- bukti manual bila ada.

Aksi utama:

`Ajukan Penyaluran`

Bukan label yang memberi kesan uang langsung terkirim jika masih membutuhkan Signer.

Untuk BRI/QLola setelah submit:

`Menunggu Approval QLola`

## 27.4 Confirmation

Sebelum submit:

- amount besar dan jelas;
- nama recipient;
- bank/account;
- period;
- sumber dana;
- method;
- warning bahwa transaksi akan diajukan ke workflow approval bank.

---

# 28. Reporting

Laporan minimum harus membedakan:

### Penerimaan
- kewajiban/tagihan;
- admin Koperasi;
- top-up Uang Jajan;
- cash;
- BRI online.

### Status Bank
- PAID;
- SETTLED;
- reconciliation pending;
- discrepancy.

### Distribution
- hak Pesantren;
- hak Katering;
- hak Laundry;
- disalurkan BRI/QLola;
- disalurkan cash;
- manual transfer;
- pending approval;
- failed/rejected/cancelled.

### Koperasi
- total admin operasional yang menjadi hak Koperasi.

Laporan tidak boleh menjumlahkan Uang Jajan sebagai pendapatan.

---

# 29. Error Handling

Sistem wajib memiliki deterministic handling untuk:

- invalid signature;
- unknown VA;
- inactive VA;
- AL-BAGHORY;
- SADESA item restriction;
- no active order;
- multiple active order invariant violation;
- order expired;
- amount mismatch;
- duplicate notification;
- late notification;
- status inquiry mismatch;
- Bank Statement belum memuat transaksi;
- Bank Statement duplicate;
- QLola request timeout;
- QLola rejected;
- QLola pending lama;
- transfer successful tetapi local response timeout;
- local DB failure setelah external bank response;
- recipient account invalid;
- cancellation gagal;
- user mencoba switch ke cash saat bank instruction masih hidup;
- over-distribution;
- correction terhadap allocation yang sudah distributed.

Tidak ada error finansial yang diselesaikan dengan silent mutation.

---

# 30. Audit Trail

Audit minimum mencatat:

- siapa membuat order manual jika ada;
- siapa mengubah admin fee config;
- siapa mengubah recipient account;
- siapa mengajukan distribution;
- status bank/QLola;
- external reference;
- siapa mencatat cash/manual transfer;
- siapa melakukan correction;
- sebelum/sesudah nilai config;
- timestamp.

Payload bank boleh disimpan hanya dalam bentuk yang aman dan tidak mengandung secret.

---

# 31. Sandbox, UAT, dan Go-Live

Production tidak boleh digunakan sebelum:

1. credential sandbox tersedia;
2. public/private key setup benar;
3. happy path BRIVA lulus;
4. invalid signature lulus;
5. duplicate payment lulus;
6. amount mismatch lulus;
7. expired/replaced order lulus;
8. unknown VA lulus;
9. non-billable santri lulus;
10. Uang Jajan top-up lulus;
11. admin Koperasi split lulus;
12. PAID/SETTLED reconciliation lulus;
13. transaction status recovery lulus;
14. QLola submit/approve/reject/timeout lulus;
15. cash distribution lulus;
16. manual transfer distribution lulus;
17. cancellation before channel switch lulus;
18. over-distribution guard lulus;
19. report/dashboard lulus;
20. security review lulus;
21. official UAT BRI lulus jika diwajibkan.

---

# 32. Test Matrix Minimum

## 32.1 BRIVA

- inquiry valid;
- invalid signature;
- invalid timestamp;
- unknown VA;
- inactive VA;
- AL-BAGHORY;
- SADESA normal item;
- no active order;
- one active order;
- replaced order;
- expired order;
- exact amount payment;
- amount mismatch;
- duplicate paymentRequestId;
- duplicate trxId;
- callback timeout;
- status inquiry recovery.

## 32.2 Allocation

- multi-item order;
- SPP + makan + laundry;
- USPP installment;
- Uang Jajan top-up;
- admin Koperasi exactly once;
- admin fee change does not change old order;
- allocation atomically rolls back on failure.

## 32.3 Settlement

- PAID before statement;
- matched statement → SETTLED;
- statement missing → pending;
- amount mismatch → discrepancy;
- duplicate statement row;
- late statement.

## 32.4 Distribution

- Pesantren via QLola;
- Katering via QLola;
- Laundry via QLola;
- Pesantren cash;
- Katering cash;
- Laundry cash;
- manual transfer;
- partial distribution;
- multiple partial distribution;
- pending amount reserved;
- rejection;
- timeout;
- status inquiry;
- cancel then cash;
- prohibited cash while bank request still active;
- duplicate submit;
- over-distribution database guard.

---

# 33. Acceptance Criteria

Integrasi dianggap memenuhi PRD ketika:

1. tidak ada payment online aktif melalui Duitku;
2. Portal Ortu hanya menggunakan BRI untuk pembayaran online;
3. Fixed BRIVA unik per santri berjalan;
4. satu active order per santri terjamin;
5. admin Koperasi configurable dan dipisahkan dari fee BRI;
6. payment notification BRI idempotent;
7. tidak ada double allocation;
8. payment ambigu masuk reconciliation;
9. `PAID != SETTLED`;
10. Bank Statement dapat mengubah payment yang match menjadi `SETTLED`;
11. Uang Jajan tetap dana titipan;
12. allocation mapping ke Pesantren/Katering/Laundry benar;
13. Penyaluran BRI/QLola membutuhkan Signer dan bukan STP;
14. Cash dan Manual Transfer tetap berfungsi;
15. tidak ada double distribution;
16. switch method dari pending QLola aman;
17. semua external reference dapat diaudit;
18. invalid signature tidak dapat membuat transaksi;
19. tidak ada secret BRI di repo/database/frontend;
20. sandbox/UAT lulus.

---

# 34. Program Implementasi

Gunakan fase khusus agar tidak tercampur dengan Fase 1–10 Sistem Keuangan Baru.

## BRI-0 — Audit & Contract Mapping

- audit seluruh coupling Duitku;
- audit schema/check constraint;
- audit portal;
- audit settlement/reconciliation;
- audit distribution;
- mapping dokumentasi BRI yang diberikan saat onboarding;
- jangan coding besar sebelum hasil audit jelas.

## BRI-1 — Data Model & Duitku Retirement

- migration provider/method;
- model Fixed BRIVA;
- cooperative admin config;
- satu active order invariant;
- remove active Duitku configuration/code paths;
- update types.

## BRI-2 — BRI Security & Core Adapter

- OAuth;
- RSA/HMAC/signature;
- token handling;
- inbound verification;
- event/idempotency infrastructure;
- sanitized logs.

## BRI-3 — BRIVA Collection

- inquiry;
- payment notification;
- payment matching;
- allocation;
- Portal Ortu;
- Uang Jajan;
- admin Koperasi.

## BRI-4 — Payment Recovery & Settlement

- transaction status inquiry;
- Bank Statement;
- `PAID → SETTLED`;
- discrepancy/reconciliation;
- UI monitoring.

## BRI-5 — Distribution BRI/QLola

- recipient accounts;
- Pesantren/Katering/Laundry;
- BRI/QLola adapter;
- pending approval;
- signer status sync;
- cancellation;
- idempotency;
- no STP.

## BRI-6 — Cash & Manual Distribution Hardening

- proof;
- receipt;
- audit;
- switch-channel safety;
- partial distribution;
- correction/recovery.

## BRI-7 — Reports, Cleanup, UAT & Go-Live

- report/dashboard/history cleanup;
- no active Duitku UI/code;
- security audit;
- sandbox tests;
- official UAT;
- production readiness checklist.

Setiap fase berhenti setelah scope fase selesai. Jangan otomatis lanjut.

---

# 35. Go-Live Safety

Sebelum enable production:

- sandbox credentials dipisahkan dari production;
- production secret hanya melalui secret store;
- callback/inquiry endpoint HTTPS final;
- clock/timezone benar;
- rate/timeout/retry policy benar;
- kill switch tersedia untuk menonaktifkan payment/distribution outbound bila incident;
- QLola non-STP verified;
- signer workflow tested;
- recipient accounts verified;
- admin fee value reviewed;
- Bank Statement reconciliation aktif;
- monitoring error aktif;
- recovery SOP tersedia;
- PIC BRI diketahui.

---

# 36. Requirement yang Sengaja Tidak Dihardcode

Hal berikut harus datang dari kontrak/config BRI:

- tarif customer fee BRI;
- production URL;
- partner ID;
- partnerServiceId;
- channel ID;
- credential;
- key/certificate;
- timeout resmi;
- retry rules;
- static IP requirement bila ada;
- exact QLola/H2H interface;
- approval workflow configuration bank;
- limit transaksi;
- format VA final;
- response/error code aktual.

AI/developer dilarang mengisi nilai production dengan tebakan.

---

# 37. Referensi Resmi yang Harus Diverifikasi Saat Implementasi

Dokumentasi BRI dapat berubah. Sebelum coding protokol, buka versi terkini dari portal BRIAPI.

Referensi awal:

- BRIAPI OAuth SNAP BI  
  https://developers.bri.co.id/en/snap-bi/apidocs-oauth-snap-bi

- BRIAPI BRIVA Online / Virtual Account  
  https://developers.bri.co.id/

- Inquiry Transaction Status BRIVA Online  
  https://developers.bri.co.id/id/snap-bi/apidocs-transactionstatusinquiry-brivaonline

- Bank Statement SNAP BI v2.1  
  https://developers.bri.co.id/id/node/54255

- Intrabank Transfer / Account Inquiry  
  https://developers.bri.co.id/en/snap-bi/api-account-inquiry-internal-intrabank-transfer-v11

- BRIAPI Pricing — hanya referensi; tarif final mengikuti kerja sama  
  https://developers.bri.co.id/en/pricing

- QLola by BRI / integrasi bisnis  
  https://bri.co.id/

---

# 38. Kesimpulan

Target akhir Sistem Keuangan Baru adalah:

```text
BRI sebagai satu-satunya provider online
+
Fixed BRIVA per santri
+
Payment Order yang deterministic
+
Admin Koperasi configurable
+
Payment BRI idempotent
+
PAID != SETTLED
+
Bank Statement reconciliation
+
Distribution ke Pesantren/Katering/Laundry
+
BRI/QLola dengan approval Signer, non-STP
+
Cash & Manual Transfer fallback
+
Audit trail penuh
```

Duitku bukan bagian dari arsitektur target.

Dokumen ini mengunci **business behavior dan safety invariant**. Detail protokol bank mengikuti dokumentasi dan credential resmi yang diberikan BRI saat sandbox/UAT.
