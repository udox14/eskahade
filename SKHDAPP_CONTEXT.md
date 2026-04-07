# SKHDAPP — Pesantren Management System (~2500 santri)

## Stack
Next.js (App Router) · TypeScript · Cloudflare Workers + D1 (SQLite) · Drizzle ORM · R2 · Tailwind + shadcn/ui

## Structure
```
app/
  login/
  api/auth/login/
  dashboard/
    santri/[id]/edit, arsip, atur-kelas, export, foto, input, keluar, tes-klasifikasi
    akademik/absensi(cetak,rekap,verifikasi), absensi-guru/rekap, grading, kenaikan, leger, nilai/input, ranking, upk/(kasir,manajemen)
    asrama/absen-berjamaah, absen-malam, absen-sakit, layanan, perpindahan-kamar, perpulangan/monitoring, spp, status-setoran, uang-jajan
    keamanan/input, perizinan/(cetak-telat,verifikasi-telat), rekap-asrama
    keuangan/laporan, pembayaran, tarif
    dewan-santri/sensus/laporan, setoran, surat, uang-jajan
    master/kelas, kitab, pelanggaran, santri-tools, wali-kelas
    pengaturan/fitur-akses, perpulangan-periode, tahun-ajaran, users
    laporan/rapor · surat-santri · profil
lib/auth/ · lib/cache/ · lib/db/ · lib/r2/
migrations/ · scripts/
```

## Key DB Tables
- `santri` — id(TEXT), nis, nama_lengkap, jenis_kelamin(L/P), asrama, kamar, status_global(aktif/arsip/keluar), bebas_spp(0/1), foto_url
- `riwayat_pendidikan` — id, santri_id, kelas_id, status_riwayat(aktif/selesai/pindah)
- `kelas` — id, tahun_ajaran_id, marhalah_id, nama_kelas, wali_kelas_id, jenis_kelamin(L/P/C)
- `absensi_harian` — riwayat_pendidikan_id, tanggal, shubuh/ashar/maghrib(H/A/I/S) · UNIQUE(riwayat_pendidikan_id, tanggal)
- `absen_malam_v2` — santri_id, tanggal, status(HADIR/ALFA/IZIN) · UNIQUE(santri_id, tanggal)
- `absen_berjamaah` — santri_id, tanggal, shubuh/ashar/maghrib/isya(NULL=Hadir/A/S/H/P) · UNIQUE(santri_id, tanggal)
- `spp_log` — santri_id, bulan, tahun, nominal_bayar
- `perizinan` — santri_id, jenis(PULANG/KELUAR/LAINNYA), status(AKTIF/KEMBALI/TELAT)
- `pelanggaran` — santri_id, jenis(RINGAN/SEDANG/BERAT), poin, master_id
- `perpulangan_log` — santri_id, periode_id, status_pulang(BELUM/PULANG), status_datang(BELUM/SUDAH/TELAT/VONIS) · UNIQUE(santri_id, periode_id)
- `users` — id, email, role(admin/wali_kelas/pengurus_asrama/akademik/keamanan/dewan_santri/sekpen/bendahara)
- `fitur_akses` — href UNIQUE, roles(JSON), is_active, is_bottomnav

## Rules (WAJIB diikuti)
1. **Lazy load per-kamar** — jangan fetch semua kamar sekaligus, tunggu user pilih kamar
2. **Manual trigger** — halaman rekap/laporan berat JANGAN auto-fetch, pakai tombol "Tampilkan"
3. **No select(*)** — selalu pilih kolom yang dibutuhkan saja
4. **CTE** untuk query agregasi kompleks, bukan correlated subquery
5. **revalidateTag(tag)** — hanya 1 argumen, tidak ada options param (Next.js 15+)
6. **Complete file rewrite** — selalu tulis ulang file lengkap, bukan patch
7. **No Node.js built-ins** — Cloudflare Workers runtime only
8. **R2 URL** — simpan plain URL, jangan double-encode

## Respond
Komunikasi: **Bahasa Indonesia**. Code & comments: English.
