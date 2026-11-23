import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getPortalSession } from '@/lib/portal/session'
import { readNotifSetting } from '@/lib/notifications/config'
import { DeviceConflictError, registerFcmDevice, registerWebPushDevice, renewWebPushDevice, unlinkByEndpoint } from '@/lib/notifications/devices'
import { appPushRuntime, DEVICE_COOKIE, sessionNotifStore } from '@/lib/notifications/runtime'
import type { NotifRecipient } from '@/lib/notifications/types'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }
const MAX_BODY = 4096

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

async function ownerFor(audience: unknown): Promise<NotifRecipient | null> {
  if (audience === 'portal') {
    const portal = await getPortalSession()
    return portal && !portal.must_change_password ? { kind: 'SANTRI', id: portal.santri_id } : null
  }
  if (audience === 'staff') {
    const session = await getSession().catch(() => null)
    return session ? { kind: 'USER', id: session.id } : null
  }
  return null
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) return null
  const text = await request.text()
  if (text.length > MAX_BODY) return null
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

async function pushAvailable() {
  const runtime = await appPushRuntime()
  const enabled = await readNotifSetting(sessionNotifStore(), 'notifications_push_enabled').catch(() => false)
  return {
    webpushKey: enabled && runtime.webpush ? runtime.webpush.publicKey : null,
    fcm: enabled && !!runtime.fcm,
  }
}

/** Konfigurasi publik untuk klien: hanya kunci publik VAPID, tidak pernah secret. */
export async function GET(request: Request) {
  const owner = await ownerFor(new URL(request.url).searchParams.get('audience'))
  if (!owner) return json({ error: 'Sesi tidak valid.' }, 401)
  const available = await pushAvailable()
  return json({ webpush: { enabled: !!available.webpushKey, publicKey: available.webpushKey }, fcm: { enabled: available.fcm } })
}

/** Daftarkan langganan Web Push (browser) atau token FCM (APK Android) untuk owner sesi. */
export async function POST(request: Request) {
  const body = await readBody(request)
  if (!body) return json({ error: 'Permintaan tidak valid.' }, 400)
  const owner = await ownerFor(body.audience)
  if (!owner) return json({ error: 'Sesi tidak valid.' }, 401)
  const available = await pushAvailable()
  const isFcm = body.channel === 'FCM'
  if (isFcm ? !available.fcm : !available.webpushKey) return json({ error: 'Notifikasi push belum diaktifkan.' }, 503)
  try {
    const meta = { platform: body.platform, userAgent: request.headers.get('user-agent') }
    const { deviceId } = isFcm
      ? await registerFcmDevice(sessionNotifStore(), owner, body.token, meta)
      : await registerWebPushDevice(sessionNotifStore(), owner, body.subscription as never, meta)
    const response = json({ ok: true })
    response.cookies.set({ name: DEVICE_COOKIE, value: deviceId, httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 400 * 86400 })
    return response
  } catch (error) {
    if (error instanceof DeviceConflictError) return json({ error: error.message }, 409)
    return json({ error: error instanceof Error ? error.message : 'Gagal mendaftarkan perangkat.' }, 400)
  }
}

/** Berhenti menerima push di browser ini untuk owner sesi. */
export async function DELETE(request: Request) {
  const body = await readBody(request)
  if (!body) return json({ error: 'Permintaan tidak valid.' }, 400)
  const owner = await ownerFor(body.audience)
  if (!owner) return json({ error: 'Sesi tidak valid.' }, 401)
  try {
    const remaining = await unlinkByEndpoint(sessionNotifStore(), owner, body.channel === 'FCM' ? body.token : body.endpoint)
    return json({ ok: true, remaining })
  } catch {
    return json({ error: 'Gagal melepas perangkat.' }, 500)
  }
}

/** pushsubscriptionchange dari service worker: pindahkan owner yang sesinya aktif. */
export async function PUT(request: Request) {
  const body = await readBody(request)
  if (!body) return json({ error: 'Permintaan tidak valid.' }, 400)
  const owners = (await Promise.all([ownerFor('staff'), ownerFor('portal')])).filter((o): o is NotifRecipient => !!o)
  if (!owners.length) return json({ error: 'Sesi tidak valid.' }, 401)
  if (!(await pushAvailable()).webpushKey) return json({ error: 'Notifikasi push belum diaktifkan.' }, 503)
  try {
    const renewed = await renewWebPushDevice(sessionNotifStore(), owners, body.oldEndpoint, body.subscription as never)
    if (!renewed) return json({ error: 'Perangkat lama tidak ditemukan.' }, 404)
    const response = json({ ok: true })
    response.cookies.set({ name: DEVICE_COOKIE, value: renewed.deviceId, httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 400 * 86400 })
    return response
  } catch (error) {
    if (error instanceof DeviceConflictError) return json({ error: error.message }, 409)
    return json({ error: 'Gagal memperbarui perangkat.' }, 400)
  }
}
