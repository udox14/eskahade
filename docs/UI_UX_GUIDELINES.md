# UI/UX Guidelines
# Sistem Keuangan Baru

**Status:** v1.0  
**Dokumen pendamping:** `SISTEM_KEUANGAN_BARU_PRD.md`  
**Target implementasi:** Codex / AI Coding Agent  
**Prioritas platform:** Desktop administration, tablet usable, Portal Orang Tua mobile responsive  

---

# 1. Tujuan Dokumen

Dokumen ini adalah sumber arahan visual dan UX untuk seluruh implementasi **Sistem Keuangan Baru**.

PRD menentukan **apa yang harus dibangun**.

Dokumen ini menentukan **bagaimana produk tersebut harus terasa, terlihat, dan digunakan**.

AI/Coding Agent wajib membaca:

1. `SISTEM_KEUANGAN_BARU_PRD.md`
2. `UI_UX_GUIDELINES.md`

sebelum mengimplementasikan UI.

Dokumen ini tidak mengharuskan pergantian UI framework atau design system existing.

Sebelum membuat komponen baru, audit terlebih dahulu komponen dan design system aplikasi yang sudah tersedia.

---

# 2. Sasaran Pengguna

Pengguna utama bukan:

- akuntan;
- staf bank;
- analis finansial;
- technical user.

Pengguna utama adalah:

- Bendahara Pesantren;
- Admin Koperasi;
- Petugas Koperasi;
- Orang Tua.

Karena itu UI harus:

- mudah dipahami;
- cepat digunakan;
- tidak menakutkan;
- tidak penuh jargon;
- tidak terasa seperti internet banking;
- tidak terasa seperti software akuntansi enterprise;
- tetap profesional dan modern.

---

# 3. Target Visual

Target visual utama:

- modern;
- clean;
- polished;
- professional;
- calm;
- lightweight;
- high readability;
- operational;
- trustworthy;
- consistent.

Produk harus terasa seperti **software operasional modern yang matang**, bukan admin template generik.

Kualitas desain sebaiknya mengambil inspirasi dari prinsip visual produk modern seperti:

- hierarchy yang kuat;
- whitespace yang cukup;
- typography yang bersih;
- tabel yang rapi;
- navigation sederhana;
- feedback interaksi yang jelas;
- detail UI yang polished.

Jangan menyalin branding atau layout aplikasi lain secara literal.

---

# 4. Prinsip Desain Utama

## 4.1 Clarity Before Decoration

Prioritaskan:

1. keterbacaan;
2. hierarchy;
3. alignment;
4. spacing;
5. grouping;
6. feedback;

baru kemudian dekorasi.

Jika sebuah elemen tidak membantu user memahami atau menyelesaikan tugas, pertimbangkan untuk tidak menampilkannya.

---

## 4.2 Reduce Visual Noise

Hindari:

- terlalu banyak card;
- terlalu banyak badge;
- terlalu banyak border;
- terlalu banyak icon;
- terlalu banyak warna;
- terlalu banyak shadow;
- terlalu banyak CTA;
- terlalu banyak informasi sekaligus.

UI keuangan harus terasa tenang.

---

## 4.3 Progressive Disclosure

Informasi utama ditampilkan terlebih dahulu.

Informasi detail dibuka ketika user membutuhkan.

Gunakan:

- drawer;
- modal;
- expandable section;
- detail page;

sesuai kompleksitas.

Jangan memaksa seluruh informasi terlihat dalam satu tabel.

---

## 4.4 Consistency Over Novelty

Setelah satu pattern disetujui, gunakan kembali ke seluruh modul.

Contoh:

Jika detail transaksi memakai right drawer, gunakan pattern serupa pada:

- detail pembayaran;
- detail uang jajan;
- detail penyaluran;
- detail rekonsiliasi.

Jangan membuat setiap halaman terasa seperti dibuat oleh tim berbeda.

---

# 5. Audit Existing UI Sebelum Coding

