# APK Android ESKAHADE & Notifikasi FCM (NOTIF-3)

APK ini adalah WebView Capacitor yang memuat `https://app.sukahideng.id/` (satu APK untuk wali dan
pegawai, dibuka di halaman depan). Notifikasi Android dikirim lewat **Firebase Cloud Messaging
HTTP v1**; browser/iPhone tetap memakai Web Push (VAPID). Keduanya berbagi antrian
`notif_deliveries` yang sama.

| Item | Nilai |
|---|---|
| Application ID | `com.sukahideng.app` (permanen di Play Store) |
| Penanda user agent | `ESKAHADE_APP_NATIVE` |
| Kanal notifikasi Android | `default` ("Notifikasi Utama", prioritas tinggi) |
| Izin notifikasi | **Wajib** di area login — dialog penuh sampai diizinkan |

## 1. Firebase (sekali)

1. Firebase Console → buat project (mis. `eskahade`). Buat project terpisah untuk sandbox bila perlu.
2. Tambahkan aplikasi **Android** dengan package `com.sukahideng.app`.
3. Unduh `google-services.json` → simpan di `android/app/google-services.json`.
   File ini di-gitignore; simpan salinannya di tempat aman (bukan di repo).
4. Project settings → Service accounts → **Generate new private key** (JSON). Ambil tiga nilai:
   `project_id`, `client_email`, `private_key`.

## 2. Secret server (per environment)

Pasang di **app Worker** dan **worker notification-dispatch**. Jangan taruh di Git, `.env`, atau D1.

```powershell
npx wrangler secret put FCM_PROJECT_ID --env sandbox
npx wrangler secret put FCM_CLIENT_EMAIL --env sandbox
npx wrangler secret put FCM_PRIVATE_KEY --env sandbox
npx wrangler secret put FCM_PROJECT_ID --config wrangler.notification-dispatch.jsonc
npx wrangler secret put FCM_CLIENT_EMAIL --config wrangler.notification-dispatch.jsonc
npx wrangler secret put FCM_PRIVATE_KEY --config wrangler.notification-dispatch.jsonc
```

Untuk production hilangkan `--env sandbox` pada app Worker dan tambahkan `--env production`
pada worker dispatch. `FCM_PRIVATE_KEY` boleh ditempel apa adanya dari JSON (dengan `\n` literal).

Lalu buka **Pengaturan → Notifikasi**: panel kanal harus menampilkan project Firebase; tekan
**Aktifkan push**.

## 3. Keystore rilis (sekali, simpan baik-baik)

Kehilangan keystore = aplikasi tidak bisa diperbarui di Play Store.

```powershell
keytool -genkeypair -v -keystore android/eskahade-release.jks -alias eskahade -keyalg RSA -keysize 2048 -validity 10000
```

Buat `android/keystore.properties` (di-gitignore):

```
storeFile=eskahade-release.jks
storePassword=...
keyAlias=eskahade
keyPassword=...
```

## 4. Build

Butuh JDK 21 dan Android SDK: set `JAVA_HOME`/`ANDROID_HOME`, atau `ESKAHADE_ANDROID_TOOLS` ke folder
berisi `jdk*/` dan `android-sdk/` (mis. `C:\DATA\mansatas-app\.tools`).

```powershell
npm run android:build:debug
```

```powershell
npm run android:build:release
```

```powershell
npm run android:build:bundle
```

- `debug` boleh tanpa Firebase (dialog izin tidak muncul, notifikasi tidak aktif).
- `release`/`bundle` menolak jalan tanpa `google-services.json` dan `keystore.properties`.
- APK uji sandbox: set `ESKAHADE_APP_URL=https://<domain-sandbox>` sebelum build.
- Naikkan `versionCode`/`versionName` di `android/app/build.gradle` setiap rilis.
- Ikon & splash dibuat otomatis dari `public/icon-512x512.png` (`scripts/android-apply-branding.cjs`).

## 5. Cara kerja

1. Pengguna login (dashboard atau portal) di APK → runtime `components/native/native-push-runtime.tsx`
   memeriksa server (`/api/notifications/devices`) dan Firebase di APK.
2. Bila izin belum ada → dialog penuh "Notifikasi wajib diaktifkan"; bila diblokir → tombol membuka
   pengaturan Android.
3. Token FCM dikirim ke `POST /api/notifications/devices {channel:'FCM'}` dan di-link ke akun sesi
   (satu HP bisa untuk beberapa santri kakak-adik).
4. Event → outbox → inbox → antrian `notif_deliveries` → `messages:send` FCM v1.
5. Ketuk notifikasi → `data.url` (hanya path internal) dibuka di WebView.
6. Logout → perangkat dilepas dari akun itu (cookie `eskahade_notif_device`).

Penanganan error: `UNREGISTERED`/`SENDER_ID_MISMATCH`/404 → perangkat dinonaktifkan; 429/5xx/jaringan
→ dicoba ulang (maks. 3); 401/403 → kredensial server salah, perangkat **tidak** dinonaktifkan.

## 6. Checklist QA perangkat

- [ ] Dialog izin muncul hanya setelah login, tidak di halaman depan/login.
- [ ] Menolak izin → dialog tetap; "Buka pengaturan notifikasi" membuka pengaturan Android.
- [ ] "Kirim uji ke saya" (Pengaturan Notifikasi) diterima saat aplikasi **terbuka** (toast),
      **di latar belakang**, dan **ditutup** (notifikasi sistem dengan ikon lonceng hijau).
- [ ] Ketuk notifikasi membuka halaman tujuan.
- [ ] Logout lalu kirim uji ke akun lama → HP tidak menerima. Login akun lain → menerima untuk akun baru.
- [ ] Wali kakak-adik: login santri A lalu santri B di HP yang sama → keduanya menerima.
- [ ] Mode pesawat → halaman offline; tombol "Coba lagi" kembali setelah online.
- [ ] Badge "Install ESKAHADE" tidak muncul di dalam APK.
