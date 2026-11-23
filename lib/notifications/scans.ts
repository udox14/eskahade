// Pemindai berkala (cron notification-dispatch) untuk sumber event pegawai yang ditulis dari
// banyak tempat. Setiap sumber memakai cursor sendiri (format waktu sumber itu sendiri).
// Notifikasi digest + update cursor dalam SATU batch → tidak ada notifikasi ganda/terlewat.
// Jalan pertama hanya menginisialisasi cursor (data lama tidak dikirim sebagai notifikasi).

import { notificationSchemaReady } from './finance-events'
import { dedupeKeyPart, notifyStatement } from './outbox'
import type { NotifStore } from './types'

const MATCH_LABELS: Record<string, string> = {
  UNALLOCATED_TRANSFER: 'transfer belum teralokasi',
  UNALLOCATED: 'dana belum teralokasi',
  AMOUNT_MISMATCH: 'selisih nominal',
  MISSING_IN_BANK: 'tidak ada di mutasi bank',
  MISSING_INTERNAL: 'tidak tercatat di sistem',
  MANUAL_TRANSFER_OUTCOME_UNKNOWN: 'hasil transfer manual belum pasti',
}

function labelList(raw: string | null, labels: Record<string, string> = MATCH_LABELS): string {
  const parts = [...new Set(String(raw ?? '').split(',').map(s => s.trim()).filter(Boolean))]
  const text = parts.map(p => labels[p] ?? p.toLowerCase().replace(/_/g, ' ')).join(', ')
  return text.length > 160 ? `${text.slice(0, 157)}…` : text || '-'
}

interface Source {
  key: string
  /** MAX(waktu) saat ini — untuk inisialisasi cursor. */
  maxSql: string
  /** Ringkasan baris baru setelah cursor: n, maxAt, detail. */
  summarySql: string
  build(row: { n: number; maxAt: string; detail: string | null }): { code: string; payload: Record<string, string | number> }
}

const SOURCES: Source[] = [
  {
    key: 'finance_reconciliation_items',
    maxSql: 'SELECT MAX(created_at) AS v FROM finance_reconciliation_items',
    summarySql: `SELECT COUNT(*) AS n, MAX(created_at) AS maxAt, GROUP_CONCAT(DISTINCT match_status) AS detail
                 FROM finance_reconciliation_items WHERE created_at > ?`,
    build: row => ({ code: 'STAFF_REKONSILIASI_BARU', payload: { jumlah: row.n, jenis: labelList(row.detail) } }),
  },
  {
    key: 'finance_bri_recovery_queue',
    maxSql: 'SELECT MAX(created_at) AS v FROM finance_bri_recovery_queue',
    summarySql: `SELECT COUNT(*) AS n, MAX(created_at) AS maxAt, GROUP_CONCAT(DISTINCT reason) AS detail
                 FROM finance_bri_recovery_queue WHERE created_at > ? AND recovery_status = 'DISCREPANCY'`,
    build: row => ({ code: 'STAFF_BRIVA_ANOMALI', payload: { jumlah: row.n, jenis: labelList(row.detail) } }),
  },
  {
    key: 'finance_billing_issues',
    maxSql: 'SELECT MAX(updated_at) AS v FROM finance_billing_issues',
    summarySql: `SELECT COUNT(*) AS n, MAX(updated_at) AS maxAt, GROUP_CONCAT(DISTINCT period) AS detail
                 FROM finance_billing_issues WHERE updated_at > ? AND status = 'OPEN'`,
    build: row => ({ code: 'STAFF_PENERBITAN_TAGIHAN_BERMASALAH', payload: { jumlah: row.n, periode: labelList(row.detail, {}) } }),
  },
]

export interface ScanResult { source: string; notified: number; initialized: boolean; error?: string }

export async function runSourceScans(store: NotifStore, at = new Date()): Promise<ScanResult[]> {
  if (!(await notificationSchemaReady(store))) return []
  const results: ScanResult[] = []
  for (const source of SOURCES) {
    try {
      const cursorRow = await store.queryOne<{ cursor: string }>('SELECT cursor FROM notif_source_cursors WHERE source = ?', [source.key])
      if (!cursorRow) {
        const max = await store.queryOne<{ v: string | null }>(source.maxSql)
        await store.execute(`INSERT OR IGNORE INTO notif_source_cursors (source, cursor, updated_at) VALUES (?, ?, ?)`,
          [source.key, max?.v ?? '', at.toISOString()])
        results.push({ source: source.key, notified: 0, initialized: true })
        continue
      }
      // Baris status lain di atas cursor tetap memajukan cursor (MAX tanpa filter status).
      const advance = await store.queryOne<{ v: string | null }>(`${source.maxSql} WHERE ${source.maxSql.includes('updated_at') ? 'updated_at' : 'created_at'} > ?`, [cursorRow.cursor])
      if (!advance?.v) { results.push({ source: source.key, notified: 0, initialized: false }); continue }
      const summary = await store.queryOne<{ n: number; maxAt: string | null; detail: string | null }>(source.summarySql, [cursorRow.cursor])
      const statements = [{
        // Cursor maju hanya jika belum dimajukan pemindai lain (compare-and-set).
        sql: 'UPDATE notif_source_cursors SET cursor = ?, updated_at = ? WHERE source = ? AND cursor = ?',
        params: [advance.v, at.toISOString(), source.key, cursorRow.cursor] as unknown[],
      }]
      let notified = 0
      if (summary && Number(summary.n) > 0 && summary.maxAt) {
        const { code, payload } = source.build({ n: Number(summary.n), maxAt: summary.maxAt, detail: summary.detail })
        statements.push(notifyStatement(code, `SCAN:${source.key}:${dedupeKeyPart(summary.maxAt)}`, payload, {
          sql: 'SELECT 1 FROM notif_source_cursors WHERE source = ? AND cursor = ?', params: [source.key, advance.v],
        }))
        notified = 1
      }
      await store.batch(statements)
      results.push({ source: source.key, notified, initialized: false })
    } catch (error) {
      // Tabel sumber belum ada di environment ini → lewati tanpa menghentikan sumber lain.
      results.push({ source: source.key, notified: 0, initialized: false, error: error instanceof Error ? error.message.slice(0, 120) : 'unknown' })
    }
  }
  return results
}