Sebelum membuat UI baru, AI wajib mengaudit:

- application shell;
- sidebar;
- top navigation;
- page container;
- typography;
- color tokens;
- spacing tokens;
- radius;
- shadows;
- buttons;
- inputs;
- tables;
- tabs;
- cards;
- badges;
- modals;
- drawers;
- alerts;
- toast;
- skeleton;
- pagination;
- form components;
- date picker;
- select;
- command/search;
- design system;
- responsive patterns.

Jika komponen existing layak digunakan, reuse.

Jangan mengganti framework UI hanya demi modul ini.

Jangan memasukkan UI library baru hanya untuk satu komponen jika existing system sudah memiliki alternatif yang memadai.

---

# 6. Design Tokens

Gunakan token existing terlebih dahulu.

Jika design system existing belum memiliki aturan jelas, gunakan prinsip berikut sebagai fallback.

## 6.1 Spacing

Gunakan sistem spacing yang konsisten.

Contoh ritme:

- 4px — micro spacing;
- 8px — compact spacing;
- 12px — small gap;
- 16px — default gap;
- 20–24px — section internal spacing;
- 32px — section spacing;
- 40–48px — major section spacing.

Hindari nilai spacing random.

---

## 6.2 Border Radius

Gunakan radius moderat.

Rekomendasi jika tidak ada token existing:

- input/button kecil: 8–10px;
- card/panel: 12–16px;
- modal/drawer section: mengikuti existing system.

Jangan membuat semua komponen terlalu rounded.

---

## 6.3 Shadows

Gunakan shadow secara hemat.

Default:

- card utama boleh tanpa shadow jika border/subtle surface cukup;
- dropdown/modal/drawer dapat menggunakan shadow untuk separation;
- hindari shadow besar dan dramatis.

---

## 6.4 Borders

Gunakan border tipis dan subtle.

Jangan membuat seluruh layout terlihat seperti kumpulan kotak.

Gunakan whitespace sebagai alat grouping utama.

---

# 7. Warna

## 7.1 Prinsip

Jangan menggunakan banyak warna untuk dekorasi.

Gunakan warna terutama untuk:

- hierarchy;
- state;
- warning;
- error;
- success;
- action.

Warna brand existing tetap menjadi dasar.

---

## 7.2 Semantic Colors

Gunakan semantic status secara konsisten.

Contoh konsep:

- sukses / lunas / settled;
- warning / pending / parsial;
- error / gagal / mismatch;
- neutral / belum diproses;
- informational / informational state.

Jangan membuat setiap status memiliki warna unik tanpa alasan.

---

## 7.3 Financial Numbers

Jangan otomatis memberikan warna hijau pada semua penerimaan dan merah pada semua pengeluaran.

Gunakan warna hanya jika membantu memahami state.

Angka nominal utama sebaiknya tetap memiliki visual weight dari typography, bukan warna mencolok.

---

# 8. Typography

Gunakan font existing aplikasi.

Hierarchy minimum:

## Page Title

Jelas, prominent, tidak terlalu besar.

## Section Title

Membedakan kelompok informasi.

## Body

Nyaman dibaca dalam penggunaan lama.

## Secondary Text

Untuk metadata, penjelasan, periode, reference.

## Financial Number

Gunakan tabular numeric jika tersedia.

Nominal harus mudah dibandingkan secara visual.

---

# 9. Application Shell

Gunakan navigation existing.

Jangan membuat shell baru hanya untuk Sistem Keuangan Baru kecuali benar-benar diperlukan.

Jika modul berada dalam sidebar, kelompokkan secara logis.

Contoh group:

**Keuangan**

- Ringkasan
- Status Pembayaran
- Uang Jajan
- Loket
- Penyaluran
- Rekonsiliasi
- Riwayat Transaksi
- Cetak
- Kredensial
- Pengaturan

Urutan dapat disesuaikan dengan navigation existing.

---

# 10. Pola Layout Halaman

