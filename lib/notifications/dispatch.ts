// Dispatcher outbox → inbox (dan kanal push pada fase NOTIF-2/3).
// Aman dijalankan paralel (waitUntil app + cron): klaim atomik per baris, insert inbox
// idempoten (UNIQUE outbox+penerima), finalisasi hanya oleh pemegang klaim.

import { getEventDefinition } from './catalog'
import { getEffectiveConfig, readNotifSetting } from './config'
import { TEST_RECIPIENT_KEY } from './outbox'
import { enabledPushChannels, isPushDispatchActive, processDeliveries, queueDeliveries, type DeliveryResult, type PushRuntime } from './push'
import { resolveRecipients } from './recipients'
import { renderNotification, safeInternalLink } from './render'
import type { NotifPayload, NotifStore, SqlStatement } from './types'

export const MAX_ATTEMPTS = 5
const CLAIM_MS = 2 * 60_000
const INSERT_CHUNK = 50

interface ClaimedRow {
  id: string
  event_code: string
  payload_json: string
  attempts: number
  claim_until: string
}

export interface DispatchResult {
  paused: boolean
  claimed: number
  done: number
  skipped: number
  retried: number
  failed: number
  delivered: number
  push: DeliveryResult | null
}

export function retryDelayMs(attempts: number): number {
  return Math.min(30 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1))
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Kesalahan tidak diketahui.'
  return message.replace(/[\r\n]+/g, ' ').slice(0, 300)
}

async function claim(store: NotifStore, at: Date, limit: number, outboxIds?: string[]): Promise<ClaimedRow[]> {
  const nowIso = at.toISOString()
  // Toleransi 1 detik: strftime('now') SQLite dapat membulatkan milidetik ke atas dibanding jam JS.
  const dueIso = new Date(at.getTime() + 1000).toISOString()
  const until = new Date(at.getTime() + CLAIM_MS).toISOString()
  const targeted = outboxIds?.length
    ? `id IN (${outboxIds.map(() => '?').join(',')}) AND status = 'PENDING'`
    : `(status = 'PENDING' AND next_attempt_at <= ?) OR (status = 'PROCESSING' AND claim_until < ?)`
  const params = outboxIds?.length ? [...outboxIds] : [dueIso, nowIso]
  return store.query<ClaimedRow>(
    `UPDATE notif_outbox SET status = 'PROCESSING', claim_until = ?, attempts = attempts + 1
     WHERE id IN (SELECT id FROM notif_outbox WHERE ${targeted} ORDER BY created_at LIMIT ?)
     RETURNING id, event_code, payload_json, attempts, claim_until`,
    [until, ...params, limit],
  )
}

async function finish(store: NotifStore, row: ClaimedRow, status: 'DONE' | 'SKIPPED', count: number, reason: string | null, at: Date) {
  await store.execute(
    `UPDATE notif_outbox SET status = ?, recipient_count = ?, skip_reason = ?, last_error = NULL,
       claim_until = NULL, processed_at = ? WHERE id = ? AND status = 'PROCESSING' AND claim_until = ?`,
    [status, count, reason, at.toISOString(), row.id, row.claim_until],
  )
}

