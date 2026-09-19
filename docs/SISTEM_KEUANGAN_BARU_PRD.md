# Product Requirements Document (PRD)
# Sistem Keuangan Baru

**Status:** Draft v1.0  
**Produk:** Sistem Keuangan Baru  
**Konteks:** Sistem Pesantren  
**Target pengguna:** Bendahara Pesantren, Admin Koperasi, Petugas Koperasi, Orang Tua  
**Timezone:** Asia/Jakarta  

---

## 1. Ringkasan Produk

Sistem Keuangan Baru adalah modul keuangan pesantren yang menangani alur penerimaan pembayaran dari orang tua, pembayaran tunai melalui koperasi, pengelolaan uang jajan santri, penyaluran dana ke pihak-pihak terkait, rekonsiliasi, pencetakan laporan, dan audit transaksi.

Sistem harus dirancang untuk pengguna non-akuntan. Antarmuka harus sederhana, operasional, mudah dipahami, dan tidak menyerupai aplikasi perbankan atau software akuntansi yang kompleks.

Walaupun antarmukanya sederhana, mesin keuangan di backend harus ketat, aman, atomik, konsisten, dapat diaudit, dan tidak mengizinkan manipulasi transaksi secara destruktif.

---

## 2. Tujuan Produk

### 2.1 Tujuan Utama

1. Memudahkan orang tua membayar kewajiban santri melalui aplikasi atau tunai.
2. Mencatat pembayaran online secara otomatis melalui Duitku.
3. Mencatat pembayaran tunai secara aman melalui koperasi/loket.
4. Menyediakan status pembayaran santri secara real-time.
5. Mengelola uang jajan santri sebagai dana titipan.
6. Memfasilitasi pencairan dan penyetoran melalui kartu QR santri.
7. Mengelola penyaluran dana ke Bendahara Pesantren, katering, dan laundry.
8. Menyediakan rekonsiliasi antara sistem, Duitku, settlement rekening, dan kas fisik.
9. Menyediakan laporan PDF dan Excel.
10. Menjaga seluruh histori transaksi agar dapat diaudit.

### 2.2 Prinsip Produk

- Sederhana untuk pengguna non-akuntan.
- Aman untuk transaksi keuangan.
- Tidak ada hard delete transaksi.
- Tidak ada perubahan historis diam-diam.
- Semua transaksi dapat ditelusuri.
- Sumber data harus jelas.
- Hindari duplikasi data existing.
- Hindari refactor besar yang tidak diperlukan.
- Integrasi dengan sistem existing harus dilakukan seminimal mungkin.

---

## 3. Non-Goals

Sistem ini bukan:

- aplikasi akuntansi penuh;
- internet banking;
- sistem payroll;
- sistem general ledger akuntansi formal untuk laporan neraca;
- pengganti Modul Katering & Laundry;
- pengganti master data santri;
- pengganti Portal Orang Tua.

Sistem memanfaatkan dan mengintegrasikan data yang sudah tersedia.

---

## 4. Pengguna dan Role

### 4.1 Bendahara Pesantren

Fokus pada:

- pengaturan tarif;
- pembebasan pembayaran;
- status pembayaran;
- penyaluran;
- rekonsiliasi;
- laporan;
- dashboard.

### 4.2 Admin Koperasi

Role baru.

Fokus pada:

- kredensial/kartu;
- konfigurasi operasional koperasi;
- monitoring loket;
- uang jajan;
- laporan koperasi.

### 4.3 Petugas Koperasi

Role baru.

Fokus pada:

- transaksi loket;
- pembayaran tunai;
- pencairan uang jajan;
- penyetoran;
- sesi kas.

### 4.4 Orang Tua

Menggunakan Portal Orang Tua yang sudah ada.

Fokus pada:

- melihat tagihan;
- memilih item pembayaran;
- pembayaran online;
- top-up uang jajan;
- melihat histori;
- mencetak bukti pembayaran;
- mengatur limit uang jajan.

### 4.5 Perubahan Role Existing

Role `Petugas Loket` dihapus.

Role akhir sementara:

- Bendahara Pesantren
- Admin Koperasi
- Petugas Koperasi

Hak akses detail akan diatur kemudian.

Sistem harus memakai permission/authorization fleksibel.

---

# 5. Konsep Keuangan Inti

## 5.1 Ledger

Seluruh transaksi keuangan harus menggunakan ledger sebagai sumber kebenaran.

Saldo tidak boleh hanya berupa angka yang dapat diedit manual.

