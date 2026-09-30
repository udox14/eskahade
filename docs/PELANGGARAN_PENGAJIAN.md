# Pelanggaran Pengajian

Modul manual berada di `/dashboard/akademik/pelanggaran-pengajian`, dalam kelompok Akademik. Tidak mengubah tabel `pelanggaran` atau alur otomatis `ALFA_PENGAJIAN` dari verifikasi absensi.

## Operasional

- Input dilakukan melalui **Riwayat → Catat Pelanggaran**. Satu kejadian berisi satu santri, satu jenis, tanggal/jam UTC+7, sesi wajib, dan catatan opsional.
- **Rekap** selalu menghitung kejadian aktif yang memenuhi filter. Batas jumlah berlaku setelah filter kejadian, bukan berdasarkan jumlah seluruh histori. Pilih santri untuk membuka detail; **Semua riwayat santri** menampilkan seluruh periode termasuk catatan batal.
- **Analitik** default bulan berjalan hingga hari ini. Santri berulang berarti minimal dua kejadian aktif pada periode/filter yang sama. Sebaran jenis/asrama/sesi/kelas dapat diklik untuk membuka riwayat yang sesuai.
- Asrama/kamar/kelas mengikuti penempatan saat ini, bukan penempatan ketika kejadian. Riwayat tetap ada ketika santri diarsipkan. Kelas yang dihitung adalah kelas aktif pada tahun ajaran aktif. Santri dengan beberapa kelas dapat muncul sekali di masing-masing kelompok kelas, sehingga jumlah antarkelas tidak selalu sama dengan total kejadian.
- Sebaran menampilkan hingga 100 kelompok; daftar santri berulang menampilkan 10 teratas. Riwayat dan rekap menggunakan pagination 30 item.

## Akses dan integritas

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
