# POSKESTREN: pemeriksaan, visit, dan observasi

## Penerapan

Terapkan `migrations/0147_poskestren_clinical_workflow.sql` pada database utama setelah migrasi POSKESTREN sebelumnya, **sebelum** menjalankan versi aplikasi ini. Gunakan proses migrasi D1 proyek yang biasa. Migrasi ini belum dijalankan pada database produksi oleh implementasi ini.

Migrasi menambahkan tabel/kolom tanpa membangun ulang tabel resep lama. Profil santri yang sudah ada dipertahankan; profil yang belum ada dilengkapi. Trigger membuat profil untuk santri yang kemudian ditambahkan, termasuk melalui impor. Identitas santri dan pasien tetap memakai relasi unik yang sudah ada.

Visit lama berstatus internal `LEGACY`, tidak menghasilkan honor baru, dan obat lamanya tetap merupakan pemberian yang telah terjadi. Resep baru Visit/Observasi disimpan bersama pemeriksaan klinis pada tabel tambahan; riwayat pemberian obat lama tidak dikonversi menjadi antrean penyerahan. Kategori honor pemeriksaan lama diisi berdasarkan aturan tarif lama.

Rollback aplikasi tidak memerlukan penghapusan tabel baru. Jangan menghapus data klinis/resep/penyerahan yang sudah dibuat oleh versi ini. Versi lama tidak dapat menangani resep dan visit baru secara lengkap, sehingga pemulihan aplikasi harus mempertimbangkan antrean yang masih aktif.

## Perilaku

- **Rekam Medis** terpisah dari **Data Pemeriksaan**. Rekam medis menggabungkan sumber pelayanan; Data Pemeriksaan hanya mengambil pemeriksaan klinik.
- Admin dan petugas POSKESTREN mendapat detail klinis. Akses ringkas hanya mengirim nama, tanggal berobat WIB, dan identitas teknis; filter diagnosis/dokter/obat/status ditolak. Batas asrama binaan tetap berlaku.
- Dokter Visit/Observasi harus memakai akun yang terhubung ke personel `MEDICAL` aktif. Petugas dapat melakukan pendaftaran; dokter juga dapat mendaftar dan langsung memeriksa.
- Pemeriksaan selesai menyimpan resep tanpa mengurangi stok. Petugas menyerahkan obat melalui **Penyerahan Obat**. Resep Visit/Observasi tanpa obat stok tidak memerlukan penyerahan. Obat eksternal memiliki nama, jumlah, satuan, aturan pakai, dan catatan tersendiri serta tidak menambah katalog.
- Honor Visit dihitung sekali setelah dokter selesai: tarif pasien non tindakan pada tanggal visit WIB, tanpa sesi tambahan. Penyerahan dan revisi tidak menambah honor. Observasi tidak masuk perhitungan honor.
- Pemeriksaan klinik baru menggunakan isi kolom **Tindakan** (`follow_up`) untuk kategori honor tindakan; kolom **Pemeriksaan** (`treatment`) tidak menaikkan tarif. Revisi mengubah kategori apabila kolom Tindakan berubah.
- Penyimpanan pelayanan hanya menulis snapshot klinis. Perubahan profil master memerlukan aksi edit profil dengan `profile_version`; penyimpanan berbasis versi lama ditolak.
- Penyerahan menggunakan klaim transaksi unik. Guard stok memeriksa snapshot total dan lokasi sebelum menulis mutasi, sehingga data yang sudah berubah mengharuskan petugas memuat ulang. Constraint gagal membatalkan seluruh batch; perilaku transaksi mengikuti [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

## Validasi lokal

```text
python -B scripts/test-poskestren-invariants.py
python -B scripts/test-poskestren-hardening.py
npm run test:poskestren
npx tsc --noEmit --incremental false
npm run build
```

`test:poskestren` menjalankan server actions asli dengan adapter D1 berbasis SQLite dalam memori. Sesi, izin fitur, audit, dan cache framework diganti fixture lokal; aturan akses klinis asli tetap dieksekusi. Tes mencakup database kosong dan berisi data lama, profil permanen, pendaftaran, Visit, Observasi, resep eksternal, revisi, transaksi stok, redaksi data, dan tarif lintas bulan WIB.

`npm run test:poskestren:ui` menguji komponen formulir asli di browser headless pada lebar 1280 dan 390 piksel, termasuk pencarian, keyboard, obat eksternal, nilai formulir, dan reset pasien. Tes ini menggunakan server sementara dan data buatan, bukan sesi aplikasi produksi. Jika Playwright tersedia di runtime terpisah, arahkan `PLAYWRIGHT_MODULE_DIR` ke direktori paketnya; `CHROMIUM_EXECUTABLE` dapat menunjuk executable browser. Screenshot tersimpan di `tmp/poskestren-ui`.

Setelah migrasi pada lingkungan tujuan, lakukan smoke test dengan akun admin, petugas, dokter, dan pengurus asrama untuk memastikan konfigurasi fitur dan tautan akun dokter sesuai data lingkungan tersebut.