Jika cached balance digunakan untuk performa, cached balance bukan sumber kebenaran dan harus dapat direkonsiliasi dengan ledger.

---

## 5.2 Entitas Keuangan yang Harus Dipisahkan

Jangan menyatukan seluruh konsep keuangan dalam satu tabel transaksi sederhana.

Minimal bedakan:

### Obligation / Tagihan
Apa yang harus dibayar santri.

### Payment Order / Payment Intent
Apa yang dipilih orang tua untuk dibayar pada suatu checkout.

### Payment
Uang yang benar-benar diterima.

### Payment Allocation
Bagian dari suatu Payment yang dialokasikan ke masing-masing tagihan.

### Settlement
Dana payment gateway yang telah diteruskan ke rekening pesantren.

### Distribution
Dana yang disalurkan ke pihak penerima.

### Refund / Reversal / Void
Koreksi atas transaksi yang telah terjadi.

---

## 5.3 Atomisitas

Semua operasi yang mengubah beberapa data keuangan sekaligus harus atomik.

Contoh:

Payment Rp900.000 terdiri dari:

- SPP Rp200.000
- Uang Makan Rp400.000
- USPP Rp300.000

Jika salah satu allocation gagal, transaksi keseluruhan tidak boleh menjadi setengah berhasil.

---

## 5.4 Idempotency

Callback/webhook Duitku wajib idempotent.

Callback yang sama tidak boleh menghasilkan payment atau allocation ganda.

---

## 5.5 Nominal Uang

Semua nilai uang disimpan sebagai integer Rupiah.

Contoh:

Rp150.000 disimpan sebagai:

`150000`

Jangan gunakan floating point untuk nominal uang.

---

## 5.6 Reference ID

Setiap transaksi memiliki reference internal yang unik.

Bedakan:

- internal reference;
- Duitku reference;
- bank reference;
- distribution reference;
- refund/reversal reference.

---

## 5.7 Larangan Hard Delete

Tidak boleh melakukan hard delete terhadap:

- payment;
- payment allocation;
- settlement;
- distribution;
- transaksi uang jajan;
- transaksi loket;
- refund;
- reversal;
- transaksi keuangan lainnya.

Gunakan:

- status;
- archival;
- reversal;
- void;

sesuai kebutuhan.

---

# 6. Tahun Ajaran dan Periode

Sistem menggunakan konsep Tahun Ajaran.

Contoh:

`2026/2027`

Periode tahun ajaran:

**Juli sampai Juni**

Data yang harus dapat dikaitkan dengan tahun ajaran bila relevan:

- tarif;
- tagihan;
- pembayaran;
- pembayaran tahunan;
- pembebasan;
- laporan;
- penyaluran.

---

# 7. Alur Pembayaran

## 7.1 Pembayaran Online

Orang tua membuka Portal Orang Tua.

Orang tua memilih satu atau beberapa item pembayaran.

Metode pembayaran melalui Duitku, misalnya:

- Virtual Account;
- QRIS;
- metode lain yang nantinya diaktifkan.

Alur:

1. User memilih item.
2. Sistem membuat Payment Order / Payment Intent.
3. Sistem mengirim request pembayaran ke Duitku.
4. Orang tua melakukan pembayaran.
5. Duitku mengirim callback/webhook.
6. Sistem melakukan verifikasi server-side.
7. Payment dicatat.
8. Payment Allocation dibuat secara atomik.
9. Status item diperbarui.
10. Orang tua melihat pembayaran berhasil.
11. Petugas melihat pembayaran masuk.
12. Settlement dipantau secara terpisah.

Pembayaran online tidak boleh diinput manual oleh petugas.

---

## 7.2 Payment Order / Payment Intent

Satu Payment Order dapat berisi satu atau beberapa item.

Contoh:

- SPP September: Rp200.000
- Uang Makan September: Rp400.000
- Cicilan USPP: Rp300.000

Total:

Rp900.000

Sistem membuat nomor order internal unik.

Contoh:

`ORDER-20260919-A82K`

Setelah Payment Rp900.000 diterima, alokasi:

- Rp200.000 → SPP
- Rp400.000 → Uang Makan
- Rp300.000 → USPP

Satu payment tidak harus sama dengan satu item.

---

## 7.3 Pembayaran Tunai

Orang tua dapat membayar tunai di koperasi.

Alur:

1. Orang tua datang ke koperasi.
2. Menyampaikan item yang ingin dibayar.
3. Menyerahkan uang tunai.
4. Petugas mencatat transaksi.
5. Sistem membuat payment dan allocation.
6. Status tagihan diperbarui.

Pembayaran tunai dapat dicatat melalui:

- Modul Status Pembayaran; atau
- Modul Loket Penarikan & Penyetoran.

Perbedaannya:

- Status Pembayaran: tanpa scan kartu dan PIN.
- Loket: dapat memakai scan kartu dan identifikasi santri.

---

## 7.4 Status Pembayaran Online

Minimal mendukung:

- `PENDING`
- `PAID`
- `SETTLED`
- `FAILED`
- `EXPIRED`

`PAID` berarti pembayaran berhasil.

`SETTLED` berarti dana telah diteruskan payment gateway ke rekening pesantren.

Status lain dapat ditambahkan sesuai integrasi Duitku.

---

## 7.5 Payment Edge Cases

Sistem harus menangani:

- nominal kurang;
- nominal lebih;
- order kedaluwarsa;
- transfer tanpa order aktif;
- callback terlambat;
- callback ganda;
- pembayaran yang ambigu;
- reference tidak cocok.

Jangan otomatis menebak alokasi jika data tidak cukup.

Transaksi ambigu masuk Modul Rekonsiliasi.

---

# 8. Fixed Virtual Account

Setiap santri memiliki Virtual Account permanen.

Nomor VA tetap sama untuk pembayaran berulang.

Implementasi harus menggunakan skema Fixed Virtual Account Duitku yang sesuai.

Jangan memperlakukan VA dinamis per checkout sebagai Fixed VA.

Jika integrasi membutuhkan konfigurasi khusus merchant, arsitektur harus mengikuti dokumentasi resmi Duitku.

---

# 9. Biaya Payment Gateway

Simpan:

- gross amount;
- gateway fee;
- net amount;
- payment channel;
- Duitku reference;
- payment time;
- settlement time.

Pengaturan harus menentukan apakah biaya transaksi ditanggung:

- orang tua; atau
- pesantren.

Jangan mengasumsikan salah satu tanpa konfigurasi.

---

# 10. Item Pembayaran

## 10.1 SPP

- Tagihan bulanan.
- Bisa membayar bulan berjalan.
- Bisa membayar tunggakan bulan sebelumnya.
- Bisa membayar bulan yang belum terjadi.
- Tidak boleh dicicil.
- Disalurkan ke Bendahara Pesantren.

---

## 10.2 Uang Makan

- Tagihan bulanan.
- Disalurkan ke penyedia katering.
- Penyedia mengikuti Modul Katering & Laundry existing.
- Jangan membuat duplikasi master penyedia.

---

## 10.3 Uang Nyuci

- Tagihan bulanan.
- Disalurkan ke penyedia laundry.
- Penyedia mengikuti Modul Katering & Laundry existing.
- Jangan membuat duplikasi master penyedia.

---

## 10.4 Pembayaran Tahunan

Item:

- EHB
- Ekstrakurikuler
- Kesehatan

Karakteristik:

- dibayar setiap tahun;
- periode mulai Juli;
- dikelola terintegrasi;
- tetap menjadi tiga item pembayaran terpisah;
- disalurkan ke Bendahara Pesantren.

---

## 10.5 USPP / Uang Bangunan

- Dibayar sekali selama menjadi santri.
- Bisa dicicil selama santri aktif.
- Harus selalu bisa dicicil.
- Disalurkan ke Bendahara Pesantren.

---

## 10.6 Uang Jajan

Kategori khusus.

Dana ini adalah uang milik santri, bukan pendapatan pesantren.

Sumber top-up:

- orang tua melalui Portal Orang Tua;
- santri melalui loket.

Penggunaan:

- hanya untuk pencairan uang jajan santri.

Pencairan:

- dilakukan melalui koperasi/loket;
- memakai kartu QR;
- mengikuti limit.

---

# 11. Tarif

## 11.1 Pengaturan Tarif

Seluruh nominal item dapat diatur oleh Bendahara Pesantren.

---

## 11.2 Tarif Berubah Antarperiode

Tarif tahun ini dapat berbeda dari tahun sebelumnya.

Gunakan versioning dan effective period.

Contoh:

- SPP 2026/2027 = Rp300.000
- SPP 2027/2028 = Rp350.000

Perubahan tarif tidak boleh mengubah transaksi historis.

---

## 11.3 Snapshot Tarif

Tagihan/transaksi menyimpan snapshot tarif pada saat terbentuk.

