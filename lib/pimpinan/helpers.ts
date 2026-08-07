import { query } from '@/lib/db'
import {
  getCachedMarhalahList,
  getCachedTahunAjaranAktif,
  getCachedTahunAjaranList,
} from '@/lib/cache/master'
export {
  BULAN_PANJANG,
  currentMonthWib,
  todayWib,
  monthPeriod,
  labelBulan,
  rupiah,
  rupiahCompact,
  pct,
  safeNumber,
  type MonthPeriod,
} from './format'

export async function getAsramaOptions(): Promise<string[]> {
  try {
    const rows = await query<{ asrama: string }>(
      `SELECT DISTINCT asrama
       FROM santri
       WHERE asrama IS NOT NULL AND asrama != ''
       ORDER BY asrama`
    )
    return rows.map(row => row.asrama)
  } catch {
    return []
  }
}

export async function getMarhalahOptions(): Promise<Array<{ id: number; nama: string }>> {
  try {
    return await getCachedMarhalahList()
  } catch {
    return []
  }
}

export async function getTahunAjaranOptions(): Promise<Array<Record<string, unknown>>> {
  try {
    return await getCachedTahunAjaranList()
  } catch {
    return []
  }
}

export async function getActiveTahunAjaran(): Promise<Record<string, unknown> | null> {
  try {
    return await getCachedTahunAjaranAktif()
  } catch {
    return null
  }
}

export async function getSantriPerAsrama(): Promise<Array<{ asrama: string; total: number }>> {
  try {
    return await query<{ asrama: string; total: number }>(
      `SELECT COALESCE(asrama, 'Tanpa Asrama') AS asrama, COUNT(*) AS total
       FROM santri
       WHERE status_global = 'aktif'
       GROUP BY COALESCE(asrama, 'Tanpa Asrama')
       ORDER BY asrama`
    )
  } catch {
    return []
  }
}
