'use client'

import { useCallback, useEffect, useState } from 'react'

export type WebPushStatus =
  | 'loading'
  | 'unsupported'      // browser/WebView tanpa Push API (APK Android memakai FCM, NOTIF-3)
  | 'needs-install'    // iPhone/iPad: Web Push hanya untuk aplikasi di Layar Utama
  | 'not-configured'   // server belum mengaktifkan push
  | 'denied'           // izin diblokir di pengaturan browser
  | 'available'        // bisa diaktifkan
  | 'enabled'          // aktif untuk akun ini di perangkat ini
  | 'error'

const SW_URL = '/notif-sw.js'
const SYNC_MS = 12 * 3600_000
const optInKey = (audience: string, ownerKey: string) => `eskahade_push_optin:${audience}:${ownerKey}`

function isNativeApp() {
  return /ESKAHADE_APP_NATIVE/i.test(navigator.userAgent)
}

function isIos() {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function sameKey(subscription: PushSubscription, publicKey: string) {
  const current = subscription.options?.applicationServerKey
  if (!current) return true
  const a = new Uint8Array(current)
  const b = keyToBytes(publicKey)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

async function api(method: 'POST' | 'DELETE', body: Record<string, unknown>) {
  const res = await fetch('/api/notifications/devices', {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({})) as { error?: string; remaining?: number }
  if (!res.ok) throw new Error(data.error || 'Gagal menghubungi server notifikasi.')
  return data
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing?.active?.scriptURL.endsWith(SW_URL)) return existing
  return navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' })
}

/**
 * Langganan Web Push per akun (audience + ownerKey). Akun lain di browser yang sama tidak
 * otomatis ikut menerima: setiap akun harus menekan "Aktifkan" sekali (opt-in tersimpan lokal).
 */
export function useWebPush(audience: 'staff' | 'portal', ownerKey: string) {
  const [status, setStatus] = useState<WebPushStatus>('loading')
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const register = useCallback(async (subscription: PushSubscription) => {
    await api('POST', { audience, subscription: subscription.toJSON(), platform: isIos() ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'web' })
    localStorage.setItem(optInKey(audience, ownerKey), String(Date.now()))
  }, [audience, ownerKey])

  useEffect(() => {
    let cancelled = false
    const set = (s: WebPushStatus) => { if (!cancelled) setStatus(s) }
    ;(async () => {
      if (isNativeApp() || !('serviceWorker' in navigator)) { set('unsupported'); return }
      try {
        const res = await fetch(`/api/notifications/devices?audience=${audience}`, { cache: 'no-store', credentials: 'same-origin' })
        const config = await res.json().catch(() => ({})) as { webpush?: { enabled?: boolean; publicKey?: string | null } }
        const key = config.webpush?.enabled ? config.webpush.publicKey ?? null : null
        if (!key) { set('not-configured'); return }
        if (isIos() && !isStandalone()) { set('needs-install'); return }
        if (!('PushManager' in window) || !('Notification' in window)) { set('unsupported'); return }
        if (!cancelled) setPublicKey(key)
        if (Notification.permission === 'denied') { set('denied'); return }
        const reg = await navigator.serviceWorker.getRegistration('/')
        const subscription = await reg?.pushManager.getSubscription()
        const optIn = Number(localStorage.getItem(optInKey(audience, ownerKey)) || 0)
        if (!subscription || Notification.permission !== 'granted' || !optIn) { set('available'); return }
        if (!sameKey(subscription, key)) {
          // Kunci VAPID server berganti: langganan lama tidak bisa dipakai lagi.
          await subscription.unsubscribe()
          const fresh = await (await registration()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) })
          await register(fresh)
        } else if (Date.now() - optIn > SYNC_MS) {
          await register(subscription)
        }
        set('enabled')
      } catch {
        set('error')
      }
    })()
    return () => { cancelled = true }
  }, [audience, ownerKey, register])

  const enable = useCallback(async () => {
    if (!publicKey) return
    setBusy(true); setError(null)
    try {
      // Harus dipanggil langsung dari klik pengguna (syarat iOS/Safari).
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setStatus(permission === 'denied' ? 'denied' : 'available'); return }
      const reg = await registration()
      await navigator.serviceWorker.ready
      let subscription = await reg.pushManager.getSubscription()
      if (subscription && !sameKey(subscription, publicKey)) { await subscription.unsubscribe(); subscription = null }
      subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) })
      await register(subscription)
      setStatus('enabled')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengaktifkan notifikasi.')
    } finally {
      setBusy(false)
    }
  }, [publicKey, register])

  const disable = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      const subscription = await reg?.pushManager.getSubscription()
      if (subscription) {
        const { remaining } = await api('DELETE', { audience, endpoint: subscription.endpoint })
        // Lepas langganan browser hanya bila tidak ada akun lain (mis. kakak-adik) yang memakainya.
        if (!remaining) await subscription.unsubscribe()
      }
      localStorage.removeItem(optInKey(audience, ownerKey))
      setStatus('available')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mematikan notifikasi.')
    } finally {
      setBusy(false)
    }
  }, [audience, ownerKey])

  return { status, busy, error, enable, disable }
}
