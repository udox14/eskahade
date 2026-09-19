'use server'

import { query } from '@/lib/db'
import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import { getStudentsObligationMatrix } from '@/lib/finance/matrix'
import { FINANCE_CUTOVER_START_MONTHLY } from '@/lib/finance/legacy'
import type { StudentObligationMatrixItem } from '@/lib/finance/types'

export interface EnrichedStudentObligationMatrixItem extends StudentObligationMatrixItem {
  legacyTunggakanSpp: number
  hasLegacyTunggakan: boolean
  legacyTunggakanCount: number
  adjustedTotalRemaining: number
  isPreCutoverPeriod: boolean
}

export interface StatusPembayaranKpi {
  totalSantri: number
  totalLunas: number
  totalBelumLunas: number
  totalTunggakanNominal: number
}

export interface UserFinancePermissions {
  canView: boolean
  canRecordPayment: boolean
  role: string
}

export interface StatusPembayaranQueryParams {
  period?: string
  asrama?: string
  status?: 'ALL' | 'LUNAS' | 'CICILAN' | 'BELUM_LUNAS' | 'BEBAS'
  search?: string
  page?: number
  pageSize?: number
}

export interface StatusPembayaranResponse {
  items: EnrichedStudentObligationMatrixItem[]
  kpi: StatusPembayaranKpi
  pagination: {
    currentPage: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  isPreCutoverPeriod: boolean
  selectedPeriod: string
  userPermissions: UserFinancePermissions
}

export interface FilterOptionsResponse {
  asramaList: string[]
  periodList: Array<{
    value: string
    label: string
    isPreCutover: boolean
  }>
  currentPeriod: string
  userPermissions: UserFinancePermissions
}

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Format string YYYY-MM ke format label Indonesia "Bulan YYYY"
 */
function formatPeriodLabel(period: string): string {
  const parts = period.split('-')
  if (parts.length !== 2) return period
  const year = parseInt(parts[0], 10)
  const monthIdx = parseInt(parts[1], 10) - 1
  const monthName = BULAN_NAMES[monthIdx] ?? `Bulan ${parts[1]}`
  return `${monthName} ${year}`
}

/**
 * Helper untuk mendapatkan periode default (bulan berjalan)
 */
function getDefaultPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Audit & Otorisasi Server Action:
 * - Memverifikasi session dan role/feature access di server sebelum query dijalankan.
 * - Memastikan role view-only (seperti pimpinan atau tester) TIDAK memperoleh izin mutasi (canRecordPayment = false).
 */
export async function authorizeUser(): Promise<{
  userId: string
  roles: string[]
  permissions: UserFinancePermissions
}> {
  const session = await getSession()
  if (!session) {
    throw new Error('Sesi telah berakhir. Silakan masuk kembali.')
  }

  const roles = getEffectiveRoles(session)
  if (roles.length === 0) {
    throw new Error('Akses ditolak: Pengguna tidak memiliki role yang valid.')
  }

  // 1. canAccessFeatureForSession adalah authority utama untuk verifikasi akses fitur.
  // Tidak menggunakan permissive fallback yang dapat mengubah hasil false menjadi true.
  const hasAccess = await canAccessFeatureForSession(session, '/dashboard/keuangan/status-pembayaran')
  if (!hasAccess) {
    throw new Error('Akses ditolak: Anda tidak memiliki hak akses untuk membuka data Status Pembayaran.')
  }

  // 2. Proteksi ketat mutation: Pimpinan dan Tester SELALU view-only
  const isViewOnly = roles.includes('pimpinan') || roles.includes('tester')
  const canMutate = !isViewOnly && (roles.includes('admin') || roles.includes('bendahara'))

  const permissions: UserFinancePermissions = {
    canView: true,
    canRecordPayment: canMutate,
    role: roles[0] || 'guest',
  }

  return {
    userId: session.id,
    roles,
    permissions,
  }
}

/**
 * Mengambil histori tunggakan SPP legacy (periode sebelum cutover 2026-07)
 * langsung dari tabel resmi D1 `spp_tunggakan_historis` (status = 'BELUM_LUNAS' dan tahun*100+bulan < 202607)
 * tanpa menduplikasi baris di finance_obligations.
 */
async function fetchLegacySppArrears(santriIds: string[]): Promise<Map<string, { total: number; count: number }>> {
  const map = new Map<string, { total: number; count: number }>()
  if (santriIds.length === 0) return map

  const placeholders = santriIds.map(() => '?').join(',')

  try {
    const rows = await query<{ santri_id: string; nominal_tagihan: number }>(
      `SELECT santri_id, nominal_tagihan
       FROM spp_tunggakan_historis
       WHERE santri_id IN (${placeholders})
         AND status = 'BELUM_LUNAS'
         AND (tahun * 100 + bulan) < 202607`,
      santriIds
    )

    for (const r of rows) {
      const prev = map.get(r.santri_id) ?? { total: 0, count: 0 }
      map.set(r.santri_id, {
        total: prev.total + (r.nominal_tagihan ?? 0),
        count: prev.count + 1,
      })
    }
  } catch (err: unknown) {
    console.error('[status-pembayaran] Gagal membaca spp_tunggakan_historis:', err instanceof Error ? err.message : err)
  }

  return map
}

/**
 * Mengambil data matriks status pembayaran utama beserta agregasi 4 KPI cards
 * dan integrasi coexistence legacy tunggakan pra-cutover.
 */
export async function getStatusPembayaranData(
  params?: StatusPembayaranQueryParams
): Promise<StatusPembayaranResponse> {
  const { permissions } = await authorizeUser()

  const selectedPeriod = params?.period?.trim() || getDefaultPeriod()
  const isPreCutoverPeriod = selectedPeriod < FINANCE_CUTOVER_START_MONTHLY
  const asramaFilter = params?.asrama?.trim() || undefined
  const searchFilter = params?.search?.trim() || undefined
  const statusFilter = params?.status && params.status !== 'ALL' ? params.status : undefined
  const page = Math.max(1, params?.page ?? 1)
  const pageSize = params?.pageSize !== undefined ? params.pageSize : 20

  // 1. Ambil matriks kewajiban dari finance engine
  const rawMatrix = await getStudentsObligationMatrix(selectedPeriod, {
    asrama: asramaFilter,
    search: searchFilter,
  })

  // 2. Ambil tunggakan legacy pra-cutover untuk santri yang terlibat
  const santriIds = rawMatrix.map(item => item.santriId)
  const legacyArrearsMap = await fetchLegacySppArrears(santriIds)

  // 3. Lakukan enrichment data untuk coexistence (tanpa insert ke finance_obligations)
  const enrichedList: EnrichedStudentObligationMatrixItem[] = rawMatrix.map(item => {
    const legacyInfo = legacyArrearsMap.get(item.santriId) ?? { total: 0, count: 0 }
    const legacyTunggakanSpp = legacyInfo.total
    const hasLegacyTunggakan = legacyTunggakanSpp > 0
    const adjustedTotalRemaining = item.totalRemaining + legacyTunggakanSpp

    return {
      ...item,
      legacyTunggakanSpp,
      hasLegacyTunggakan,
      legacyTunggakanCount: legacyInfo.count,
      adjustedTotalRemaining,
      isPreCutoverPeriod,
    }
  })

  // 4. Hitung agregasi 4 Summary KPI Cards dari SELURUH dataset terfilter (sebelum pemotongan paginasi)
  const totalSantri = enrichedList.length
  let totalLunas = 0
  let totalBelumLunas = 0
  let totalTunggakanNominal = 0

  for (const item of enrichedList) {
    const isFullySettled = (item.overallStatus === 'LUNAS' || item.overallStatus === 'BEBAS') && !item.hasLegacyTunggakan
    if (isFullySettled) {
      totalLunas += 1
    } else {
      totalBelumLunas += 1
    }
    totalTunggakanNominal += item.adjustedTotalRemaining
  }

  const kpi: StatusPembayaranKpi = {
    totalSantri,
    totalLunas,
    totalBelumLunas,
    totalTunggakanNominal,
  }

  // 5. Filter status jika diminta (LUNAS, CICILAN, BELUM_LUNAS, BEBAS)
  let filteredList = enrichedList
  if (statusFilter) {
    filteredList = enrichedList.filter(item => {
      if (statusFilter === 'LUNAS') {
        return item.overallStatus === 'LUNAS' && !item.hasLegacyTunggakan
      }
      if (statusFilter === 'BELUM_LUNAS') {
        return item.overallStatus === 'BELUM_LUNAS' || item.hasLegacyTunggakan
      }
      return item.overallStatus === statusFilter
    })
  }

  // 6. Paginasi aman: dihitung dari total filtered list
  const totalItems = filteredList.length
  const effectiveSize = pageSize === 0 ? totalItems : pageSize
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalItems / effectiveSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = pageSize === 0 ? 0 : (safePage - 1) * effectiveSize
  const paginatedItems = pageSize === 0 ? filteredList : filteredList.slice(startIndex, startIndex + effectiveSize)

  return {
    items: paginatedItems,
    kpi,
    pagination: {
      currentPage: safePage,
      pageSize,
      totalItems,
      totalPages,
    },
    isPreCutoverPeriod,
    selectedPeriod,
    userPermissions: permissions,
  }
}

/**
 * Mengambil opsi filter untuk dropdown (daftar asrama dan daftar periode yang valid)
 */
export async function getStatusPembayaranFilterOptions(): Promise<FilterOptionsResponse> {
  const { permissions } = await authorizeUser()

  // 1. Ambil daftar asrama aktif
  let asramaList: string[] = []
  try {
    const rows = await query<{ asrama: string }>(
      `SELECT DISTINCT asrama
       FROM santri
       WHERE status_global = 'aktif' AND asrama IS NOT NULL AND TRIM(asrama) != ''
       ORDER BY asrama ASC`
    )
    asramaList = rows.map(r => r.asrama)
  } catch {
    asramaList = []
  }

  // 2. Susun daftar periode (12 bulan ke belakang hingga 3 bulan ke depan dari saat ini)
  const periodList: FilterOptionsResponse['periodList'] = []
  const currentPeriod = getDefaultPeriod()

  const [currYear, currMonth] = currentPeriod.split('-').map(Number)
  const baseDate = new Date(currYear, currMonth - 1, 1)

  for (let offset = 6; offset >= -12; offset--) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const val = `${y}-${m}`
    const isPreCutover = val < FINANCE_CUTOVER_START_MONTHLY

    periodList.push({
      value: val,
      label: `${formatPeriodLabel(val)}${isPreCutover ? ' (Pra-Cutover)' : ''}`,
      isPreCutover,
    })
  }

  return {
    asramaList,
    periodList,
    currentPeriod,
    userPermissions: permissions,
  }
}