Minimal data tarif:

- item;
- nominal;
- effective_from;
- effective_until;
- academic_year;
- created_at;
- created_by.

---

# 12. Tagihan Otomatis

User tidak perlu menekan tombol `Generate Tagihan Bulanan`.

Secara operasional, semua santri aktif dianggap memiliki kewajiban sesuai tarif dan item yang berlaku.

Backend tetap harus membentuk record kewajiban yang dapat diaudit.

Tagihan dapat dibuat dinamis saat diperlukan.

Contoh:

Orang tua membayar SPP November pada September.

Sistem dapat mematerialisasi kewajiban November saat pembayaran dipilih.

Setelah tagihan memiliki transaksi, histori tidak boleh berubah akibat perubahan tarif global.

---

# 13. Cicilan

Pengaturan per item:

- tidak boleh dicicil;
- boleh dicicil;
- wajib bisa dicicil.

Aturan tetap:

- SPP tidak boleh dicicil.
- USPP selalu bisa dicicil.

Item lain dapat dikonfigurasi.

Sistem tidak boleh menerima pembayaran lebih besar dari sisa tagihan kecuali ada aturan khusus untuk kelebihan bayar.

---

# 14. Pembebasan Pembayaran

Default:

semua santri aktif terkena seluruh item yang berlaku.

Pembebasan dapat berlaku:

- seluruh pembayaran;
- satu item;
- beberapa item;
- periode tertentu;
- tahun ajaran tertentu.

Data minimal:

- student;
- payment item;
- reason;
- start date/period;
- end date/period;
- academic year;
- created_by;
- notes.

Pembebasan tidak boleh mengubah transaksi sukses secara retroaktif.

---

# 15. Uang Jajan sebagai Dana Titipan

Uang Jajan bukan:

- pendapatan pesantren;
- saldo bebas pesantren;
- dana yang dapat disalurkan ke bendahara.

Saldo uang jajan berasal dari ledger.

Saldo bertambah melalui:

- top-up orang tua;
- setoran santri;
- reversal pencairan yang sah.

Saldo berkurang melalui:

- pencairan;
- koreksi sah.

Saldo tidak boleh diedit langsung.

---

# 16. Limit Uang Jajan

Orang tua dapat menetapkan limit pencairan.

Pesantren juga mempunyai limit global.

Gunakan limit yang paling ketat.

Contoh:

- Limit global: Rp100.000/hari
- Limit orang tua: Rp50.000/hari

Limit efektif:

Rp50.000/hari

Struktur harus dapat dikembangkan untuk:

- harian;
- mingguan;
- bulanan.

---

# 17. Modul Kredensial

Admin/petugas dapat mencetak kartu QR ukuran kartu kredit.

Kartu minimal menampilkan:

- foto santri;
- nama lengkap;
- NIS;
- asrama;
- QR Code.

Desain harus profesional dan mudah dibaca.

QR tidak boleh memakai:

- NIS langsung;
- raw database ID.

Gunakan random credential/token.

Status kartu:

- `ACTIVE`
- `REVOKED`
- `LOST`
- `BLOCKED`

Kartu hilang:

- credential lama dinonaktifkan;
- kartu baru dapat diterbitkan;
- histori transaksi tetap terhubung ke santri.

Pencetakan:

- batch;
- layout konsisten.

---

# 18. PIN Santri

PIN tidak boleh disimpan plaintext.

Harus mendukung:

- secure hashing;
- batas percobaan;
- temporary lock;
- reset PIN;
- audit reset PIN.

---

# 19. Portal Orang Tua

Portal sudah ada.

Sesuaikan agar orang tua dapat:

- melihat tagihan;
- memilih item;
- membayar satu/beberapa item;
- melihat tunggakan;
- membayar periode sebelumnya;
- membayar periode berikutnya;
- mencicil item yang diizinkan;
- mengisi uang jajan;
- mengatur limit uang jajan;
- melihat histori;
- mencetak bukti pembayaran.

---

# 20. Modul Status Pembayaran

Menampilkan seluruh santri aktif dan status pembayaran.

## 20.1 Tab Ringkasan

Contoh:

Ahmad Buhaeti — Asrama Bahagia / 23

- SPP: Lunas
- Uang Makan: Lunas
- Uang Nyuci: Belum Lunas
- USPP: Nyicil

---

## 20.2 Tab Pembayaran Bulanan

Item:

- SPP
- Uang Makan
- Uang Nyuci

---