async function processRow(store: NotifStore, row: ClaimedRow, at: Date, pushActive: boolean, push: PushRuntime | null | undefined): Promise<{ status: 'DONE' | 'SKIPPED'; count: number }> {
  const def = getEventDefinition(row.event_code)
  if (!def) {
    await finish(store, row, 'SKIPPED', 0, 'UNKNOWN_EVENT', at)
    return { status: 'SKIPPED', count: 0 }
  }
  let payload: NotifPayload
  try { payload = JSON.parse(row.payload_json) as NotifPayload } catch { payload = {} }
  const isTest = typeof payload[TEST_RECIPIENT_KEY] === 'string'

  const config = await getEffectiveConfig(store, def.code)
  if (!config.enabled && !isTest) {
    await finish(store, row, 'SKIPPED', 0, 'DISABLED', at)
    return { status: 'SKIPPED', count: 0 }
  }

  const link = safeInternalLink(def.link)
  const recipients = await resolveRecipients(store, config, payload, link)
  if (!recipients.length) {
    await finish(store, row, 'SKIPPED', 0, 'NO_RECIPIENT', at)
    return { status: 'SKIPPED', count: 0 }
  }

  const rendered = renderNotification(def, config, payload)
  const title = isTest ? `[Uji] ${rendered.title}` : rendered.title
  const statements: SqlStatement[] = recipients.map(r => ({
    sql: `INSERT OR IGNORE INTO notifications (id, recipient_kind, recipient_id, event_code, category, outbox_id,
            title, body, push_body, link, level, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [crypto.randomUUID(), r.kind, r.id, def.code, def.category, row.id,
      title, rendered.body, rendered.pushBody, r.link, def.level, at.toISOString()],
  }))
  for (let i = 0; i < statements.length; i += INSERT_CHUNK) {
    await store.batch(statements.slice(i, i + INSERT_CHUNK))
  }
  // Antrian push dibuat sebelum outbox DONE: bila gagal, seluruh baris di-retry (inbox & antrian idempoten).
  if (pushActive) await queueDeliveries(store, row.id, enabledPushChannels(config.channels, push), config.mandatory)
  await finish(store, row, 'DONE', recipients.length, null, at)
  return { status: 'DONE', count: recipients.length }
}

export async function processOutbox(
  store: NotifStore,
  options: { at?: Date; limit?: number; outboxIds?: string[]; push?: PushRuntime | null } = {},
): Promise<DispatchResult> {
  const at = options.at ?? new Date()
  const result: DispatchResult = { paused: false, claimed: 0, done: 0, skipped: 0, retried: 0, failed: 0, delivered: 0, push: null }
  if (!(await readNotifSetting(store, 'notifications_enabled'))) return { ...result, paused: true }

  const rows = await claim(store, at, Math.min(100, Math.max(1, options.limit ?? 20)), options.outboxIds)
  result.claimed = rows.length
  const pushActive = rows.length > 0 && await isPushDispatchActive(store, options.push)
  const doneIds: string[] = []
  for (const row of rows) {
    try {
      const outcome = await processRow(store, row, at, pushActive, options.push)
      if (outcome.status === 'DONE') doneIds.push(row.id)
      if (outcome.status === 'DONE') { result.done++; result.delivered += outcome.count } else result.skipped++
    } catch (error) {
      const failed = row.attempts >= MAX_ATTEMPTS
      await store.execute(
        `UPDATE notif_outbox SET status = ?, next_attempt_at = ?, last_error = ?, claim_until = NULL,
           processed_at = CASE WHEN ? = 'FAILED' THEN ? ELSE processed_at END
         WHERE id = ? AND status = 'PROCESSING' AND claim_until = ?`,
        [failed ? 'FAILED' : 'PENDING', new Date(at.getTime() + retryDelayMs(row.attempts)).toISOString(), safeError(error),
          failed ? 'FAILED' : 'PENDING', at.toISOString(), row.id, row.claim_until],
      )
      if (failed) result.failed++; else result.retried++
    }
  }
  // Kirim push untuk baris yang baru selesai; sisanya (retry) disapu cron.
  if (pushActive && doneIds.length) {
    result.push = await processDeliveries(store, options.push, { at, outboxIds: doneIds, limit: 200 })
      .catch(() => null)
  }
  return result
}

/** Kirim ulang manual (modul pengaturan): hanya FAILED/SKIPPED, inbox tetap idempoten. */
export async function requeueOutbox(store: NotifStore, outboxId: string) {
  await store.execute(
    `UPDATE notif_outbox SET status = 'PENDING', attempts = 0, next_attempt_at = ?, last_error = NULL, skip_reason = NULL
     WHERE id = ? AND status IN ('FAILED', 'SKIPPED')`,
    [new Date().toISOString(), outboxId],
  )
}
