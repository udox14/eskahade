# Pelanggaran Pengajian

Modul manual berada di `/dashboard/akademik/pelanggaran-pengajian`, dalam kelompok Akademik. Tabel sumber, revisi, dan izin perubahan tetap terpisah. Catatan aktif ikut dihitung sebagai satu kejadian dalam rekap umum, profil, pimpinan, portal orang tua, ekspor, dan surat melalui pembacaan gabungan. Foto bukti tidak diberikan kepada orang tua. Rekap khusus modul ini tetap hanya menghitung pengajian manual. Lihat [model jumlah kejadian](PELANGGARAN_JUMLAH_KEJADIAN.md).

## Operasional

- Input dilakukan melalui **Riwayat → Catat Pelanggaran**. Satu kejadian berisi satu santri, satu jenis, tanggal/jam UTC+7, sesi wajib, dan catatan opsional.
- Sesi otomatis mengikuti waktu kejadian UTC+7: **04.00–07.59 Shubuh**, **15.00–17.59 Ashar**, **18.00–21.59 Malam**. Di luar rentang tersebut, sesi wajib dipilih manual. Perubahan waktu menghitung ulang sesi; server menerapkan aturan yang sama. Label Malam memakai kode histori `maghrib` existing agar kompatibel tanpa migrasi data.
- Tampilan mengikuti benchmark **Status Pembayaran** dan `docs/UI_UX_GUIDELINES.md`: padding halaman dari shell dashboard, toolbar ringkas, tabel desktop/daftar ponsel, modal dengan header dan footer tetap serta isi bergulir. Riwayat, rekap, pencarian, dan detail menggunakan foto master santri existing dengan fallback inisial.
- **Rekap** selalu menghitung kejadian aktif yang memenuhi filter. Batas jumlah berlaku setelah filter kejadian, bukan berdasarkan jumlah seluruh histori. Pilih santri untuk membuka detail; **Semua riwayat santri** menampilkan seluruh periode termasuk catatan batal.
- **Analitik** default bulan berjalan hingga hari ini. Santri berulang berarti minimal dua kejadian aktif pada periode/filter yang sama. Sebaran jenis/asrama/sesi/kelas dapat diklik untuk membuka riwayat yang sesuai.
- Asrama/kamar/kelas mengikuti penempatan saat ini, bukan penempatan ketika kejadian. Riwayat tetap ada ketika santri diarsipkan. Kelas yang dihitung adalah kelas aktif pada tahun ajaran aktif. Santri dengan beberapa kelas dapat muncul sekali di masing-masing kelompok kelas, sehingga jumlah antarkelas tidak selalu sama dengan total kejadian.
- Sebaran menampilkan hingga 100 kelompok; daftar santri berulang menampilkan 10 teratas. Riwayat dan rekap menggunakan pagination 30 item.

## Akses dan integritas

### Foto kejadian opsional

- Form pencatatan baru menyediakan pemotret langsung di modal melalui `getUserMedia`, tanpa aplikasi kamera bawaan/file picker. Kamera belakang default; tersedia ganti kamera, ulangi, gunakan foto, atau tanpa foto. Kamera berhenti saat capture/close/unmount. Memerlukan HTTPS (atau localhost) dan izin kamera browser.
- Kompresi memakai encoder existing: WebP, sisi terpanjang maksimal 960px, sasaran 80 KB, batas server 120 KB. Penurunan kualitas/resolusi bertahap dengan batas 640px menjaga keterbacaan; hasil aktual bergantung detail/pencahayaan. Server memeriksa MIME, ukuran, header WebP, dimensi, dan menolak animasi.
- Satu foto per kejadian saat input baru; koreksi tidak mengganti foto. Foto kejadian terpisah dari foto profil santri. Riwayat/detail menyediakan **Lihat Foto Kejadian**.
- Bucket existing `eskahade-foto`, prefix `pengajian-evidence/prod/` atau `pengajian-evidence/demo/`, disetujui eksplisit pengguna pada 30 September 2026. Endpoint foto memeriksa izin fitur/cakupan santri dan memakai `private, no-store`; prefix bukti ditolak endpoint file publik existing.
- Retensi **30 × 24 jam sejak foto disimpan**, bukan tanggal kejadian. Foto expired langsung tidak dapat dibaca. Worker setiap 15 menit menghapus file R2 (maksimal 200 file per database/run; backlog dilanjutkan run berikutnya). Metadata expiry tetap ada; catatan/revisi pelanggaran tetap tersimpan. Kegagalan R2 dicoba ulang.
- Metadata dipesan sebelum upload agar file tetap terlacak saat jaringan terputus. Retry memakai identitas/hash sama tanpa memperpanjang retensi. Upload pending dapat dicoba ulang selama satu jam. Jika foto gagal, catatan tetap tersimpan, formulir terkunci, dan tersedia **Coba Simpan Foto** atau **Lanjut Tanpa Foto** tanpa membuat kejadian kedua. Metadata tetap terlacak setelah reset demo.
- Sebelum rilis foto: jalankan migrasi `0175_pengajian_violation_photos.sql` pada DB dan DEMO_DB setelah 0174, lalu deploy aplikasi dan worker menggunakan `wrangler.pengajian-photo-cleanup.jsonc`. Penghapusan fisik otomatis memerlukan worker ini aktif. Belum diterapkan ke produksi/demo. Saat rollback aplikasi, pertahankan tabel metadata dan worker cleanup.
- Verifikasi tambahan: `npm run test:pengajian-photos` dan test Server Actions meliputi unggah, replay, kegagalan R2, izin/namespace, expiry, endpoint, cleanup/retry, dan pelacakan setelah reset demo. Browser memakai kamera simulasi; kamera perangkat sungguhan perlu diperiksa saat rilis.

