# Sistem Notifikasi ESKAHADE (NOTIF-1 … NOTIF-6)

Notifikasi untuk **wali santri** (Portal Ortu) dan **pegawai**: kotak masuk di aplikasi, Web Push
(browser/iPhone, VAPID) dan FCM (APK Android). Detail APK & Firebase: `docs/ANDROID_APK_FCM.md`.

## Aktivasi (urut)

1. **Migration** `migrations/0202_notifications.sql` — sandbox dulu, lalu production.
   Sebelum diterapkan, semua kode notifikasi tidak aktif dan transaksi keuangan berjalan seperti biasa.
2. **Worker cron** `wrangler.notification-dispatch.jsonc` (tiap 2 menit): deploy sandbox; production
   aktif setelah `NOTIFICATIONS_DISPATCH_ENABLED` diubah ke `"true"` di env production.
3. **Secret push** (app Worker **dan** worker dispatch, per environment):
   - Web Push: `node scripts/generate-vapid.cjs mailto:alamat@domain` → `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
   - FCM: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`.
4. **Pengaturan → Notifikasi** → panel kanal menampilkan kunci terpasang → **Aktifkan push** → "Kirim uji ke saya".

## Modul Pengaturan Notifikasi (`/dashboard/pengaturan/notifikasi`, admin)

| Tab | Isi |
|---|---|
| Jenis Notifikasi | 25 jenis: aktif/wajib, kanal, privasi layar kunci, redaksi + placeholder + pratinjau, penerima (role, cakupan asrama/verifier, pengguna tambahan/dikecualikan), kirim uji, kembalikan bawaan |
| Pengumuman | Broadcast ke semua wali / wali per asrama / pegawai per role / pegawai tertentu; kirim sekarang atau terjadwal (≤ 60 hari); batal selama belum dikirim; statistik dibaca & push |
| Log Pengiriman | 150 catatan terbaru, filter status & penerima, alasan dilewati/gagal, kirim ulang (idempoten) |

Panel atas: jeda/lanjut pengiriman, status kunci VAPID/FCM, jumlah perangkat, statistik push 7 hari.

## Event yang terhubung

- **Wali**: tagihan terbit (ringkasan harian), pembayaran diterima (BRIVA/tunai), uang jajan masuk,
  transfer diterima / belum teralokasi / ditolak / perlu perbaikan / kedaluwarsa / akan kedaluwarsa,
  pencairan kolektif dibawa / diterima / dibatalkan, pengingat tunggakan bulanan (default nonaktif).
- **Pegawai**: bukti transfer menunggu verifikasi (sesuai cakupan asrama), rekonsiliasi baru, anomali BRIVA,
  penerbitan tagihan bermasalah, selisih kas, izin diajukan/diputuskan, setoran SPP menunggu/dikonfirmasi
  (Bendahara Pesantren & Dewan Santri), santri keluar diajukan/diputuskan.

## Jaminan

- Notifikasi keuangan ditulis **di batch yang sama** dengan transaksi uang dan dijaga `WHERE EXISTS` pada baris
  audit/pembayaran → tidak ada notifikasi untuk transaksi yang batal, tidak ada notifikasi ganda saat replay.
- Gagal membangun notifikasi / tabel belum ada → transaksi tetap jalan tanpa notifikasi (`safeNotices`).
- Kanal push fail-closed bila secret tidak lengkap; 401/403 dari layanan push tidak menonaktifkan perangkat.
- Retry hanya untuk kegagalan sementara (429/5xx/jaringan), maks. 5× outbox / 3× push.

## Setting (`app_settings`)

| Key | Default | Arti |
|---|---|---|
| `notifications_enabled` | `1` | Jeda/lanjut seluruh pengiriman (baris tetap antre) |
| `notifications_push_enabled` | `0` | Push ke HP (in-app tetap jalan) |
| `notifications_arrears_day` | `10` | Tanggal mulai pengingat tunggakan bulanan (08.00 WIB) |
| `notifications_retention_days` | `180` | Umur inbox & outbox sebelum dihapus (30–730) |

Retensi harian (WIB): inbox/outbox > 180 hari, log push > 60 hari, perangkat mati > 90 hari. Data notifikasi
bukan riwayat finansial; tabel keuangan & audit tidak pernah disentuh.

## Test

```powershell
npm run test:notifications
```

74 test: inti, Web Push (vektor RFC 8291), FCM, hook keuangan, BRIVA, approval & pengingat, broadcast & retensi.
