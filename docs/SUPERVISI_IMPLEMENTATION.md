# Modul Supervisi

Menu: **Sekpen → Supervisi**, `/dashboard/sekpen/supervisi`.

## Aktivasi

1. Terapkan `migrations/0179_supervisi.sql`, lalu `migrations/0180_supervisi_activity_delete.sql` melalui workflow migration D1 existing. Migration menambah tabel, trigger, dan menu tanpa mengubah master atau data keuangan. Tidak ada kegiatan yang dihapus saat migration diterapkan.
2. Admin membuka **Pengaturan → Tim & Kepengurusan → Tim Supervisi**, menambah petugas dan memilih cakupan **Hasil sendiri** atau **Semua hasil dan draft**. Penugasan langsung mengatur grant modul dan izin tambahan secara atomik. Role Sekpen sendiri tidak memberikan akses. Mencabut penugasan tidak menghapus hasil wawancara; grant dan izin yang sudah ada tetap terbaca tanpa migrasi data baru.
3. Admin membuat kegiatan, memilih tahun ajaran dan target guru, lalu membuka kegiatan. Target dibekukan setelah kegiatan dibuka. Kegiatan ditutup membekukan seluruh hasil dan draft; membuka kembali membutuhkan alasan.
4. Sidebar desktop, drawer samping mobile, dan drawer Semua Menu memakai daftar fitur hasil grant petugas yang sama. Jika petugas sudah membuka aplikasi saat ditugaskan, refresh halaman untuk memuat menu terbaru. Pencabutan penugasan langsung memblokir request hasil Supervisi berikutnya.
5. Jalur unduh PDF mobile memakai layanan PDF existing (`/api/pdf/from-html`). Desktop memakai dialog cetak/Simpan PDF.

Implementasi ini tidak menjalankan migration atau deployment produksi. Periksa master guru, kelas, jadwal mingguan dan pembagian kitab/mapel sebelum aktivasi. Penugasan yang tidak lengkap harus diperbaiki di master; sistem tidak menyediakan identitas bebas sebagai pengganti.

## Form, identitas, dan penghapusan kegiatan

Form memakai 12 halaman bagian: identitas/pembukaan, delapan aspek, refleksi, catatan, dan review. Seluruh pertanyaan satu bagian tampil bersama; autosave tetap per jawaban.

Pilih guru dan satu kelas. Semua kitab/mapel kelas itu otomatis dirangkum tanpa duplikasi hari. Waktu mengikuti jadwal dasar, mingguan, dan pembagian kitab. Tiga sesi ditampilkan sebagai **Semua waktu**, dua sesi digabung dengan **dan**. Snapshot lama tidak diubah otomatis.

Admin dapat menghapus kegiatan dari tab Kegiatan. Dialog pertama menjelaskan dampak; dialog kedua menampilkan jumlah wawancara dan mewajibkan nama kegiatan persis. Token konfirmasi terikat admin/kegiatan/revisi dan berlaku 10 menit. Server memeriksa ulang akses dan menghapus wawancara beserta jawaban, riwayat, target, dan kegiatan dalam satu batch atomik. Penghapusan wawancara/riwayat secara terpisah tetap diblokir. Log aktivitas umum mencatat tindakan sesuai pengaturan logging existing. Penghapusan tidak dapat dipulihkan melalui aplikasi.

## Data dan keamanan

- Target mengacu pada master guru. Identitas wawancara disnapshot dari penugasan database saat draft dibuat. Identitas santri tidak disimpan.
- Pilihan guru/kelas dapat dikoreksi pada draft yang belum memiliki jawaban. Koreksi memakai revisi dan riwayat before/after, serta tetap tunduk pada constraint satu wawancara per guru. Identitas terkunci begitu pengisian dimulai.
- Aggregate wawancara menyimpan 53 jawaban dalam `answers_json`, versi instrumen, tanggal, status, dan revisi. Satu update atomik mencatat jawaban, progress dan status sekaligus riwayat sebelum/sesudah melalui trigger SQLite.
- Constraint unik kegiatan/guru mencegah draft ganda. Compare-and-swap revisi mencegah penimpaan edit bersamaan. ID operasi unik per wawancara membuat retry idempotent.
- Petugas biasa melihat status semua target tetapi hanya dapat membaca, mengedit draft, menganalisis dan mencetak hasil miliknya. Petugas berizin tambahan dapat mengelola semua draft; membuka kembali hasil selesai tetap admin.
- Grant database diperiksa pada setiap request. Tester dan demo produksi tidak memperoleh bypass hasil Supervisi.
- Antrean autosave serial mempertahankan payload/ID setelah kegagalan jaringan dan berhenti pada konflik revisi. Perbandingan versi terbaru ditampilkan sebelum pengguna menyimpan ulang perubahan lokal.
- Antrean berada dalam memori. Penutupan browser/perangkat secara paksa dapat menghilangkan perubahan belum tersimpan. `beforeunload` memperingatkan saat antrean belum kosong; tidak ada penyimpanan jawaban sensitif ke localStorage.
- Semua 53 item wajib sebelum submit. Tidak diketahui membutuhkan catatan, tidak diberi skor nol, dan tidak masuk denominator rata-rata. Analitik hanya memakai hasil selesai.

## Verifikasi dan rollback

Jalankan `npm run test:supervisi`, TypeScript, lint area terkait dan build. Test menggunakan server actions asli dengan SQLite terisolasi tanpa akses database produksi.

Untuk menonaktifkan modul, nonaktifkan entri fitur dan cabut grant petugas. Pertahankan tabel/trigger/history. Jangan drop tabel yang sudah berisi hasil. Versi aplikasi sebelumnya tetap kompatibel dengan schema additive ini.

Sumber instrumen: `Daftar_Pertanyaan_Wawancara_Santri_Supervisi_Pengajar.docx`, versi 1: 28 skor, 16 pendalaman, 5 reflektif dan 4 catatan. Perubahan instrumen berikutnya harus mempertahankan versi dan identitas item laporan lama.