## 20.3 Tab Tahunan

Item:

- EHB
- Ekstrakurikuler
- Kesehatan

---

## 20.4 Tab USPP

Tampilkan:

- nominal total;
- sudah dibayar;
- sisa;
- histori cicilan;
- status.

---

## 20.5 Tab Tunggakan

Hanya santri yang memiliki tunggakan.

Filter:

- bulan;
- tahun ajaran;
- item;
- asrama;
- kelas;
- nominal;
- status.

---

## 20.6 Catat Pembayaran Tunai

Tombol:

`Catat Pembayaran`

Membuka modal.

Tidak memerlukan kartu dan PIN.

---

# 21. Modul Uang Jajan

Tabel seluruh santri aktif.

Tampilkan:

- saldo;
- limit;
- transaksi terakhir;
- top-up terakhir;
- pencairan terakhir.

Histori lengkap melalui modal detail.

Detail transaksi:

- waktu;
- jenis;
- nominal;
- source;
- petugas;
- saldo sebelum;
- saldo sesudah;
- reference.

---

# 22. Modul Loket Penarikan & Penyetoran

UI dibuat seperti aplikasi kasir interaktif.

Harus cepat dan mudah digunakan.

## 22.1 Alur Penarikan

1. Santri membawa kartu.
2. QR dipindai.
3. Sistem menampilkan foto besar.
4. Sistem menampilkan identitas:
   - nama;
   - NIS;
   - asrama/kamar;
   - kelas pesantren.
5. Petugas mencocokkan wajah.
6. Santri memasukkan PIN.
7. Sistem memverifikasi.
8. Sistem menampilkan saldo dan limit.
9. Petugas memasukkan nominal.
10. Sistem memvalidasi saldo dan limit.
11. Petugas menyerahkan uang.
12. Transaksi dicatat ke ledger.

---

## 22.2 Setoran / Pembayaran Loket

Petugas dapat memilih:

- SPP;
- Uang Makan;
- Uang Nyuci;
- EHB;
- Ekstrakurikuler;
- Kesehatan;
- USPP;
- tambah saldo Uang Jajan.

---

## 22.3 Riwayat Loket

Filter:

- tanggal;
- jenis;
- petugas;
- santri;
- metode;
- item;
- nominal;
- status.

---

# 23. Sesi Kas Loket

Setiap operasional tunai memakai Sesi Kas.

Data:

- petugas;
- waktu buka;
- saldo awal;
- total penerimaan;
- total pengeluaran;
- expected closing balance;
- saldo fisik;
- selisih;
- waktu tutup;
- catatan.

Selisih tidak boleh dihapus atau diedit diam-diam.

---

# 24. Modul Penyaluran

Kelompokkan berdasarkan tujuan.

Tab:

## 24.1 Bendahara Pesantren

- SPP
- USPP
- EHB
- Ekstrakurikuler
- Kesehatan

## 24.2 Katering

- Uang Makan

## 24.3 Laundry

- Uang Nyuci

---

# 25. Penyaluran Katering dan Laundry

Di bagian atas tampilkan card ringkasan:

- dana masuk periode berjalan;
- sudah disalurkan;
- belum disalurkan;
- jumlah santri;
- sudah bayar;
- belum bayar.

Periode dapat diganti.

Daftar penyedia menampilkan:

- nama;
- jumlah santri terdaftar;
- jumlah sudah bayar;
- jumlah belum bayar;
- total dana masuk;
- total dapat disalurkan;
- sudah disalurkan;
- belum disalurkan.

---

# 26. Rekening Penyedia

Petugas dapat menyimpan:

- bank;
- nomor rekening;
- nama pemilik rekening;
- catatan.

---

# 27. Catat Penyaluran

Data minimal:

- recipient;
- item;
- period;
- amount;
- method;
- destination bank account;
- date;
- operator;
- notes;
- attachment/proof;
- reference.

Penyaluran bisa:

- sekaligus;
- parsial;
- berkali-kali.

Total tidak boleh melebihi dana tersedia.

---

# 28. Snapshot Penyedia

Gunakan data penyedia dari Modul Katering & Laundry.

Namun histori keuangan harus menyimpan snapshot relasi:

`student → provider → period`

Contoh:

September: santri A → Katering Mawar  
Oktober: santri A → Katering Melati

Transaksi September tetap menjadi hak Katering Mawar.

---

# 29. Bukti Penyaluran

Dapat dicetak.

Minimal memuat:

- nomor transaksi;
- tanggal;
- penerima;
- item;
- periode;
- nominal;
- metode;
- petugas;
- catatan.

---

# 30. Modul Riwayat Transaksi

Tampilkan semua transaksi:

- pembayaran online;
- pembayaran tunai;
- top-up uang jajan;
- pencairan uang jajan;
- reversal;
- void;
- refund;
- penyaluran;
- transaksi lain.

Filter:

- tanggal;
- jenis;
- santri;
- item;
- asrama;
- petugas;
- metode;
- status;
- nominal;
- reference;
- source.

Sorting dilakukan dari header kolom bila relevan.

---

# 31. Modul Pengaturan Keuangan

Gunakan model SPA.

Minimal mencakup:

## 31.1 Tarif

- nominal item;
- effective period;
- academic year;
- installment rule.

## 31.2 Pembebasan

- santri;
- item;
- periode;
- alasan.

## 31.3 Limit Uang Jajan

- global limit;
- aturan limit.

## 31.4 Payment Gateway

- Duitku configuration;
- sandbox/production;
- payment channels;
- webhook;
- Fixed VA;
- settlement;
- gateway fee handling.

Data sensitif harus dimasking.

---

# 32. Modul Rekonsiliasi

## 32.1 Rekonsiliasi Online

Cocokkan:

`Internal Transaction ↔ Duitku ↔ Settlement Rekening`

Status yang perlu terlihat:

- matched;
- belum settlement;
- amount mismatch;
- tidak ditemukan di Duitku;
- ada di Duitku tapi tidak ada di sistem;
- membutuhkan pemeriksaan.

---

## 32.2 Rekonsiliasi Tunai

Cocokkan:

`Transaksi Sistem ↔ Sesi Kas ↔ Uang Fisik`

Tampilkan:

- system balance;
- physical balance;
- difference.

Mismatch tidak boleh diperbaiki dengan mengubah nominal transaksi secara diam-diam.

---

# 33. Modul Dashboard

Gunakan:

- summary cards;
- charts;
- graphs;
- tables;
- indicators;
- shortcuts.

Minimal tampilkan:

- total penerimaan periode berjalan;
- pembayaran online;
- pembayaran tunai;
- payment settled;
- payment belum settlement;
- dana siap disalurkan;
- dana sudah disalurkan;
- dana belum disalurkan;
- total tunggakan;
- jumlah santri menunggak;
- total dana uang jajan;
- aktivitas loket;
- transaksi terbaru;
- reconciliation mismatch;
- quick actions.

Jangan membuat satu angka saldo yang mencampur dana pesantren dan dana uang jajan.

---

# 34. Modul Cetak

Laporan minimal:

- penerimaan;
- penyaluran;
- penunggak;
- santri dibebaskan;
- detail per santri;
- uang jajan;
- transaksi loket;
- settlement;
- rekonsiliasi.

Filter laporan:

- seluruh santri;
- asrama;
- kelas;
- item;
- periode;
- tahun ajaran;
- filter relevan lain.

Output:

## PDF

- print/window print konsisten;
- layout rapi;
- siap cetak.

## Excel

- well formatted;
- header jelas;
- nominal numeric;
- tanggal sebagai date;
- mudah difilter dan digunakan ulang.

---

# 35. Petunjuk dan Tour

Setiap modul harus memiliki:

- help text;
- tooltip;
- guide;
- contextual help;
- in-screen tour.

Tour muncul pada first visit.

User dapat menjalankan kembali melalui tombol:

`Panduan / Tour`

---

# 36. Audit Trail

Transaksi penting minimal menyimpan:

- created_at;
- created_by;
- source;
- reference;
- status;
- reason jika reversal/void;
- related transaction;
- metadata relevan.

Perubahan penting menyimpan:

- actor;
- timestamp;
- previous value;
- new value.

---

# 37. Timezone

Gunakan:

`Asia/Jakarta`

Jika backend menggunakan UTC, lakukan konversi dengan benar di presentation layer.

---

# 38. Keamanan

Minimal:

- authorization;
- permission;
- server-side validation;
- CSRF protection jika relevan;
- rate limiting endpoint sensitif;
- idempotency;
- secure credential handling;
- masking;
- audit logging;
- safe PIN hashing;
- secure webhook verification.

Jangan mempercayai nominal dari frontend.

Nominal harus dihitung/divalidasi dari data server.

---

# 39. UX Requirements

Pengguna bukan akuntan.

Gunakan bahasa sederhana.

Contoh:

Gunakan:

`Belum Disalurkan`

Jangan:

`Outstanding Payable Distribution`

Setiap halaman harus memiliki:

- loading state;
- empty state;
- error state;
- success feedback;
- confirmation untuk aksi sensitif.

Aksi sensitif:

- Void;
- Reversal;
- Refund;
- Blokir kartu;
- Reset PIN;
- Tutup sesi kas;
- Penyaluran.

---

# 40. Search, Filter, Sort, Pagination

Semua tabel besar wajib mendukung:

- search;
- filter;
- sorting;
- pagination.

Filter dapat dikombinasikan.

Contoh:

`2026/2027 + Asrama A + SPP + Belum Lunas`

Server-side filtering dan sorting digunakan untuk dataset besar.

---

# 41. Performa

Jangan memuat seluruh transaksi sekaligus.

Gunakan:

- pagination;
- indexing;
- optimized queries;
- server-side filtering;
- server-side sorting.

Pertimbangkan index pada:

- student_id;
- status;
- payment_item_id;
- period;
- academic_year;
- created_at;
- reference.

---

# 42. Sumber Kebenaran Data

Tetapkan sumber data:

| Data | Source of Truth |
|---|---|
| Santri | Master santri existing |
| Orang tua | Sistem existing |
| Penyedia katering | Modul Katering & Laundry |
| Penyedia laundry | Modul Katering & Laundry |
| Pembayaran online | Payment + verified Duitku callback |
| Pembayaran tunai | Sistem transaksi internal |
| Saldo uang jajan | Uang Jajan Ledger |
| Dana tersedia disalurkan | Payment Allocation - Distribution |
| Settlement | Settlement records |
| Tarif | Versioned tariff configuration |

Jangan membuat angka summary independen yang tidak dapat ditelusuri ke transaksi asal.

---

# 43. Integrasi dengan Sistem Existing

Sebelum implementasi, audit:

- database schema;
- master santri;
- orang tua;
- authentication;
- role;
- permission;
- Portal Orang Tua;
- Modul Katering & Laundry;
- API;
- shared components;
- helpers;
- services;
- utilities;
- design system;
- payment integration;
- storage;
- deployment environment.

Gunakan data existing bila tersedia.

Jangan membuat sistem paralel yang menduplikasi master data.

---

# 44. Larangan Refactor Besar

Jangan melakukan refactor besar pada:

- authentication;
- master santri;
- Portal Orang Tua;
- Katering & Laundry;
- modul existing lainnya;

kecuali benar-benar diperlukan.

Jika perlu perubahan, lakukan seminimal mungkin.

---

# 45. Database Migration

Migration harus:

- safe;
- non-destructive;
- terukur;
- reversible bila memungkinkan.

Jangan:

- drop table;
- drop column;
- menghapus data;
- mengubah data historis;

tanpa kebutuhan eksplisit.

Sebelum migration:

1. audit schema;
2. identifikasi dependencies;
3. susun migration plan;
4. identifikasi rollback strategy.

---

# 46. Acceptance Criteria Umum

Sistem dianggap memenuhi PRD ketika:

1. Pembayaran online tercatat otomatis tanpa input manual petugas.
2. Callback ganda tidak menghasilkan transaksi ganda.
3. Pembayaran tunai dapat dicatat dari Status Pembayaran atau Loket.
4. Satu payment dapat dialokasikan ke beberapa item.
5. Tarif historis tidak berubah saat tarif baru dibuat.
6. SPP tidak dapat dicicil.
7. USPP selalu dapat dicicil.
8. Pembebasan dapat diatur per santri/per item/per periode.
9. Uang jajan tidak dianggap sebagai pendapatan pesantren.
10. Saldo uang jajan dapat ditelusuri ke ledger.
11. Kartu hilang dapat dicabut tanpa menghilangkan histori.
12. PIN tidak disimpan plaintext.
13. Loket memiliki sesi kas.
14. Penyaluran tidak dapat melebihi dana tersedia.
15. Histori katering/laundry tidak berubah saat provider santri berubah.
16. Semua transaksi penting memiliki audit trail.
17. Tidak ada hard delete transaksi keuangan.
18. Rekonsiliasi tidak memodifikasi transaksi secara diam-diam.
19. Dashboard memisahkan uang jajan dari dana pesantren.
20. Laporan PDF dan Excel dapat dihasilkan.
21. UI dapat dipahami pengguna non-akuntan.
22. Integrasi tidak menduplikasi master data existing.

---