- Admin/sekpen/keamanan melihat semua santri. Guru/wali kelas terbatas pada santri di kelas tanggung jawabnya pada tahun ajaran aktif, termasuk untuk pencarian, opsi filter, detail, dan analitik. Guru tanpa kelas mendapatkan hasil kosong. Role lain pada akun guru tidak membuka akses semua santri, kecuali admin/sekpen/keamanan.
- Izin baca dan CRUD tetap mengikuti konfigurasi fitur existing. Pengaturan jenis hanya untuk admin/sekpen. Pengguna lain hanya dapat mengoreksi/membatalkan catatan buatannya sendiri dalam cakupan aksesnya.
- Koreksi dan pembatalan wajib beralasan. Tidak tersedia hard delete. Versi catatan mencegah perubahan bersamaan menimpa catatan terbaru. Identitas permintaan disimpan permanen pada revisi untuk mencegah pengiriman ulang mencatat perubahan dua kali.
- Revisi ditulis dengan trigger SQL dalam transaksi yang sama dengan kejadian. Kegagalan penulisan revisi membatalkan perubahan. Log aktivitas aplikasi tetap menerima ringkasan; revisi tidak bergantung pada log aktivitas yang dapat dinonaktifkan/dibersihkan.
- Jenis nonaktif tidak tersedia untuk kejadian baru. Koreksi jenis yang sama tetap diizinkan walaupun jenis sudah nonaktif. Snapshot nama histori tidak berubah saat nama jenis diganti.

## Penerapan

1. Jalankan `migrations/0174_pelanggaran_pengajian.sql` **sekali**, memakai prosedur migrasi project, pada DB produksi dan DEMO_DB sebelum rilis aplikasi. Migrasi menambah tiga tabel, indeks, trigger audit, empat jenis awal, menu, serta izin CRUD; tidak mengubah histori existing.
2. Migrasi wajib dilakukan pada kedua database karena aplikasi mengarahkan sesi demo ke DEMO_DB. Empat jenis awal hanya diisi saat migrasi; pembacaan modul tidak melakukan seed ulang.
3. Rilis aplikasi, lalu uji akses sekpen, keamanan, guru, dan wali kelas. Periksa satu kejadian beserta revisinya, rekap, dan analitik. Pantau error dengan prefix `[pelanggaran-pengajian]`.
4. Jika rilis dibatalkan, nonaktifkan fitur pada Pengaturan Fitur atau jalankan `UPDATE fitur_akses SET is_active=0 WHERE href='/dashboard/akademik/pelanggaran-pengajian';`. Kembalikan versi aplikasi bila diperlukan; pertahankan tabel dan seluruh data, jangan melakukan down migration yang menghapus histori.

Reset sandbox existing turut membersihkan kejadian/revisi pengajian sebelum data santri di-reset; konfigurasi jenis tidak di-seed ulang. Referensi pencatat/revisi ikut diperiksa sebelum pengguna dihapus.

## Verifikasi

- `npm run test:pengajian-violations`: menjalankan Server Actions asli melalui transpiler TypeScript dengan database SQLite terisolasi dan adapter test yang menyerupai API D1. Menguji migrasi, SQL, cakupan role/kelas, kepemilikan, validasi, pengiriman ulang, konflik versi, rollback audit, arsip, filter, rekap, analitik, dan pagination. Tidak mengakses DB produksi/demo.
- `node node_modules/typescript/lib/tsc.js --noEmit --incremental false`
- `node node_modules/eslint/bin/eslint.js app/dashboard/akademik/pelanggaran-pengajian lib/pengajian-violations scripts/test-pengajian-violations.cjs`
- `node node_modules/next/dist/bin/next build --webpack`

Verifikasi UI dapat menggunakan data contoh terisolasi pada 360px, 768px, dan 1280px. Pengujian tersebut memeriksa layout, modal, focus/Escape, pencarian, dan combobox; pengujian integrasi data dilakukan terpisah oleh script SQLite. Smoke test Cloudflare dengan autentikasi asli masih diperlukan setelah migrasi dan rilis.

Verifikasi implementasi pada 30 September 2026: test Server Actions, lint terarah, TypeScript, dan build produksi lulus. Migrasi juga berhasil dijalankan pada database D1 lokal terisolasi melalui Wrangler 4.95.0; smoke test insert/update menghasilkan revisi create/update dengan pelaku dan snapshot sebelum/sesudah yang sesuai. Database produksi dan DEMO_DB belum dimigrasikan.
