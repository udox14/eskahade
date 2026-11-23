import type { CapacitorConfig } from '@capacitor/cli'

// APK Android ESKAHADE: WebView yang memuat aplikasi produksi (satu APK untuk wali & pegawai,
// halaman depan "/"). Push native lewat FCM; Web Push tidak tersedia di WebView.
//
// ESKAHADE_APP_URL boleh diisi saat build untuk APK uji sandbox. Hanya https yang diterima.
const DEFAULT_APP_URL = 'https://app.sukahideng.id/'

function appUrl(): string {
  const raw = (process.env.ESKAHADE_APP_URL || DEFAULT_APP_URL).trim()
  const url = new URL(raw)
  if (url.protocol !== 'https:') throw new Error('ESKAHADE_APP_URL harus https.')
  return `${url.origin}/`
}

const config: CapacitorConfig = {
  appId: 'com.sukahideng.app',
  appName: 'ESKAHADE',
  webDir: 'native/www',
  appendUserAgent: 'ESKAHADE_APP_NATIVE',
  server: {
    url: appUrl(),
    cleartext: false,
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
