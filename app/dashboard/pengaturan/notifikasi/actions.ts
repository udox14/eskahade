'use server'

import { revalidatePath } from 'next/cache'
import { getSession, isSuperAccess, type SessionUser } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getEventDefinition, NOTIF_EVENTS, requireEventDefinition, samplePayload } from '@/lib/notifications/catalog'
import { listEffectiveConfigs, readNotifSetting, resetEventConfig, saveEventConfig, type EventConfigInput } from '@/lib/notifications/config'
import { testNotifyStatement } from '@/lib/notifications/outbox'
import { appPushRuntime, kickBroadcastDispatch, kickNotificationDispatch, sessionNotifStore } from '@/lib/notifications/runtime'
import { cancelBroadcast, createBroadcast, estimateAudience, normalizeAudience, type BroadcastAudience, type BroadcastInput } from '@/lib/notifications/broadcast'
import { requeueOutbox } from '@/lib/notifications/dispatch'
import { ALL_ASRAMA_LIST } from '@/lib/asrama'
import type { EffectiveEventConfig, NotifEventDefinition } from '@/lib/notifications/types'

const PATH = '/dashboard/pengaturan/notifikasi'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

async function admin(): Promise<SessionUser> {
  const session = await getSession()
  if (!session || !isSuperAccess(session)) throw new Error('Hanya admin yang boleh mengatur notifikasi.')
  return session
}

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Terjadi kesalahan.' }
  }
}

export interface EventConfigView {
  definition: NotifEventDefinition
  enabled: boolean
  mandatory: boolean
  channels: EffectiveEventConfig['channels']
  title: string
  inApp: string
  push: string
  pushPrivacy: EffectiveEventConfig['pushPrivacy']
  recipients: EffectiveEventConfig['recipients']
  overridden: boolean
  updatedAt: string | null
  linkRegistered: boolean
}

export interface NotificationSettingsData {
  enabled: boolean
  pushEnabled: boolean
  events: EventConfigView[]
  outbox: { pending: number; failed: number; done7d: number; skipped7d: number }
  users: Array<{ id: string; full_name: string; role: string }>
  channels: ChannelStatus
  /** Tanggal (WIB) mulai dikirimnya pengingat tunggakan bulanan. */
  arrearsDay: number
}

export interface ChannelStatus {
  webpushConfigured: boolean
  /** 8 karakter awal kunci publik — untuk mencocokkan dengan secret, bukan rahasia. */
  webpushKeyHint: string | null
  fcmConfigured: boolean
  /** ID project Firebase (bukan rahasia) untuk mencocokkan google-services.json di APK. */
  fcmProjectId: string | null
  devices: { webpushParent: number; webpushStaff: number; fcmParent: number; fcmStaff: number; inactive: number }
  deliveries7d: { sent: number; pending: number; failed: number; expired: number }
}

function view(config: EffectiveEventConfig, registered: Set<string>): EventConfigView {
  const { definition } = config
  return {
    definition,
    enabled: config.enabled,
    mandatory: config.mandatory,
    channels: config.channels,
    title: config.title,
    inApp: config.inApp,
    push: config.push,
    pushPrivacy: config.pushPrivacy,
    recipients: config.recipients,
    overridden: config.overridden,
    updatedAt: config.updatedAt,
    linkRegistered: definition.audience === 'PARENT' || registered.has(definition.link),
  }
}

