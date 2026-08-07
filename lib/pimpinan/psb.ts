import { query } from '@/lib/db'
import { safeNumber } from './helpers'

export const PSB_STATUS_ORDER = [
  'VERIFICATION',
  'VERIFIED',
  'PLACED_ASRAMA',
  'PAID',
  'PLACED_KAMAR',
  'DONE',
] as const

export type PsbStatus = (typeof PSB_STATUS_ORDER)[number]

export type PsbMonitoring = {
  summary: Record<PsbStatus, number>
  total: number
  recent: Array<{
    id: string
    nama_lengkap: string
    nis: string | null
    asrama: string | null
    kamar: string | null
    status: PsbStatus
    created_at: string | null
  }>
}

function normalizeStatus(status: string | null | undefined): PsbStatus {
  return (PSB_STATUS_ORDER as readonly string[]).includes(status ?? '')
    ? (status as PsbStatus)
    : 'VERIFICATION'
}

export async function getPsbMonitoringPimpinan(): Promise<PsbMonitoring> {
  try {
    const [rows, recent] = await Promise.all([
      query<{ status: string; total: number }>(
        `SELECT COALESCE(pf.status, 'VERIFICATION') AS status, COUNT(*) AS total
         FROM santri s
         JOIN psb_flow pf ON pf.santri_id = s.id
         WHERE s.status_global = 'aktif'
         GROUP BY COALESCE(pf.status, 'VERIFICATION')`
      ),
      query<{
        id: string
        nama_lengkap: string
        nis: string | null
        asrama: string | null
        kamar: string | null
        status: string | null
        created_at: string | null
      }>(
        `SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
                pf.status,
                s.created_at
         FROM santri s
         JOIN psb_flow pf ON pf.santri_id = s.id
         WHERE s.status_global = 'aktif'
         ORDER BY s.created_at DESC
         LIMIT 15`
      ),
    ])

    const summary = PSB_STATUS_ORDER.reduce((acc, status) => {
      acc[status] = 0
      return acc
    }, {} as Record<PsbStatus, number>)
    for (const row of rows) {
      summary[normalizeStatus(row.status)] += safeNumber(row.total)
    }

    return {
      summary,
      total: rows.reduce((sum, row) => sum + safeNumber(row.total), 0),
      recent: recent.map(row => ({
        ...row,
        status: normalizeStatus(row.status),
      })),
    }
  } catch {
    const summary = PSB_STATUS_ORDER.reduce((acc, status) => {
      acc[status] = 0
      return acc
    }, {} as Record<PsbStatus, number>)
    return { summary, total: 0, recent: [] }
  }
}
