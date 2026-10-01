# Pelanggaran berbasis jumlah kejadian

## Model dan aturan

Catatan manual umum dan pengajian aktif bernilai satu kejadian. Alfa dihitung per sesi dengan tanggal sesi sebenarnya; tanggal pencatatan/vonis tetap tersedia. Pengajian batal tidak dihitung. Kategori dan pilihan SP petugas tetap berlaku. Poin historis dipertahankan sebagai arsip teknis. Template impor lama diterima, kolom poin diabaikan dengan pemberitahuan.

View `discipline_incidents` menggabungkan sumber umum, sesi alfa dan pengajian tanpa menyalin tabel pengajian. Identitas `umum:`, `sesi:` dan `pengajian:` mencegah benturan ID. Keamanan, profil, pimpinan, portal, surat dan ekspor memakai model ini. Total portal dihitung penuh di server, terpisah dari pagination riwayat 200 item. Filter periode memakai tanggal kejadian dan pengajian memakai UTC+7.

`pelanggaran_sessions` unik berdasarkan santri/sumber/tanggal/sesi. `pelanggaran_session_links` menjaga alias histori dan surat tanpa menghitung sesi dua kali. Pencatatan otomatis menggunakan batch atomik dan validasi status/kepemilikan ulang; replay tidak membuat kejadian tambahan. Koreksi alfa ke bukan alfa membatalkan sesi. Trigger menyimpan audit sebelum/sesudah. Mutasi menginvalidasi halaman terkait dan cache pimpinan.

Backfill hanya menerima seluruh referensi absensi yang bisa dihubungkan, seluruh relasi vonis yang valid, atau detail tanggal ISO lengkap dengan jumlah sesi sesuai. Bukti tidak lengkap/bertentangan masuk daftar **Verifikasi Histori**; poin tidak dipakai menebak. Total tampil sebagai jumlah terkonfirmasi dan catatan perlu verifikasi. Tanggal belum pasti tidak dimasukkan ke suatu bulan. Verifikasi membutuhkan tanggal/sesi, alasan dan versi terbaru, mengikuti izin fitur serta role admin/keamanan/sekpen/demo. Vonis bertentangan harus dikoreksi di modul asal. Pemulihan arsip lama tanpa bukti sesi juga masuk verifikasi. Santri dengan histori pelanggaran diarahkan ke arsip.

Surat baru memvalidasi sumber, kepemilikan dan status, lalu menyimpan snapshot pilihan dalam transaksi yang sama. Isi surat tidak berubah setelah koreksi/pembatalan kejadian. Array ID surat lama dan alias sesi tetap dibaca. Pengajian dari tampilan gabungan mengarah ke modul asal untuk perubahan. Cakupan guru/kelas tidak diperluas; orang tua menerima field publik tanpa foto bukti.

## Rilis dan rollback

1. Pastikan migrasi sebelumnya termasuk 0174 dan 0175 telah diterapkan. Cadangkan database dan audit histori produksi sebelum rilis.
2. Terapkan `migrations/0176_discipline_occurrences.sql` sekali pada DB (`eskahade-db`) dan DEMO_DB (`eskahade-demo-db`) melalui prosedur migrasi existing. Rilis aplikasi hanya setelah keduanya berhasil. Migrasi menambah schema tanpa drop atau mengubah ID, deskripsi, poin dan surat historis.
3. Periksa `PRAGMA foreign_key_check`, jumlah sesi/pending dan sampel bukti. Bandingkan kejadian yang diketahui, bukan jumlah poin lama. Uji akun guru/wali kelas dan orang tua nyata sesuai cakupan.
4. Setelah deploy, periksa alfa lintas bulan, surat lama/baru, pembatalan, pagination portal, Excel/cetak dan antrean histori.
5. Rollback mengembalikan aplikasi sambil mempertahankan schema tambahan, sesi, revisi, snapshot dan sumber. Jangan menghapus data. Aplikasi lama menampilkan poin kembali dan belum memahami sesi baru: hentikan pencatatan disiplin selama rollback sampai alur baru dipulihkan dan bukti diaudit ulang.

**Status lingkungan:** SQLite harness dan D1 lokal telah diuji. Produksi/demo belum dimigrasi atau dideploy karena `CLOUDFLARE_API_TOKEN` tidak tersedia untuk CLI remote. Jumlah histori ambigu produksi belum dapat dipastikan.

## Verifikasi

- `npm run test:discipline`: contoh 7 kejadian, tanggal lintas bulan, poin historis, deduplikasi/alias, bukti ambigu/konflik, total portal 225+, field orang tua, snapshot/kepemilikan surat, batas binding D1, role/versi/alasan, koreksi/replay, rollback dan template impor lama.
- Test absensi/pemanggilan, pengajian dan foto existing dijalankan ulang untuk regresi cakupan kelas, role, histori dan foto.
- TypeScript dan production build webpack lulus; lint berkas baru lulus. Berkas legacy masih memiliki temuan lint existing.
- `node scripts/test-discipline-ui.cjs` menyediakan fixture komponen keamanan/portal asli dengan data sintetis pada 360/768/1280px. Ini tidak menggantikan pemeriksaan autentikasi, hasil Excel/cetak dan deployment pada lingkungan rilis.