Gunakan pola umum berikut.

## 10.1 Header

Berisi:

- page title;
- short description jika diperlukan;
- primary action di kanan.

Contoh:

**Status Pembayaran**

Pantau pembayaran seluruh santri berdasarkan periode dan item.

`[Catat Pembayaran]`

Jangan membuat header terlalu tinggi.

---

## 10.2 Summary Section

Opsional.

Hanya tampil jika memberikan nilai.

Maksimal sekitar 3–5 summary card dalam satu area utama.

Contoh:

- Total Tagihan
- Sudah Dibayar
- Belum Dibayar
- Santri Menunggak

Jangan membuat setiap angka menjadi card.

---

## 10.3 Control Bar

Berisi:

- search;
- period selector;
- important filters;
- optional filter button;
- optional view setting.

Primary action jangan dicampur dengan filter jika tidak perlu.

---

## 10.4 Main Content

Biasanya:

- table;
- chart;
- grouped list;
- interactive POS interface;
- report preview.

Main content harus menjadi visual focus.

---

# 11. Status Pembayaran sebagai Benchmark UI

**Modul Status Pembayaran harus menjadi benchmark visual pertama.**

Jangan membuat seluruh modul UI sekaligus sebelum halaman ini stabil.

Halaman ini harus memvalidasi:

- typography;
- tabs;
- summary cards;
- filter;
- search;
- table;
- badges;
- drawer;
- modal;
- pagination;
- empty state;
- loading state;
- responsiveness.

Setelah pattern disetujui, reuse ke modul lain.

---

# 12. Status Pembayaran — Rekomendasi Layout

## Header

Kiri:

**Status Pembayaran**

Deskripsi singkat.

Kanan:

`Catat Pembayaran`

---

## Tabs

- Ringkasan
- Bulanan
- Tahunan
- USPP
- Tunggakan

Tabs harus mudah dibaca dan tidak terlalu dekoratif.

---

## Summary

Contoh:

- Santri Aktif
- Lunas Periode Ini
- Belum Lunas
- Total Tunggakan

Jangan lebih dari yang dibutuhkan.

---

## Filters

Prioritas filter:

- Tahun Ajaran
- Bulan
- Asrama
- Kelas
- Status

Filter lanjutan dapat dibuka melalui:

`Filter Lainnya`

---

## Table

Contoh kolom Ringkasan:

- Santri
- Asrama / Kamar
- SPP
- Uang Makan
- Uang Nyuci
- Tahunan
- USPP
- Aksi

Nama santri menjadi anchor visual utama.

Jangan membuat kolom terlalu sempit sampai status sulit dibaca.

Klik row atau tombol `Detail` membuka drawer.

---

# 13. Tables

Tabel adalah komponen utama sistem.

## 13.1 Prinsip

- readable;
- tidak terlalu padat;
- alignment konsisten;
- row hover subtle;
- sticky header jika panjang;
- sorting dari header;
- pagination jelas;
- filter server-side;
- tidak terlalu banyak border.

---

## 13.2 Alignment

- teks: kiri;
- identitas: kiri;
- status: kiri atau tengah secara konsisten;
- nominal: kanan;
- tanggal: konsisten;
- action: kanan.

Gunakan tabular numbers jika memungkinkan.

---

## 13.3 Row Density

Default row harus nyaman dibaca.

Jangan terlalu compact hanya untuk menampilkan banyak data.

Jika density switch sudah menjadi pattern existing, boleh gunakan:

- Comfortable
- Compact

Jika tidak, cukup satu density yang bagus.

---

## 13.4 Cell Content

Jangan menaruh terlalu banyak informasi dalam satu cell.

Contoh identitas santri boleh menggunakan:

**Ahmad Buhaeti**  
NIS 12345 · Asrama Bahagia / 23

Tetapi jangan memasukkan 5–6 metadata sekaligus.

---

# 14. Badge dan Status

Gunakan badge hanya untuk status.

Contoh:

- Lunas
- Belum Lunas
- Cicilan
- Pending
- Settled
- Gagal
- Diblokir

Jangan menjadikan:

- nominal;
- tanggal;
- nama;
- asrama;
- metode;

sebagai badge tanpa alasan.

---

# 15. Buttons

Gunakan hierarchy:

## Primary

Satu tindakan utama.

Contoh:

`Catat Pembayaran`

## Secondary

Tindakan pendukung.

## Tertiary / Ghost

Aksi kecil atau contextual.

## Destructive

Untuk aksi berisiko.

Contoh:

`Void Transaksi`

Jangan memiliki 4 tombol primary dalam satu area.

---

# 16. Forms

## 16.1 Prinsip

- sederhana;
- grouping jelas;
- label selalu terlihat;
- helper text hanya jika perlu;
- validation dekat dengan field;
- server-side validation wajib.

---

## 16.2 Form Panjang

Jika form panjang:

- gunakan sections;
- gunakan step flow jika memang berupa proses;
- jangan memasukkan 20 field ke modal kecil.

---

# 17. Modal vs Drawer vs Page

## Modal

Gunakan untuk:

- konfirmasi;
- aksi singkat;
- form pendek;
- input pembayaran tunai sederhana.

## Drawer

Gunakan untuk:

- detail transaksi;
- histori pembayaran;
- detail santri;
- detail penyaluran;
- detail uang jajan.

Drawer ideal untuk mempertahankan context tabel.

## Dedicated Page

Gunakan jika:

- workflow panjang;
- banyak data;
- banyak aksi;
- membutuhkan deep linking.

---

# 18. Dashboard

Dashboard bukan kumpulan card.

Gunakan hierarchy.

## Area 1 — Key Numbers

Maksimal beberapa angka paling penting.

Contoh:

- Penerimaan Periode Ini
- Siap Disalurkan
- Total Tunggakan
- Dana Uang Jajan

Dana uang jajan harus terpisah secara visual dari dana pesantren.

---

## Area 2 — Trend / Insight

Gunakan chart jika benar-benar berguna.

Contoh:

- penerimaan per bulan;
- tunggakan berdasarkan item;
- pembayaran online vs tunai.

Jangan membuat pie chart hanya agar dashboard terlihat ramai.

---

## Area 3 — Butuh Perhatian

Contoh:

- settlement pending;
- reconciliation mismatch;
- sesi kas belum ditutup;
- transaksi membutuhkan pemeriksaan.

Ini lebih penting daripada chart dekoratif.

---

## Area 4 — Aktivitas

Contoh:

- pembayaran terbaru;
- penyaluran terbaru;
- aktivitas loket.

---

## Area 5 — Quick Actions

Contoh:

- Catat Pembayaran Tunai
- Buka Loket
- Rekonsiliasi
- Cetak Laporan

Jangan terlalu banyak.

---

# 19. Modul Uang Jajan

UI harus menekankan:

- saldo;
- limit;
- aktivitas terbaru.

Contoh tabel:

- Santri
- Asrama
- Saldo
- Limit Hari Ini
- Penarikan Terakhir
- Top-up Terakhir
- Aksi

Klik detail membuka drawer.

---

## Detail Uang Jajan

Drawer dapat menampilkan:

### Header
- foto;
- nama;
- asrama/kamar;
- saldo.

### Limit
- global;
- orang tua;
- effective limit.

### Recent Activity
Timeline atau table sederhana.

Jangan membuat visual seperti mobile banking.

---

# 20. Modul Loket

Modul Loket memiliki UI yang lebih fokus.

Target:

**POS / cashier style**, bukan dashboard.

---

## 20.1 State Awal

Fokus utama:

`Scan kartu santri`

Tampilkan:

- scanner state;
- manual fallback jika memang diizinkan;
- status sesi kas;
- nama petugas.

Minimalkan distraksi.

---

## 20.2 Setelah Scan

Foto santri menjadi visual utama.