# 47. Tahapan Implementasi

## Fase 1 — Audit dan Fondasi

- audit codebase;
- audit database;
- audit auth;
- audit role;
- audit Portal Orang Tua;
- audit Katering & Laundry;
- audit Duitku existing;
- desain data model;
- desain ledger;
- desain allocation;
- desain settlement;
- desain distribution;
- migration plan.

**Fase ini tidak boleh langsung membangun seluruh UI.**

---

## Fase 2 — Tarif dan Tagihan

- payment item;
- tariff versioning;
- academic year;
- exemption;
- installment rules;
- obligation engine.

---

## Fase 3 — Payment Engine

- Payment Order;
- Payment;
- Allocation;
- Duitku callback;
- Fixed VA;
- settlement;
- payment status.

---

## Fase 4 — Status Pembayaran

- ringkasan;
- bulanan;
- tahunan;
- USPP;
- tunggakan;
- pembayaran tunai.

---

## Fase 5 — Uang Jajan dan Kredensial

- wallet ledger;
- limit;
- QR card;
- PIN;
- card lifecycle;
- batch printing.

---

## Fase 6 — Loket

- scan;
- identity verification;
- PIN;
- withdrawal;
- deposit;
- cash payment;
- cash session.

---

## Fase 7 — Penyaluran

- Bendahara Pesantren;
- Katering;
- Laundry;
- distribution engine;
- distribution receipt.

---

## Fase 8 — Rekonsiliasi

- Duitku;
- settlement;
- cash session;
- mismatch resolution.

---

## Fase 9 — Dashboard dan Riwayat

- dashboard;
- charts;
- transaction history;
- filters;
- shortcuts.

---

## Fase 10 — Laporan dan Cetak

- PDF;
- Excel;
- per-student reports;
- arrears;
- exemptions;
- receipts;
- distributions;
- settlement;
- reconciliation.

---

# 48. Instruksi untuk AI / Coding Agent

Dokumen ini adalah **source of truth** untuk pengembangan Sistem Keuangan Baru.

AI wajib:

1. Membaca PRD sebelum membuat perubahan.
2. Audit codebase sebelum membuat model baru.
3. Audit database sebelum membuat migration.
4. Tidak membuat duplikasi data existing.
5. Tidak melakukan refactor besar tanpa kebutuhan.
6. Tidak mengubah business rule diam-diam.
7. Tidak melakukan hard delete transaksi.
8. Tidak mengubah histori transaksi.
9. Menggunakan transaksi database untuk operasi atomik.
10. Menggunakan idempotency untuk integrasi payment gateway.
11. Memprioritaskan keamanan dan konsistensi dibanding kemudahan edit manual.
12. Menjelaskan jika requirement tertentu bertentangan dengan kondisi codebase existing.
13. Mengusulkan alternatif sebelum mengubah requirement.
14. Mengerjakan fitur secara bertahap sesuai fase.
15. Tidak langsung membangun dashboard/UI sebelum financial engine dan data model dipahami.

Jika terdapat konflik antara implementasi existing dan PRD ini:

- jangan diam-diam mengubah requirement;
- dokumentasikan konflik;
- jelaskan dampaknya;
- usulkan opsi paling aman.

---

# 49. Target Akhir

Hasil akhir harus menjadi sistem keuangan pesantren yang:

- sederhana;
- aman;
- cepat;
- audit-friendly;
- tidak rawan transaksi ganda;
- tidak kehilangan histori;
- tidak memiliki hard delete transaksi keuangan;
- terintegrasi dengan Duitku;
- memiliki Fixed VA;
- terintegrasi Portal Orang Tua;
- terintegrasi Modul Katering & Laundry;
- mendukung pembayaran online;
- mendukung pembayaran tunai;
- mendukung uang jajan;
- mendukung kartu QR;
- mendukung loket koperasi;
- mendukung sesi kas;
- mendukung penyaluran;
- mendukung rekonsiliasi;
- mendukung PDF;
- mendukung Excel;
- memiliki UX sederhana untuk pengguna non-akuntan.

---

# 50. Catatan Penting

Dokumen ini berisi requirement produk dan aturan bisnis.

Keputusan implementasi teknis seperti:

- nama tabel;
- nama field;
- struktur folder;
- framework patterns;
- API routes;
- ORM strategy;
- transaction strategy;
- indexing detail;

harus disesuaikan setelah audit codebase existing.

Namun keputusan teknis tersebut tidak boleh melanggar business rule dalam PRD ini.

