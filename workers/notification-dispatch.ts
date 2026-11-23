import { environmentDatabase } from '../lib/db/environment'
import { processOutbox } from '../lib/notifications/dispatch'
import { processDeliveries, pushRuntimeFromEnv } from '../lib/notifications/push'
import { processBroadcasts } from '../lib/notifications/broadcast'
import { runReminders } from '../lib/notifications/reminders'
import { runRetention } from '../lib/notifications/retention'
import { runSourceScans } from '../lib/notifications/scans'
import { d1NotifStore } from '../lib/notifications/store'

export interface NotificationDispatchEnv {
  DB: D1Database
  DEMO_DB?: D1Database
  ESKAHADE_ENV: 'production' | 'sandbox'
  NOTIFICATIONS_DISPATCH_ENABLED: string
  // Secret Web Push (wrangler secret put). Tidak ada → kanal push mati, in-app tetap jalan.
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
  // Secret FCM (service account Firebase) untuk APK Android.
  FCM_PROJECT_ID?: string
  FCM_CLIENT_EMAIL?: string
  FCM_PRIVATE_KEY?: string
}

// Penyapu outbox: kirim yang tertinggal dari dispatch inline (waitUntil) dan retry.
// Berhenti sebelum batas waktu cron; sisa baris diproses tick berikutnya.
const worker = {
  async scheduled(controller: ScheduledController, env: NotificationDispatchEnv) {
    if (String(env.NOTIFICATIONS_DISPATCH_ENABLED) !== 'true') return
    const { db, environment } = environmentDatabase(env)
    const store = d1NotifStore(db)
    const push = pushRuntimeFromEnv(env as unknown as Record<string, unknown>)
    const started = Date.now()
    const total = { claimed: 0, done: 0, skipped: 0, retried: 0, failed: 0, delivered: 0 }
    try {
      // Event pegawai dari sumber ber-writer banyak (rekonsiliasi, anomali BRIVA, masalah penerbitan).
      const scans = await runSourceScans(store, new Date(Math.max(controller.scheduledTime, Date.now())))
      if (scans.some(s => s.notified || s.initialized || s.error)) {
        console.log(JSON.stringify({ event: 'notif_source_scan', environment, scans }))
      }
      // Pengingat: bukti transfer hampir kedaluwarsa, tunggakan bulanan (bila diaktifkan admin).
      const reminders = await runReminders(store, new Date(Math.max(controller.scheduledTime, Date.now())))
      if (reminders.transferExpiring || reminders.arrears) console.log(JSON.stringify({ event: 'notif_reminders', environment, ...reminders }))
      for (let round = 0; round < 10 && Date.now() - started < 60_000; round++) {
        const result = await processOutbox(store, { at: new Date(Math.max(controller.scheduledTime, Date.now())), limit: 25, push })
        if (result.paused) {
          console.log(JSON.stringify({ event: 'notif_dispatch_paused', environment }))
          return
        }
        for (const key of Object.keys(total) as Array<keyof typeof total>) total[key] += result[key]
        if (result.claimed < 25) break
      }
      // Pengumuman (broadcast) terjadwal / lanjutan fan-out.
      const broadcasts = await processBroadcasts(store, push, { maxChunks: 10 })
      // Sapu push yang tertunda (retry 429/5xx), tertinggal dari dispatch inline, atau antrian broadcast.
      const pushResult = { claimed: 0, sent: 0, expired: 0, failed: 0, retried: 0, skipped: 0 }
      for (let round = 0; round < 8 && Date.now() - started < 90_000; round++) {
        const r = await processDeliveries(store, push, { limit: 150 })
        for (const key of Object.keys(pushResult) as Array<keyof typeof pushResult>) pushResult[key] += r[key]
        if (r.claimed < 150) break
      }
      if (total.claimed || pushResult.claimed || broadcasts.claimed) {
        console.log(JSON.stringify({ event: 'notif_dispatch_run', environment, ...total, broadcasts, push: pushResult, elapsedMs: Date.now() - started }))
      }
      // Retensi data notifikasi, sekali sehari (WIB).
      const retention = await runRetention(store)
      if (retention.ran) console.log(JSON.stringify({ event: 'notif_retention', environment, ...retention }))
    } catch (error) {
      console.error(JSON.stringify({ event: 'notif_dispatch_failed', environment,
        message: error instanceof Error ? error.message.slice(0, 200) : 'Dispatch gagal.' }))
      throw error
    }
  },
}

export default worker