Tampilkan:

- foto besar;
- nama;
- NIS;
- asrama/kamar;
- kelas;
- status kartu.

Petugas harus bisa mencocokkan wajah dengan cepat.

---

## 20.3 Setelah PIN Valid

Tampilkan:

- Saldo Uang Jajan
- Limit Hari Ini
- Sudah Ditarik Hari Ini
- Sisa Limit

Action utama:

- Tarik Uang
- Setor / Bayar

Gunakan tombol besar, jelas, tetapi tidak berlebihan.

---

## 20.4 Penarikan

Input nominal harus sangat mudah.

Berikan quick amount chips hanya jika berguna.

Contoh:

- Rp10.000
- Rp20.000
- Rp50.000

Tetap sediakan input custom.

Jangan izinkan nominal melebihi saldo/limit.

---

## 20.5 Transaction Success

Tampilkan success state yang jelas.

Contoh:

**Penarikan berhasil**

Rp50.000

Saldo setelah transaksi: Rp125.000

Tombol:

- Selesai
- Cetak Bukti jika dibutuhkan

Setelah selesai, kembali ke state scan dengan cepat.

---

# 21. Modul Penyaluran

Gunakan tabs:

- Bendahara Pesantren
- Katering
- Laundry

---

## Katering / Laundry

Summary cards:

- Dana Masuk
- Siap Disalurkan
- Sudah Disalurkan
- Belum Disalurkan

Kemudian daftar provider.

Table contoh:

- Penyedia
- Santri
- Sudah Bayar
- Belum Bayar
- Dana Masuk
- Sudah Disalurkan
- Sisa
- Aksi

Detail provider membuka drawer/page.

---

# 22. Modul Rekonsiliasi

Jangan membuat rekonsiliasi terasa seperti layar developer.

Gunakan bahasa operasional.

Kelompokkan:

- Cocok
- Belum Settlement
- Perlu Diperiksa
- Nominal Berbeda
- Tidak Ditemukan

Tampilkan problem first.

Default view sebaiknya memprioritaskan transaksi bermasalah.

Gunakan empty state positif jika tidak ada mismatch.

Contoh:

**Tidak ada transaksi yang perlu diperiksa.**

---

# 23. Modul Riwayat Transaksi

Ini adalah data-heavy screen.

Prioritas:

- search;
- filter;
- sorting;
- table;
- drawer detail.

Jangan menampilkan semua metadata di tabel.

Table utama cukup:

- Waktu
- Reference
- Santri/Penerima
- Jenis
- Item
- Nominal
- Metode
- Status

Metadata detail masuk drawer.

---

# 24. Modul Pengaturan

Model SPA.

Gunakan sidebar/sub-navigation internal jika jumlah section banyak.

Contoh:

- Tarif
- Cicilan
- Pembebasan
- Uang Jajan
- Payment Gateway
- Rekening Penyedia

Jangan menaruh seluruh pengaturan dalam satu halaman panjang tanpa navigasi.

---

# 25. Kredensial / Kartu QR

Gunakan dua mode utama:

## Management View

Tabel:

- Santri
- NIS
- Asrama
- Status Kartu
- Diterbitkan
- Aksi

## Print View

Preview kartu harus menunjukkan hasil cetak sebenarnya.

Batch print:

- konsisten;
- ukuran kartu kredit;
- margin aman;
- tidak terpotong.

---

# 26. Portal Orang Tua

Mobile-first.

Target:

- sederhana;
- tidak banyak langkah;
- nominal jelas;
- item mudah dipilih;
- status pembayaran jelas.

Gunakan card/list yang sesuai mobile, tetapi jangan terlalu dekoratif.

Flow pembayaran:

1. Pilih item.
2. Review.
3. Pilih metode.
4. Bayar.
5. Success/status.

Review page wajib jelas sebelum payment dibuat.

---

# 27. Empty States

Setiap halaman wajib punya empty state yang informatif.

Jangan hanya:

`No data`

Contoh:

**Belum ada penyaluran bulan ini.**  
Dana yang sudah tersedia dapat disalurkan dari halaman ini.

Jika relevan, berikan CTA.

---

# 28. Loading States

Gunakan:

- skeleton untuk list/table;
- inline spinner untuk small action;
- disabled state ketika submit;
- progress/feedback untuk export panjang.

Jangan membuat seluruh halaman blank hanya dengan spinner di tengah.

---

# 29. Error States

Error harus menggunakan bahasa manusia.

Buruk:

`500 Internal Server Error`

Lebih baik:

**Data transaksi belum dapat dimuat. Coba lagi.**

Technical detail boleh masuk log, bukan UI user.

---

# 30. Confirmation

Aksi sensitif wajib confirmation.

Contoh:

- Void
- Reversal
- Refund
- Blokir kartu
- Cabut kartu
- Reset PIN
- Tutup sesi kas
- Penyaluran

Konfirmasi harus menyebut akibat.

Contoh:

**Cabut kartu Ahmad Buhaeti?**

Kartu ini tidak dapat digunakan lagi. Histori transaksi tetap tersimpan.

---

# 31. Toast dan Feedback

Gunakan toast untuk hasil aksi singkat.

Contoh:

- Pembayaran berhasil dicatat.
- Kartu berhasil diblokir.
- Pengaturan tersimpan.

Jangan gunakan toast sebagai satu-satunya tempat menampilkan error field.

---

# 32. Search

Search harus toleran dan berguna.

Untuk santri, dukung pencarian minimal berdasarkan:

- nama;
- NIS.

Jika existing data memungkinkan:

- asrama;
- kamar.

Debounce server-side search untuk dataset besar.

---

# 33. Filters

Gunakan filter yang paling sering dipakai langsung di toolbar.

Filter jarang dipakai masuk ke:

`Filter Lainnya`

Tampilkan active filters secara jelas.

Sediakan:

`Reset Filter`

Jangan membuat bar filter memenuhi setengah layar.

---

# 34. Sorting

Sorting dari table header.

Tandai arah sort.

Jangan memberikan dropdown sort terpisah jika table header sudah memadai.

---

# 35. Pagination

Gunakan server-side pagination.

Tampilkan:

- jumlah data;
- current range;
- page navigation.

Page size dapat configurable jika pattern existing mendukung.

---

# 36. Responsive

## Desktop

Primary target untuk:

- bendahara;
- admin koperasi;
- loket;
- laporan.

## Tablet

Harus tetap usable.

Table boleh:

- horizontal scroll;
- menyembunyikan kolom secondary;
- menggunakan responsive detail.

## Mobile

Portal Orang Tua wajib bagus di mobile.

Administrative pages cukup usable, tidak harus feature-identical jika workflow memang desktop-first.

---

# 37. Accessibility

Minimal:

- keyboard focus visible;
- button labels jelas;
- icon-only button memiliki accessible label;
- form label terhubung;
- error tidak hanya dibedakan warna;
- contrast cukup;
- clickable target cukup besar.

---

# 38. Icons

Gunakan icon library existing.

Icon digunakan untuk:

- membantu scanning;
- memperjelas action;
- status tertentu jika diperlukan.

Jangan gunakan icon di setiap label hanya untuk dekorasi.

---

# 39. Charts

Charts hanya jika memberi insight.

Aturan:

- label jelas;
- tooltip berguna;
- period jelas;
- legends sederhana;
- tidak terlalu banyak series;
- tidak menggunakan 3D chart;
- tidak menggunakan donut/pie untuk data yang lebih jelas sebagai angka/table.

---

# 40. Microcopy

Gunakan bahasa Indonesia natural.

Contoh:

Buruk:
`Submit Payment Allocation`

Baik:
`Catat Pembayaran`

Buruk:
`Outstanding`

Baik:
`Belum Dibayar`

Buruk:
`Distribution`

