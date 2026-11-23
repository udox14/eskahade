'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BellRinging, CircleNotch } from '@phosphor-icons/react'
import { announceNotificationsChanged } from '@/components/notifications/shared'

// Runtime notifikasi APK Android (Capacitor). Tidak melakukan apa pun di browser biasa.
// Izin notifikasi WAJIB (keputusan pesantren): area yang sudah login ditutup dialog penuh
// sampai notifikasi diizinkan — hanya bila server sudah mengaktifkan FCM dan APK punya Firebase.

type Audience = 'staff' | 'portal'
type PermissionState = 'checking' | 'granted' | 'prompt' | 'denied' | 'blocked-system' | 'inactive'

interface SettingsPlugin {
  check(): Promise<{ enabled: boolean; firebase: boolean }>
  open(): Promise<{ opened: boolean }>
}

function isNativeApp() {
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return /ESKAHADE_APP_NATIVE/i.test(navigator.userAgent) && cap?.isNativePlatform?.() === true
}

function audienceFor(pathname: string | null): Audience | null {
  if (!pathname) return null
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'staff'
  if (pathname.startsWith('/portal-ortu') && !pathname.startsWith('/portal-ortu/login')) return 'portal'
  return null
}

/** Hanya tautan internal origin yang sama; selain itu buka kotak masuk. */
function internalPath(url: unknown, audience: Audience): string {
  const fallback = audience === 'portal' ? '/portal-ortu/notifikasi' : '/dashboard/notifikasi'
  if (typeof url !== 'string' || !url) return fallback
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.origin === window.location.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback
  } catch {
    return fallback
  }
}

async function postToken(audience: Audience, token: string) {
  const res = await fetch('/api/notifications/devices', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'FCM', audience, token, platform: 'android' }),
  })
  if (!res.ok && res.status !== 401) throw new Error(`Registrasi perangkat gagal (${res.status}).`)
}

export function NativePushRuntime() {
  const pathname = usePathname()
  const router = useRouter()
  const audience = audienceFor(pathname)
  const [state, setState] = useState<PermissionState>('inactive')
  const [busy, setBusy] = useState(false)
  const audienceRef = useRef<Audience | null>(audience)
  const routerRef = useRef(router)
  const apiRef = useRef<{
    push: typeof import('@capacitor/push-notifications').PushNotifications
    settings: SettingsPlugin
  } | null>(null)

  useEffect(() => { audienceRef.current = audience; routerRef.current = router })

  // Pasang plugin & listener sekali per sesi aplikasi.
  useEffect(() => {
    if (!isNativeApp()) return
    let cancelled = false
    const handles: Array<{ remove: () => Promise<void> }> = []
    ;(async () => {
      const [{ registerPlugin }, { PushNotifications }] = await Promise.all([
        import('@capacitor/core'),
        import('@capacitor/push-notifications'),
      ])
      if (cancelled) return
      const settings = registerPlugin<SettingsPlugin>('NotificationSettings')
      apiRef.current = { push: PushNotifications, settings }
      await PushNotifications.createChannel({
        id: 'default', name: 'Notifikasi Utama', description: 'Pembayaran, tagihan, dan persetujuan',
        importance: 5, visibility: 1, sound: 'default', vibration: true, lights: true,
      }).catch(() => undefined)
      handles.push(await PushNotifications.addListener('registration', ({ value }) => {
        const current = audienceRef.current
        if (current) postToken(current, value).catch(error => console.warn('[push] registrasi token', error))
      }))
      handles.push(await PushNotifications.addListener('registrationError', error => console.warn('[push] FCM', error?.error)))
      handles.push(await PushNotifications.addListener('pushNotificationReceived', notification => {
        // Aplikasi sedang terbuka: Android tidak menampilkan notifikasi sistem, tampilkan toast.
        announceNotificationsChanged()
        const current = audienceRef.current ?? 'portal'
        toast(notification.title || 'ESKAHADE', {
          description: notification.body,
          action: { label: 'Buka', onClick: () => routerRef.current.push(internalPath(notification.data?.url, current)) },
        })
      }))
      handles.push(await PushNotifications.addListener('pushNotificationActionPerformed', action => {
        const current = audienceRef.current ?? 'portal'
        routerRef.current.push(internalPath(action.notification?.data?.url, current))
      }))
    })().catch(error => console.warn('[push] inisialisasi', error))
    return () => {
      cancelled = true
      for (const h of handles) h.remove().catch(() => undefined)
    }
  }, [])

  // Periksa izin & daftarkan token tiap masuk area login / ganti audiens / aplikasi kembali aktif.
  useEffect(() => {
    if (!isNativeApp() || !audience) { setState('inactive'); return }
    let cancelled = false

    async function evaluate() {
      for (let i = 0; i < 20 && !apiRef.current; i++) await new Promise(r => setTimeout(r, 100))
      const api = apiRef.current
      if (!api || cancelled) return
      const res = await fetch(`/api/notifications/devices?audience=${audience}`, { cache: 'no-store', credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : null).catch(() => null) as { fcm?: { enabled?: boolean } } | null
      const system = await api.settings.check().catch(() => ({ enabled: true, firebase: false }))
      // Server belum mengaktifkan FCM, atau APK dibuat tanpa google-services.json → jangan memblokir.
      if (!res?.fcm?.enabled || !system.firebase) { if (!cancelled) setState('inactive'); return }
      const permission = await api.push.checkPermissions()
      if (cancelled) return
      if (permission.receive === 'granted' && system.enabled) {
        setState('granted')
        await api.push.register()
      } else if (permission.receive === 'granted') setState('blocked-system')
      else setState(permission.receive === 'denied' ? 'denied' : 'prompt')
    }

    setState('checking')
    evaluate().catch(() => { if (!cancelled) setState('inactive') })
    const onVisible = () => { if (document.visibilityState === 'visible') evaluate().catch(() => undefined) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [audience])

  async function allow() {
    const api = apiRef.current
    if (!api) return
    setBusy(true)
    try {
      if (state === 'denied' || state === 'blocked-system') {
        await api.settings.open() // dievaluasi ulang saat aplikasi kembali aktif
        return
      }
      const result = await api.push.requestPermissions()
      if (result.receive === 'granted') {
        setState('granted')
        await api.push.register()
      } else {
        setState('denied')
      }
    } finally {
      setBusy(false)
    }
  }

  if (state !== 'prompt' && state !== 'denied' && state !== 'blocked-system') return null
  const needsSettings = state !== 'prompt'

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="native-push-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-slate-900">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
          <BellRinging className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 id="native-push-title" className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">Notifikasi wajib diaktifkan</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {audience === 'portal'
            ? 'Kabar pembayaran, tagihan, dan uang jajan santri dikirim lewat notifikasi. Izinkan notifikasi untuk melanjutkan.'
            : 'Tugas verifikasi dan persetujuan dikirim lewat notifikasi. Izinkan notifikasi untuk melanjutkan.'}
        </p>
        {needsSettings && (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Notifikasi sedang diblokir. Buka pengaturan, aktifkan <b>Notifikasi</b> untuk ESKAHADE, lalu kembali ke aplikasi.
          </p>
        )}
        <button type="button" onClick={allow} disabled={busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {busy && <CircleNotch className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {needsSettings ? 'Buka pengaturan notifikasi' : 'Izinkan notifikasi'}
        </button>
      </div>
    </div>
  )
}