export async function loadNotificationSettings(): Promise<NotificationSettingsData> {
  await admin()
  const store = sessionNotifStore()
  const staffLinks = [...new Set(NOTIF_EVENTS.filter(e => e.audience === 'STAFF').map(e => e.link))]
  const since = new Date(Date.now() - 7 * 86400_000).toISOString()
  const [configs, enabled, pushEnabled, links, stats, users, devices, deliveries, runtime, arrearsDay] = await Promise.all([
    listEffectiveConfigs(store),
    readNotifSetting(store, 'notifications_enabled'),
    readNotifSetting(store, 'notifications_push_enabled'),
    store.query<{ href: string }>(`SELECT href FROM fitur_akses WHERE is_active = 1 AND href IN (${staffLinks.map(() => '?').join(',')})`, staffLinks),
    store.queryOne<{ pending: number; failed: number; done7d: number; skipped7d: number }>(
      `SELECT
         SUM(CASE WHEN status IN ('PENDING','PROCESSING') THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status = 'DONE' AND created_at >= ? THEN 1 ELSE 0 END) AS done7d,
         SUM(CASE WHEN status = 'SKIPPED' AND created_at >= ? THEN 1 ELSE 0 END) AS skipped7d
       FROM notif_outbox`, [since, since]),
    store.query<{ id: string; full_name: string; role: string }>(
      `SELECT id, COALESCE(full_name, email) AS full_name, role FROM users WHERE role NOT IN ('tester','demo') ORDER BY full_name LIMIT 1000`),
    store.query<{ channel: string; owner_kind: string | null; is_active: number; n: number }>(
      `SELECT d.channel, l.owner_kind, d.is_active, COUNT(DISTINCT d.id) AS n
       FROM notif_devices d LEFT JOIN notif_device_links l ON l.device_id = d.id
       GROUP BY d.channel, l.owner_kind, d.is_active`),
    store.queryOne<{ sent: number; pending: number; failed: number; expired: number }>(
      `SELECT SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) AS sent,
              SUM(CASE WHEN status IN ('PENDING','SENDING') THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
              SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) AS expired
       FROM notif_deliveries WHERE created_at >= ?`, [since]),
    appPushRuntime(),
    store.queryOne<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'notifications_arrears_day'`),
  ])
  const count = (channel: string, kind: string) => devices
    .filter(d => d.channel === channel && d.owner_kind === kind && Number(d.is_active) === 1)
    .reduce((n, d) => n + Number(d.n), 0)
  const registered = new Set(links.map(l => l.href))
  return {
    enabled,
    pushEnabled,
    events: configs.map(c => view(c, registered)),
    outbox: {
      pending: Number(stats?.pending ?? 0), failed: Number(stats?.failed ?? 0),
      done7d: Number(stats?.done7d ?? 0), skipped7d: Number(stats?.skipped7d ?? 0),
    },
    users,
    arrearsDay: Math.min(28, Math.max(1, Number.parseInt(arrearsDay?.value ?? '10', 10) || 10)),
    channels: {
      webpushConfigured: !!runtime.webpush,
      webpushKeyHint: runtime.webpush ? runtime.webpush.publicKey.slice(0, 8) : null,
      fcmConfigured: !!runtime.fcm,
      fcmProjectId: runtime.fcm?.projectId ?? null,
      devices: {
        webpushParent: count('WEBPUSH', 'SANTRI'), webpushStaff: count('WEBPUSH', 'USER'),
        fcmParent: count('FCM', 'SANTRI'), fcmStaff: count('FCM', 'USER'),
        inactive: devices.filter(d => Number(d.is_active) !== 1).reduce((n, d) => n + Number(d.n), 0),
      },
      deliveries7d: {
        sent: Number(deliveries?.sent ?? 0), pending: Number(deliveries?.pending ?? 0),
        failed: Number(deliveries?.failed ?? 0), expired: Number(deliveries?.expired ?? 0),
      },
    },
  }
}

export async function saveNotificationEvent(code: string, input: EventConfigInput) {
  return run(async () => {
    const session = await admin()
    const def = requireEventDefinition(code)
    const saved = await saveEventConfig(sessionNotifStore(), code, input, session.id)
    await logActivity({
      actor: actorFromSession(session),
      module: 'notifikasi',
      action: 'update_event',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'notif_event_types',
      entityId: code,
      entityLabel: def.label,
      summary: `Memperbarui pengaturan notifikasi "${def.label}"`,
      details: { enabled: saved.enabled, mandatory: saved.mandatory, channels: saved.channels, push_privacy: saved.pushPrivacy },
    })
    revalidatePath(PATH)
    return true
  })
}

export async function resetNotificationEvent(code: string) {
  return run(async () => {
    const session = await admin()
    const def = requireEventDefinition(code)
    await resetEventConfig(sessionNotifStore(), code)
    await logActivity({
      actor: actorFromSession(session),
      module: 'notifikasi',
      action: 'reset_event',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'notif_event_types',
      entityId: code,
      entityLabel: def.label,
      summary: `Mengembalikan notifikasi "${def.label}" ke pengaturan bawaan`,
    })
    revalidatePath(PATH)
    return true
  })
}

/** Kirim uji ke admin yang menekan tombol, memakai redaksi tersimpan + data contoh. */
export async function sendNotificationTest(code: string) {
  return run(async () => {
    const session = await admin()
    const def = requireEventDefinition(code)
    const store = sessionNotifStore()
    if (!(await readNotifSetting(store, 'notifications_enabled'))) {
      throw new Error('Pengiriman notifikasi sedang dijeda. Aktifkan terlebih dahulu.')
    }
    const statement = testNotifyStatement(code, session.id, { ...samplePayload(def), actor_user_id: session.id })
    await store.execute(statement.sql, statement.params)
    await kickNotificationDispatch([String(statement.params[0])])
    return true
  })
}

export async function setNotificationsEnabled(enabled: boolean) {
  return run(async () => {
    const session = await admin()
    await sessionNotifStore().execute(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('notifications_enabled', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [enabled ? '1' : '0'],
    )
    await logActivity({
      actor: actorFromSession(session),
      module: 'notifikasi',
      action: enabled ? 'resume_dispatch' : 'pause_dispatch',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'app_settings',
      entityLabel: 'notifications_enabled',
      summary: enabled ? 'Melanjutkan pengiriman notifikasi' : 'Menjeda pengiriman notifikasi',
    })
    revalidatePath(PATH)
    return enabled
  })
}

export async function setPushEnabled(enabled: boolean) {
  return run(async () => {
    const session = await admin()
    const runtime = await appPushRuntime()
    if (enabled && !runtime.webpush && !runtime.fcm) {
      throw new Error('Kredensial push belum dipasang di server (VAPID_* untuk browser/iPhone atau FCM_* untuk APK Android).')
    }
    await sessionNotifStore().execute(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('notifications_push_enabled', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [enabled ? '1' : '0'],
    )
    await logActivity({
      actor: actorFromSession(session),
      module: 'notifikasi',
      action: enabled ? 'enable_push' : 'disable_push',
      fiturHref: PATH,
      logKind: 'update',
      entityType: 'app_settings',
      entityLabel: 'notifications_push_enabled',
      summary: enabled ? 'Mengaktifkan notifikasi push ke perangkat' : 'Mematikan notifikasi push ke perangkat',
    })
    revalidatePath(PATH)
    return enabled
  })
}

export async function setArrearsReminderDay(day: number) {
  return run(async () => {
    const session = await admin()
    const value = Math.trunc(Number(day))
    if (!Number.isInteger(value) || value < 1 || value > 28) throw new Error('Tanggal pengingat harus 1 sampai 28.')
    await sessionNotifStore().execute(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('notifications_arrears_day', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [String(value)],
    )
    await logActivity({
      actor: actorFromSession(session), module: 'notifikasi', action: 'set_arrears_day', fiturHref: PATH, logKind: 'update',
      entityType: 'app_settings', entityLabel: 'notifications_arrears_day', summary: `Pengingat tunggakan dikirim mulai tanggal ${value}`,
    })
    revalidatePath(PATH)
    return value
  })
}

// ── Broadcast / pengumuman ────────────────────────────────────────────

export interface BroadcastRow {
  id: string
  title: string
  body: string
  link: string | null
  audience: BroadcastAudience | null
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED'
  scheduled_at: string | null
  recipient_count: number
  read_count: number
  push_sent: number
  created_by_name: string | null
  created_at: string
}

export async function listBroadcasts() {
  return run<{ rows: BroadcastRow[]; asrama: string[] }>(async () => {
    await admin()
    const rows = await sessionNotifStore().query<Omit<BroadcastRow, 'audience'> & { audience_json: string }>(
      `SELECT b.id, b.title, b.body, b.link, b.audience_json, b.status, b.scheduled_at, b.recipient_count, b.created_at,
              u.full_name AS created_by_name,
              (SELECT COUNT(*) FROM notifications n WHERE n.broadcast_id = b.id AND n.read_at IS NOT NULL) AS read_count,
              (SELECT COUNT(*) FROM notif_deliveries d JOIN notifications n ON n.id = d.notification_id
                 WHERE n.broadcast_id = b.id AND d.status = 'SENT') AS push_sent
       FROM notif_broadcasts b LEFT JOIN users u ON u.id = b.created_by
       ORDER BY b.created_at DESC LIMIT 50`)
    return {
      rows: rows.map(({ audience_json, ...r }) => {
        let audience: BroadcastAudience | null = null
        try { audience = normalizeAudience(JSON.parse(audience_json)) } catch { audience = null }
        return { ...r, audience, recipient_count: Number(r.recipient_count), read_count: Number(r.read_count), push_sent: Number(r.push_sent) }
      }),
      asrama: [...ALL_ASRAMA_LIST],
    }
  })
}

export async function estimateBroadcastAudience(audience: BroadcastAudience) {
  return run(async () => {
    await admin()
    return estimateAudience(sessionNotifStore(), normalizeAudience(audience))
  })
}

export async function sendBroadcast(input: BroadcastInput) {
  return run(async () => {
    const session = await admin()
    const store = sessionNotifStore()
    if (!(await readNotifSetting(store, 'notifications_enabled'))) throw new Error('Pengiriman notifikasi sedang dijeda. Aktifkan terlebih dahulu.')
    const created = await createBroadcast(store, input, session.id)
    const recipients = await estimateAudience(store, created.audience)
    if (recipients === 0) {
      await cancelBroadcast(store, created.id)
      throw new Error('Tidak ada penerima untuk pilihan ini.')
    }
    await logActivity({
      actor: actorFromSession(session), module: 'notifikasi', action: 'broadcast', fiturHref: PATH, logKind: 'create',
      entityType: 'notif_broadcasts', entityId: created.id, entityLabel: created.title,
      summary: `Membuat pengumuman "${created.title}" untuk ${recipients} penerima`,
      details: { audience: created.audience, channels: created.channels, scheduled_at: created.scheduledAt },
    })
    if (Date.parse(created.scheduledAt) <= Date.now() + 60_000) await kickBroadcastDispatch()
    revalidatePath(PATH)
    return { id: created.id, recipients }
  })
}

export async function cancelBroadcastAction(id: string) {
  return run(async () => {
    const session = await admin()
    await cancelBroadcast(sessionNotifStore(), String(id))
    await logActivity({
      actor: actorFromSession(session), module: 'notifikasi', action: 'cancel_broadcast', fiturHref: PATH, logKind: 'update',
      entityType: 'notif_broadcasts', entityId: String(id), summary: 'Membatalkan pengumuman terjadwal',
    })
    revalidatePath(PATH)
    return true
  })
}

// ── Log pengiriman ────────────────────────────────────────────────────

export interface OutboxLogRow {
  id: string
  event_code: string
  event_label: string
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'SKIPPED'
  attempts: number
  recipient_count: number
  skip_reason: string | null
  last_error: string | null
  created_at: string
  processed_at: string | null
  push_sent: number
  push_failed: number
}

export async function listOutboxLog(filter: { status?: string; audience?: 'PARENT' | 'STAFF' | '' } = {}) {
  return run<OutboxLogRow[]>(async () => {
    await admin()
    const status = ['PENDING', 'PROCESSING', 'DONE', 'FAILED', 'SKIPPED'].includes(String(filter.status)) ? String(filter.status) : null
    const prefix = filter.audience === 'PARENT' ? 'PORTAL_%' : filter.audience === 'STAFF' ? 'STAFF_%' : null
    const where: string[] = []
    const params: unknown[] = []
    if (status) { where.push('o.status = ?'); params.push(status) }
    if (prefix) { where.push('o.event_code LIKE ?'); params.push(prefix) }
    const rows = await sessionNotifStore().query<Omit<OutboxLogRow, 'event_label'>>(
      `SELECT o.id, o.event_code, o.status, o.attempts, o.recipient_count, o.skip_reason, o.last_error, o.created_at, o.processed_at,
              (SELECT COUNT(*) FROM notif_deliveries d JOIN notifications n ON n.id = d.notification_id
                 WHERE n.outbox_id = o.id AND d.status = 'SENT') AS push_sent,
              (SELECT COUNT(*) FROM notif_deliveries d JOIN notifications n ON n.id = d.notification_id
                 WHERE n.outbox_id = o.id AND d.status IN ('FAILED', 'EXPIRED')) AS push_failed
       FROM notif_outbox o ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY o.created_at DESC LIMIT 150`, params)
    return rows.map(r => ({
      ...r,
      event_label: getEventDefinition(r.event_code)?.label ?? r.event_code,
      attempts: Number(r.attempts), recipient_count: Number(r.recipient_count),
      push_sent: Number(r.push_sent), push_failed: Number(r.push_failed),
    }))
  })
}

/** Kirim ulang hanya FAILED/SKIPPED. Inbox & push idempoten: penerima yang sudah menerima tidak dikirimi lagi. */
export async function retryOutboxAction(id: string) {
  return run(async () => {
    const session = await admin()
    const store = sessionNotifStore()
    await requeueOutbox(store, String(id))
    const row = await store.queryOne<{ status: string; event_code: string }>('SELECT status, event_code FROM notif_outbox WHERE id = ?', [String(id)])
    if (row?.status !== 'PENDING') throw new Error('Hanya notifikasi yang gagal atau dilewati yang bisa dikirim ulang.')
    await logActivity({
      actor: actorFromSession(session), module: 'notifikasi', action: 'retry_outbox', fiturHref: PATH, logKind: 'update',
      entityType: 'notif_outbox', entityId: String(id), summary: `Mengirim ulang notifikasi ${row.event_code}`,
    })
    await kickNotificationDispatch([String(id)])
    return true
  })
}