Baik di UI:
`Penyaluran`

Technical naming tetap boleh dipakai di backend.

---

# 41. Date & Time

Tampilkan waktu menggunakan Asia/Jakarta.

Format sebaiknya konsisten.

Contoh UI:

`19 Sep 2026, 09.32`

Untuk tabel padat dapat:

`19 Sep 2026`

dan waktu di secondary text.

---

# 42. Nominal

Gunakan format Rupiah konsisten.

Contoh:

`Rp150.000`

Jangan:

`Rp 150,000.00`

Untuk angka besar di dashboard boleh menggunakan format ringkas hanya jika tetap jelas.

---

# 43. Detail Drawer Standard

Pattern default detail drawer:

## Header
- title;
- status;
- reference.

## Primary Information
- nominal;
- waktu;
- actor/source.

## Related Entity
- santri/provider.

## Breakdown
- allocation/item.

## Timeline / History
- creation;
- payment;
- settlement;
- reversal jika ada.

## Actions
Hanya tindakan yang relevan.

Gunakan divider/section, bukan card di setiap kelompok.

---

# 44. Desain Receipt / Bukti

Bukti cetak harus:

- bersih;
- readable;
- tidak penuh warna;
- printer-friendly;
- memiliki reference;
- mencantumkan identitas pesantren;
- memiliki struktur informasi jelas.

Print preview harus mendekati hasil akhir.

---

# 45. Excel UX

Export Excel tidak perlu UI kompleks.

Sediakan:

- filter periode;
- scope;
- jenis laporan;
- export button.

Berikan feedback selama file dibuat.

---

# 46. Tour / Guide

Tour tidak boleh terlalu panjang.

Ideal:

3–6 step per halaman utama.

Contoh:

1. Filter periode.
2. Lihat status pembayaran.
3. Buka detail santri.
4. Catat pembayaran tunai.
5. Buka tunggakan.

Tour harus dapat:

- dilewati;
- ditutup;
- dijalankan ulang.

---

# 47. UX Safety untuk Transaksi

Sebelum transaksi penting dikonfirmasi, tampilkan review.

Contoh pembayaran tunai:

Santri: Ahmad Buhaeti  
Item: SPP September  
Nominal: Rp200.000  
Metode: Tunai

`Konfirmasi Pembayaran`

Jangan membuat transaksi finansial terjadi karena satu klik ambigu.

---

# 48. Avoid Accidental Double Submit

Untuk action financial:

- disable submit setelah klik;
- tampilkan loading;
- gunakan idempotency backend;
- jangan mengandalkan UI saja.

---

# 49. UI Benchmark Process

Sebelum implementasi seluruh modul:

## Step 1
Audit existing UI.

## Step 2
Buat halaman **Status Pembayaran** sebagai benchmark.

## Step 3
Review:

- page hierarchy;
- typography;
- spacing;
- cards;
- tabs;
- filters;
- table;
- badge;
- drawer;
- modal;
- states.

## Step 4
Perbaiki sampai pattern matang.

## Step 5
Extract reusable components.

## Step 6
Gunakan pattern tersebut untuk modul lain.

Jangan membuat 10 halaman sekaligus sebelum benchmark disetujui.

---

# 50. Definition of Good UI

Sebuah halaman dianggap bagus jika:

1. User memahami tujuan halaman dalam beberapa detik.
2. Primary action mudah ditemukan.
3. Data penting mudah dipindai.
4. Tidak terlalu banyak warna.
5. Tidak terlalu banyak card.
6. Tidak terlalu banyak badge.
7. Spacing konsisten.
8. Tabel nyaman dibaca.
9. Detail tidak memenuhi layar utama.
10. Error mudah dipahami.
11. Aksi finansial aman.
12. Layout terasa polished.
13. Tidak terlihat seperti template admin generik.
14. Tidak terlihat seperti internet banking.
15. Konsisten dengan halaman lain.

---

# 51. Anti-Patterns yang Dilarang

JANGAN:

- membuat dashboard berisi 12+ card statistik;
- memberi gradient di banyak tempat;
- menggunakan shadow berat;
- membuat semua item punya icon;
- membuat semua cell menjadi badge;
- memberi warna berbeda ke setiap kategori;
- membuat tabel dengan terlalu banyak kolom;
- menaruh histori panjang langsung di halaman utama;
- menggunakan istilah backend di UI;
- membuat confirmation yang tidak menjelaskan akibat;
- menggunakan modal untuk konten sangat panjang;
- membuat setiap halaman punya style unik;
- menggunakan komponen baru jika komponen existing sudah memadai;
- mengubah design system global tanpa kebutuhan;
- menambah dependency UI besar tanpa alasan;
- membuat responsive dengan sekadar mengecilkan desktop layout;
- membuat dashboard/chart hanya sebagai dekorasi;
- membuat semua informasi menjadi card;
- menampilkan ID internal/database ID kepada user tanpa kebutuhan;
- menampilkan raw enum seperti `PAYMENT_PARTIALLY_ALLOCATED` kepada user.

---

# 52. Instruksi Khusus untuk Codex / AI Coding Agent

Sebelum mengimplementasikan halaman:

1. Baca PRD.
2. Baca dokumen ini.
3. Audit komponen UI existing.
4. Gunakan komponen existing jika layak.
5. Jangan mengganti framework UI.
6. Jangan membuat semua halaman sekaligus.
7. Implementasikan satu benchmark screen terlebih dahulu.
8. Jangan mengubah business rule demi mempermudah UI.
9. Jangan mengarang requirement.
10. Jika existing design system bertentangan dengan guideline ini, pertahankan konsistensi aplikasi dan dokumentasikan tradeoff.
11. Fokus pada hierarchy, spacing, readability, dan workflow.
12. Jangan sekadar membuat UI “berfungsi”; hasil harus polished dan konsisten.

---

# 53. Prompt Singkat untuk Memulai UI Benchmark

Gunakan prompt berikut setelah audit codebase selesai:

> Baca `SISTEM_KEUANGAN_BARU_PRD.md` dan `UI_UX_GUIDELINES.md`.
>
> Audit terlebih dahulu design system dan komponen UI existing.
>
> Implementasikan hanya halaman **Status Pembayaran** sebagai visual benchmark Sistem Keuangan Baru.
>
> Jangan membuat seluruh modul.
>
> Halaman benchmark harus mencakup:
> - header;
> - tabs;
> - summary;
> - search;
> - filters;
> - responsive table;
> - sorting;
> - pagination;
> - status treatment;
> - detail drawer;
> - modal Catat Pembayaran;
> - loading state;
> - empty state;
> - error state.
>
> Gunakan data existing/real integration jika fondasinya sudah tersedia. Jika backend untuk bagian tertentu belum tersedia pada fase ini, jangan membuat arsitektur keuangan palsu hanya untuk UI.
>
> Reuse design system existing.
>
> Prioritaskan visual hierarchy, whitespace, typography, alignment, interaction polish, dan konsistensi.
>
> Jangan membuat UI seperti aplikasi bank, software akuntansi kompleks, atau generic admin dashboard.
>
> Setelah halaman benchmark selesai, berhenti. Jangan lanjut ke halaman lainnya sebelum benchmark direview.

---

# 54. Source of Truth

Untuk Sistem Keuangan Baru:

- Business requirements: `SISTEM_KEUANGAN_BARU_PRD.md`
- UI/UX requirements: `UI_UX_GUIDELINES.md`
- Existing codebase: source of truth untuk struktur teknis yang sudah ada

Jika terdapat konflik:

1. jangan diam-diam mengambil keputusan;
2. identifikasi konflik;
3. pertahankan aturan bisnis PRD;
4. pertahankan konsistensi aplikasi selama tidak melanggar PRD;
5. dokumentasikan perubahan yang diperlukan.

