'use server'

import { query, queryOne, execute } from '@/lib/db'
import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import { getStudentsObligationMatrix } from '@/lib/finance/matrix'
import { FINANCE_CUTOVER_START_MONTHLY } from '@/lib/finance/legacy'
import { FINANCE_ITEM_LABELS, type FinanceObligationStatus, type StudentObligationMatrixItem, type FinanceItemType } from '@/lib/finance/types'
import { createPaymentOrder } from '@/lib/finance/orders'
import { recordOrderPayment } from '@/lib/finance/payments'
import {
  getActiveCashSession,
  openCashSession,
  recordCashInToSession,
} from '@/lib/finance/cash-session'

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

// ─── TIPE DATA FASE 4B: DETAIL & DRILLDOWN SANTRI ────────────────────────────

export interface StudentIdentityDetail {
  id: string
  nis: string
  namaLengkap: string
  jenisKelamin: string
  asrama: string | null
  kamar: string | null
  statusGlobal: string
  tahunMasuk: number | null
  tanggalMasuk: string | null
  tempatMakan: string | null
  tempatMencuci: string | null
}

export interface ObligationBreakdownItem {
  id: string
  itemType: string
  itemLabel: string
  period: string
  periodLabel: string
  amountExpected: number
  amountExempted: number
  amountPaid: number
  remaining: number
  status: FinanceObligationStatus
  providerName: string | null
  createdAt: string
  updatedAt: string
}

export interface LegacyArrearDetailItem {
  id: string
  tahun: number
  bulan: number
  monthLabel: string
  nominalTagihan: number
  status: string
}

export interface PaymentHistoryAllocationItem {
  id: string
  itemType: string
  itemLabel: string
  amount: number
}

export interface PaymentHistoryItem {
  id: string
  paymentNumber: string
  channel: string
  method: string
  grossAmount: number
  allocatedAmount: number
  unallocatedAmount: number
  allocationStatus: 'ALLOCATED' | 'PARTIALLY_ALLOCATED' | 'UNALLOCATED'
  allocationStatusLabel: string
  status: string
  paidAt: string
  externalReference: string | null
  allocations: PaymentHistoryAllocationItem[]
}

export interface UsppInstallmentHistoryItem {
  id: string
  paymentId: string
  paymentNumber: string
  channel: string
  method: string
  amount: number
  paidAt: string
  externalReference: string | null
}

export interface StudentPaymentDetailResponse {
  santri: StudentIdentityDetail
  summary: {
    totalTagihan: number
    totalDibayar: number
    totalPotongan: number
    totalSisaModern: number
    totalLegacyTunggakan: number
    grandTotalTunggakan: number
  }
  drilldown: {
    bulanan: ObligationBreakdownItem[]
    tahunan: ObligationBreakdownItem[]
    uspp: ObligationBreakdownItem | null
    usppInstallments: UsppInstallmentHistoryItem[]
    tunggakanModern: ObligationBreakdownItem[]
    tunggakanLegacy: LegacyArrearDetailItem[]
    riwayatBayar: PaymentHistoryItem[]
  }
  userPermissions: UserFinancePermissions
}

// ─── TIPE DATA FASE 4C: CATAT PEMBAYARAN TUNAI ─────────────────────────────

export interface PayableObligationItem {
  id: string
  itemType: string
  itemLabel: string
  period: string
  periodLabel: string
  amountExpected: number
  amountExempted: number
  amountPaid: number
  remaining: number
  installmentRule: 'ALLOWED' | 'DISALLOWED'
  providerName: string | null
}

export interface StudentSearchResultItem {
  id: string
  nis: string
  namaLengkap: string
  asrama: string | null
  kamar: string | null
  unpaidCount: number
  totalUnpaidAmount: number
}

export interface RecordCashPaymentItemInput {
  obligationId: string
  amount: number
}

export interface RecordCashPaymentInput {
  santriId: string
  items: RecordCashPaymentItemInput[]
  idempotencyKey: string
  notes?: string
}

export interface RecordCashPaymentResult {
  success: boolean
  paymentId: string
  paymentNumber: string
  orderNumber: string
  grossAmount: number
  paidAt: string
  cashSessionId?: string | null
  sessionCode?: string | null
  santri: {
    id: string
    nis: string
    namaLengkap: string
    asrama: string | null
    kamar: string | null
  }
  receivedByName: string
  allocations: Array<{
    id: string
    itemType: string
    itemLabel: string
    amount: number
  }>
}

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Format string YYYY-MM ke format label Indonesia "Bulan YYYY"
 */
function formatPeriodLabel(period: string): string {
  if (period === 'LIFETIME') return 'Sepanjang Pendidikan'
  const parts = period.split('-')
  if (parts.length === 1) return `Tahun ${period}`
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

  const CHUNK_SIZE = 60
  for (let i = 0; i < santriIds.length; i += CHUNK_SIZE) {
    const chunk = santriIds.slice(i, i + CHUNK_SIZE)
    const placeholders = chunk.map(() => '?').join(',')

    try {
      const rows = await query<{ santri_id: string; nominal_tagihan: number }>(
        `SELECT santri_id, nominal_tagihan
         FROM spp_tunggakan_historis
         WHERE santri_id IN (${placeholders})
           AND status = 'BELUM_LUNAS'
           AND (tahun * 100 + bulan) < 202607`,
        chunk
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
  const pageSize = params?.pageSize !== undefined ? params.pageSize : 50

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

// ─── SERVER ACTION FASE 4B: DETAIL & DRILLDOWN SANTRI ─────────────────────────

interface RawObligationDetailRow {
  id: string
  item_type: string
  period: string
  amount_expected: number
  amount_exempted: number
  amount_paid: number
  status: string
  provider_id: string | null
  provider_name: string | null
  created_at: string
  updated_at: string
}

/**
 * Mengambil rincian detail kewajiban finansial santri, drilldown per kategori
 * (Bulanan, Tahunan, USPP, Tunggakan), coexistence tunggakan pra-cutover,
 * dan histori pembayaran nyata (read-only).
 */
export async function getStudentPaymentDetail(
  santriId: string
): Promise<StudentPaymentDetailResponse> {
  const { permissions } = await authorizeUser()

  if (!santriId || typeof santriId !== 'string') {
    throw new Error('ID santri tidak valid.')
  }

  // 1. Ambil profil santri
  const santriRow = await queryOne<{
    id: string
    nis: string
    nama_lengkap: string
    jenis_kelamin: string
    status_global: string
    asrama: string | null
    kamar: string | null
    tahun_masuk: number | null
    tanggal_masuk: string | null
    tempat_makan: string | null
    tempat_mencuci: string | null
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.status_global, s.asrama, s.kamar,
            s.tahun_masuk, s.tanggal_masuk,
            m1.nama_jasa AS tempat_makan, m2.nama_jasa AS tempat_mencuci
     FROM santri s
     LEFT JOIN master_jasa m1 ON s.tempat_makan_id = m1.id
     LEFT JOIN master_jasa m2 ON s.tempat_mencuci_id = m2.id
     WHERE s.id = ?`,
    [santriId]
  )

  if (!santriRow) {
    throw new Error('Data santri tidak ditemukan.')
  }

  const santri: StudentIdentityDetail = {
    id: santriRow.id,
    nis: santriRow.nis,
    namaLengkap: santriRow.nama_lengkap,
    jenisKelamin: santriRow.jenis_kelamin,
    statusGlobal: santriRow.status_global,
    asrama: santriRow.asrama,
    kamar: santriRow.kamar,
    tahunMasuk: santriRow.tahun_masuk,
    tanggalMasuk: santriRow.tanggal_masuk,
    tempatMakan: santriRow.tempat_makan,
    tempatMencuci: santriRow.tempat_mencuci,
  }

  // 2. Ambil seluruh kewajiban santri dari finance_obligations
  const obligationRows = await query<RawObligationDetailRow>(
    `SELECT o.id, o.item_type, o.period, o.amount_expected, o.amount_exempted, o.amount_paid,
            o.status, o.provider_id, o.created_at, o.updated_at,
            m.nama_jasa AS provider_name
     FROM finance_obligations o
     LEFT JOIN master_jasa m ON o.provider_id = m.id
     WHERE o.santri_id = ?
     ORDER BY o.period DESC, o.item_type ASC`,
    [santriId]
  )

  const mapObligation = (r: RawObligationDetailRow): ObligationBreakdownItem => {
    const expected = r.amount_expected ?? 0
    const exempted = r.amount_exempted ?? 0
    const paid = r.amount_paid ?? 0
    const remaining = Math.max(0, expected - exempted - paid)
    const label = FINANCE_ITEM_LABELS[r.item_type as keyof typeof FINANCE_ITEM_LABELS] || r.item_type

    return {
      id: r.id,
      itemType: r.item_type,
      itemLabel: label,
      period: r.period,
      periodLabel: formatPeriodLabel(r.period),
      amountExpected: expected,
      amountExempted: exempted,
      amountPaid: paid,
      remaining,
      status: (r.status || 'UNPAID') as FinanceObligationStatus,
      providerName: r.provider_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  const allObligations = obligationRows.map(mapObligation)

  const bulanan = allObligations.filter(o => ['SPP', 'UANG_MAKAN', 'UANG_NYUCI'].includes(o.itemType))
  const tahunan = allObligations.filter(o => ['EHB', 'EKSKUL', 'KESEHATAN'].includes(o.itemType))
  const usppItem = allObligations.find(o => o.itemType === 'USPP') ?? null
  const tunggakanModern = allObligations.filter(o => o.status !== 'PAID' && o.status !== 'EXEMPTED' && o.remaining > 0)

  // 3. Ambil tunggakan legacy pra-cutover dari spp_tunggakan_historis (< 2026-07)
  let tunggakanLegacy: LegacyArrearDetailItem[] = []
  try {
    const legRows = await query<{
      id: string
      tahun: number
      bulan: number
      nominal_tagihan: number
      status: string
    }>(
      `SELECT id, tahun, bulan, nominal_tagihan, status
       FROM spp_tunggakan_historis
       WHERE santri_id = ? AND status = 'BELUM_LUNAS' AND (tahun * 100 + bulan) < 202607
       ORDER BY tahun ASC, bulan ASC`,
      [santriId]
    )

    tunggakanLegacy = legRows.map(r => ({
      id: r.id,
      tahun: r.tahun,
      bulan: r.bulan,
      monthLabel: `${BULAN_NAMES[r.bulan - 1] ?? `Bulan ${r.bulan}`} ${r.tahun}`,
      nominalTagihan: r.nominal_tagihan ?? 0,
      status: r.status,
    }))
  } catch (err: unknown) {
    console.error('[detail-drawer] Gagal membaca spp_tunggakan_historis:', err instanceof Error ? err.message : err)
  }

  // 4. Ambil histori cicilan khusus USPP (read-only)
  let usppInstallments: UsppInstallmentHistoryItem[] = []
  try {
    const usppAllocRows = await query<{
      id: string
      payment_id: string
      payment_number: string
      channel: string
      method: string
      amount: number
      paid_at: string
      external_reference: string | null
    }>(
      `SELECT a.id, a.payment_id, a.amount,
              p.payment_number, p.channel, p.method, p.paid_at, p.external_reference
       FROM finance_allocations a
       JOIN finance_payments p ON a.payment_id = p.id
       WHERE p.santri_id = ? AND a.item_type = 'USPP'
       ORDER BY p.paid_at DESC`,
      [santriId]
    )

    usppInstallments = usppAllocRows.map(r => ({
      id: r.id,
      paymentId: r.payment_id,
      paymentNumber: r.payment_number,
      channel: r.channel,
      method: r.method,
      amount: r.amount ?? 0,
      paidAt: r.paid_at,
      externalReference: r.external_reference,
    }))
  } catch (err: unknown) {
    console.error('[detail-drawer] Gagal membaca histori cicilan USPP:', err instanceof Error ? err.message : err)
  }

  // 5. Ambil histori pembayaran nyata secara PAYMENT-DRIVEN (read-only)
  let riwayatBayar: PaymentHistoryItem[] = []
  try {
    const paymentRows = await query<{
      id: string
      payment_number: string
      channel: string
      method: string
      gross_amount: number
      gateway_fee: number
      net_amount: number
      status: string
      allocation_status: string
      paid_at: string
      external_reference: string | null
    }>(
      `SELECT id, payment_number, channel, method, gross_amount, gateway_fee, net_amount,
              status, allocation_status, paid_at, external_reference
       FROM finance_payments
       WHERE santri_id = ?
       ORDER BY paid_at DESC
       LIMIT 50`,
      [santriId]
    )

    if (paymentRows.length > 0) {
      const paymentIds = paymentRows.map(p => p.id)
      const placeholders = paymentIds.map(() => '?').join(',')

      const allocationRows = await query<{
        id: string
        payment_id: string
        item_type: string
        amount: number
      }>(
        `SELECT id, payment_id, item_type, amount
         FROM finance_allocations
         WHERE payment_id IN (${placeholders})
         ORDER BY id ASC`,
        paymentIds
      )

      const allocMap = new Map<string, PaymentHistoryAllocationItem[]>()
      for (const a of allocationRows) {
        const list = allocMap.get(a.payment_id) || []
        list.push({
          id: a.id,
          itemType: a.item_type,
          itemLabel: FINANCE_ITEM_LABELS[a.item_type as keyof typeof FINANCE_ITEM_LABELS] || a.item_type,
          amount: a.amount ?? 0,
        })
        allocMap.set(a.payment_id, list)
      }

      riwayatBayar = paymentRows.map(p => {
        const allocs = allocMap.get(p.id) || []
        const allocatedAmount = allocs.reduce((sum, it) => sum + it.amount, 0)
        const grossAmount = p.gross_amount ?? 0
        const isUnallocated = p.allocation_status === 'UNALLOCATED' || (allocs.length === 0 && grossAmount > 0)
        const unallocatedAmount = isUnallocated
          ? grossAmount
          : Math.max(0, grossAmount - allocatedAmount)

        let statusLabel = 'Teralokasi Penuh'
        if (p.allocation_status === 'UNALLOCATED' || isUnallocated) {
          statusLabel = 'Perlu Rekonsiliasi'
        } else if (p.allocation_status === 'PARTIALLY_ALLOCATED' || unallocatedAmount > 0) {
          statusLabel = 'Teralokasi Sebagian'
        }

        return {
          id: p.id,
          paymentNumber: p.payment_number,
          channel: p.channel,
          method: p.method,
          grossAmount,
          allocatedAmount: isUnallocated ? 0 : allocatedAmount,
          unallocatedAmount,
          allocationStatus: (p.allocation_status || 'ALLOCATED') as 'ALLOCATED' | 'PARTIALLY_ALLOCATED' | 'UNALLOCATED',
          allocationStatusLabel: statusLabel,
          status: p.status,
          paidAt: p.paid_at,
          externalReference: p.external_reference,
          allocations: isUnallocated ? [] : allocs,
        }
      })
    }
  } catch (err: unknown) {
    console.error('[detail-drawer] Gagal membaca riwayat pembayaran:', err instanceof Error ? err.message : err)
  }

  // 6. Hitung ringkasan total
  const totalTagihan = allObligations.reduce((acc, o) => acc + o.amountExpected, 0)
  const totalDibayar = allObligations.reduce((acc, o) => acc + o.amountPaid, 0)
  const totalPotongan = allObligations.reduce((acc, o) => acc + o.amountExempted, 0)
  const totalSisaModern = allObligations.reduce((acc, o) => acc + o.remaining, 0)
  const totalLegacyTunggakan = tunggakanLegacy.reduce((acc, l) => acc + l.nominalTagihan, 0)
  const grandTotalTunggakan = totalSisaModern + totalLegacyTunggakan

  return {
    santri,
    summary: {
      totalTagihan,
      totalDibayar,
      totalPotongan,
      totalSisaModern,
      totalLegacyTunggakan,
      grandTotalTunggakan,
    },
    drilldown: {
      bulanan,
      tahunan,
      uspp: usppItem,
      usppInstallments,
      tunggakanModern,
      tunggakanLegacy,
      riwayatBayar,
    },
    userPermissions: permissions,
  }
}

// ─── SERVER ACTIONS FASE 4C: CATAT PEMBAYARAN TUNAI ─────────────────────────

/**
 * Mencari santri aktif berdasarkan nama atau NIS untuk form penerimaan pembayaran tunai.
 */
export async function searchStudentsForPayment(
  queryStr: string
): Promise<StudentSearchResultItem[]> {
  const { permissions } = await authorizeUser()
  if (!permissions.canRecordPayment) {
    throw new Error('Akses ditolak: Anda tidak memiliki wewenang untuk mencatat pembayaran tunai.')
  }

  const q = queryStr.trim()
  if (q.length < 2) return []

  const rows = await query<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
  }>(
    `SELECT id, nis, nama_lengkap, asrama, kamar
     FROM santri
     WHERE status_global = 'aktif'
       AND (nama_lengkap LIKE ? OR nis LIKE ?)
     ORDER BY nama_lengkap ASC
     LIMIT 10`,
    [`%${q}%`, `%${q}%`]
  )

  const results: StudentSearchResultItem[] = []
  for (const r of rows) {
    const obSummary = await queryOne<{ count: number; total: number }>(
      `SELECT COUNT(id) as count,
              SUM(amount_expected - amount_exempted - amount_paid) as total
       FROM finance_obligations
       WHERE santri_id = ? AND status NOT IN ('PAID', 'EXEMPTED')`,
      [r.id]
    )
    results.push({
      id: r.id,
      nis: r.nis,
      namaLengkap: r.nama_lengkap,
      asrama: r.asrama,
      kamar: r.kamar,
      unpaidCount: obSummary?.count ?? 0,
      totalUnpaidAmount: Math.max(0, obSummary?.total ?? 0),
    })
  }

  return results
}

/**
 * Mengambil seluruh kewajiban santri yang belum lunas beserta aturan cicilan (ALLOWED vs DISALLOWED).
 */
export async function getUnpaidObligationsForCashPayment(
  santriId: string
): Promise<{
  santri: StudentIdentityDetail
  obligations: PayableObligationItem[]
}> {
  const { permissions } = await authorizeUser()
  if (!permissions.canRecordPayment) {
    throw new Error('Akses ditolak: Anda tidak memiliki wewenang untuk mencatat pembayaran tunai.')
  }

  if (!santriId || typeof santriId !== 'string') {
    throw new Error('ID santri tidak valid.')
  }

  const santriRow = await queryOne<{
    id: string
    nis: string
    nama_lengkap: string
    jenis_kelamin: string
    status_global: string
    asrama: string | null
    kamar: string | null
    tahun_masuk: number | null
    tanggal_masuk: string | null
    tempat_makan: string | null
    tempat_mencuci: string | null
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.status_global, s.asrama, s.kamar,
            s.tahun_masuk, s.tanggal_masuk,
            m1.nama_jasa AS tempat_makan, m2.nama_jasa AS tempat_mencuci
     FROM santri s
     LEFT JOIN master_jasa m1 ON s.tempat_makan_id = m1.id
     LEFT JOIN master_jasa m2 ON s.tempat_mencuci_id = m2.id
     WHERE s.id = ?`,
    [santriId]
  )

  if (!santriRow) {
    throw new Error('Data santri tidak ditemukan.')
  }
  if (santriRow.status_global !== 'aktif') {
    throw new Error(`Santri berstatus "${santriRow.status_global}", tidak dapat menerima pembayaran.`)
  }

  const rows = await query<{
    id: string
    item_type: string
    period: string
    amount_expected: number
    amount_exempted: number
    amount_paid: number
    status: string
    installment_rule: string | null
    provider_name: string | null
  }>(
    `SELECT o.id, o.item_type, o.period, o.amount_expected, o.amount_exempted, o.amount_paid,
            o.status, t.installment_rule, m.nama_jasa as provider_name
     FROM finance_obligations o
     LEFT JOIN finance_tariffs t ON o.tariff_id = t.id
     LEFT JOIN master_jasa m ON o.provider_id = m.id
     WHERE o.santri_id = ? AND o.status NOT IN ('PAID', 'EXEMPTED')
     ORDER BY o.period ASC, o.item_type ASC`,
    [santriId]
  )

  const obligations: PayableObligationItem[] = []
  for (const r of rows) {
    const expected = r.amount_expected ?? 0
    const exempted = r.amount_exempted ?? 0
    const paid = r.amount_paid ?? 0
    const remaining = Math.max(0, expected - exempted - paid)
    if (remaining <= 0) continue

    const rule = r.item_type === 'USPP'
      ? 'ALLOWED'
      : r.item_type === 'SPP'
      ? 'DISALLOWED'
      : ((r.installment_rule as 'ALLOWED' | 'DISALLOWED') || 'DISALLOWED')

    obligations.push({
      id: r.id,
      itemType: r.item_type,
      itemLabel: FINANCE_ITEM_LABELS[r.item_type as keyof typeof FINANCE_ITEM_LABELS] || r.item_type,
      period: r.period,
      periodLabel: formatPeriodLabel(r.period),
      amountExpected: expected,
      amountExempted: exempted,
      amountPaid: paid,
      remaining,
      installmentRule: rule,
      providerName: r.provider_name,
    })
  }

  return {
    santri: {
      id: santriRow.id,
      nis: santriRow.nis,
      namaLengkap: santriRow.nama_lengkap,
      jenisKelamin: santriRow.jenis_kelamin,
      statusGlobal: santriRow.status_global,
      asrama: santriRow.asrama,
      kamar: santriRow.kamar,
      tahunMasuk: santriRow.tahun_masuk,
      tanggalMasuk: santriRow.tanggal_masuk,
      tempatMakan: santriRow.tempat_makan,
      tempatMencuci: santriRow.tempat_mencuci,
    },
    obligations,
  }
}

// In-flight concurrency lock untuk mencegah duplicate execution pada request paralel di Node process yang sama
const inFlightCashPayments = new Map<string, Promise<RecordCashPaymentResult>>()

/**
 * Format respon bukti pembayaran tunai secara seragam dan lengkap.
 */
async function formatPaymentResult(paymentId: string): Promise<RecordCashPaymentResult> {
  const payment = await queryOne<{
    id: string
    payment_number: string
    order_id: string
    santri_id: string
    gross_amount: number
    cash_session_id: string | null
    received_by: string | null
    paid_at: string
  }>(
    `SELECT id, payment_number, order_id, santri_id, gross_amount, cash_session_id, received_by, paid_at
     FROM finance_payments
     WHERE id = ?`,
    [paymentId]
  )
  if (!payment) {
    throw new Error('Data transaksi pembayaran tidak ditemukan.')
  }

  const existingOrder = await queryOne<{ order_number: string }>(
    `SELECT order_number FROM finance_payment_orders WHERE id = ?`,
    [payment.order_id]
  )
  const existingAllocs = await query<{
    id: string
    item_type: string
    amount: number
  }>(
    `SELECT id, item_type, amount
     FROM finance_allocations
     WHERE payment_id = ?`,
    [payment.id]
  )
  const student = await queryOne<{ nis: string; nama_lengkap: string; asrama: string | null; kamar: string | null }>(
    `SELECT nis, nama_lengkap, asrama, kamar FROM santri WHERE id = ?`,
    [payment.santri_id]
  )

  let sessionCode: string | null = null
  if (payment.cash_session_id) {
    const session = await queryOne<{ session_code: string }>(
      `SELECT session_code FROM finance_cash_sessions WHERE id = ?`,
      [payment.cash_session_id]
    )
    sessionCode = session?.session_code || null
  }

  let receivedByName = 'Bendahara / Kasir'
  if (payment.received_by) {
    const receiver = await queryOne<{ full_name: string; email: string }>(
      `SELECT full_name, email FROM users WHERE id = ?`,
      [payment.received_by]
    )
    receivedByName = receiver?.full_name || receiver?.email || receivedByName
  }

  return {
    success: true,
    paymentId: payment.id,
    paymentNumber: payment.payment_number,
    orderNumber: existingOrder?.order_number || '',
    grossAmount: payment.gross_amount,
    paidAt: payment.paid_at,
    cashSessionId: payment.cash_session_id,
    sessionCode,
    santri: {
      id: payment.santri_id,
      nis: student?.nis || '',
      namaLengkap: student?.nama_lengkap || '',
      asrama: student?.asrama || null,
      kamar: student?.kamar || null,
    },
    receivedByName,
    allocations: existingAllocs.map(a => ({
      id: a.id,
      itemType: a.item_type,
      itemLabel: FINANCE_ITEM_LABELS[a.item_type as keyof typeof FINANCE_ITEM_LABELS] || a.item_type,
      amount: a.amount,
    })),
  }
}

/**
 * Mengambil status sesi kas aktif milik operator yang sedang login.
 */
export async function getCurrentCashSessionInfo(): Promise<{
  id: string
  sessionCode: string
  openingBalance: number
  totalCashIn: number
  expectedClosingBalance: number
} | null> {
  const { userId, permissions } = await authorizeUser()
  if (!permissions.canRecordPayment) {
    return null
  }
  const session = await getActiveCashSession(userId)
  if (!session) return null
  return {
    id: session.id,
    sessionCode: session.session_code,
    openingBalance: session.opening_balance,
    totalCashIn: session.total_cash_in,
    expectedClosingBalance: session.expected_closing_balance,
  }
}

/**
 * Membuka sesi kas baru dengan saldo kas fisik awal (opening balance) yang diinput operator.
 */
export async function openCashSessionAction(
  openingBalance: number,
  notes?: string
): Promise<{
  id: string
  sessionCode: string
  openingBalance: number
  expectedClosingBalance: number
}> {
  const { userId, permissions } = await authorizeUser()
  if (!permissions.canRecordPayment) {
    throw new Error('Akses ditolak: Hanya Bendahara dan Admin yang dapat membuka sesi kas.')
  }

  const session = await openCashSession(userId, openingBalance, notes)
  return {
    id: session.id,
    sessionCode: session.session_code,
    openingBalance: session.opening_balance,
    expectedClosingBalance: session.expected_closing_balance,
  }
}

/**
 * Mencatat pembayaran tunai langsung dari Modul Status Pembayaran.
 * Mereuse penuh Payment Engine Fase 3A (orders.ts & payments.ts) secara atomik,
 * wajib terhubung ke Sesi Kas aktif (PRD #23), memvalidasi aturan cicilan,
 * dan mendukung pemulihan lifecycle idempotency bebas race condition & bebas orphan order.
 */
export async function recordCashPayment(
  input: RecordCashPaymentInput
): Promise<RecordCashPaymentResult> {
  const { userId, permissions } = await authorizeUser()
  if (!permissions.canRecordPayment) {
    throw new Error('Akses ditolak: Hanya Bendahara dan Admin yang memiliki wewenang untuk mencatat pembayaran tunai.')
  }

  if (!input.santriId || typeof input.santriId !== 'string') {
    throw new Error('ID santri wajib diisi.')
  }
  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('Pilih minimal 1 pos kewajiban yang akan dibayar.')
  }
  if (!input.idempotencyKey || typeof input.idempotencyKey !== 'string' || !input.idempotencyKey.trim()) {
    throw new Error('Token idempotency transaksi wajib disertakan.')
  }

  const externalRef = input.idempotencyKey.trim()

  // 1. In-flight Concurrency Lock: Menyatukan request konkuren paralel pada process yang sama
  const existingInFlight = inFlightCashPayments.get(externalRef)
  if (existingInFlight) {
    return existingInFlight
  }

  const executionPromise = (async (): Promise<RecordCashPaymentResult> => {
    // 2. Validasi Sesi Kas Aktif (PRD #23): Pembayaran CASH hanya boleh jika ada sesi OPEN
    const cashSession = await getActiveCashSession(userId)
    if (!cashSession) {
      throw new Error(
        'Belum ada sesi kas yang aktif. Wajib membuka sesi kas dengan memasukkan saldo kas fisik awal terlebih dahulu.'
      )
    }

    // 3. Cek apakah pembayaran tunai dengan external_reference ini sudah berstatus PAID
    const existingPayment = await queryOne<{ id: string }>(
      `SELECT id FROM finance_payments WHERE channel = 'CASH' AND external_reference = ?`,
      [externalRef]
    )
    if (existingPayment) {
      return formatPaymentResult(existingPayment.id)
    }

    // 4. Audit Lifecycle Idempotency (Recovery after partial failure)
    const existingKeyRecord = await queryOne<{
      status: string
      order_id: string | null
      payment_id: string | null
    }>(
      `SELECT status, order_id, payment_id FROM finance_idempotency_keys WHERE key = ?`,
      [externalRef]
    )

    if (existingKeyRecord?.status === 'COMPLETED' && existingKeyRecord.payment_id) {
      return formatPaymentResult(existingKeyRecord.payment_id)
    }

    let orderToUse: { id: string; order_number: string } | null = null

    // Jika order_id sudah terbentuk dari percobaan sebelumnya (misal crash sebelum payment tercatat):
    if (existingKeyRecord?.order_id) {
      const existingOrder = await queryOne<{ id: string; order_number: string; status: string }>(
        `SELECT id, order_number, status FROM finance_payment_orders WHERE id = ?`,
        [existingKeyRecord.order_id]
      )
      if (existingOrder) {
        if (existingOrder.status === 'PAID') {
          const pay = await queryOne<{ id: string }>(
            `SELECT id FROM finance_payments WHERE order_id = ?`,
            [existingOrder.id]
          )
          if (pay) {
            return formatPaymentResult(pay.id)
          }
        }
        // REUSE ORDER EXISTING: Jangan pernah membuat Payment Order kedua pada retry!
        orderToUse = { id: existingOrder.id, order_number: existingOrder.order_number }
      }
    }

    // Jika belum ada reservasi key sama sekali, lakukan INSERT awal
    if (!existingKeyRecord) {
      try {
        await execute(
          `INSERT INTO finance_idempotency_keys (key, scope, status, created_at, updated_at)
           VALUES (?, 'CASH_PAYMENT', 'PROCESSING', datetime('now'), datetime('now'))`,
          [externalRef]
        )
      } catch {
        // Konkurensi antar worker: tunggu hingga thread pemenang menyelesaikan proses
        for (let attempt = 0; attempt < 25; attempt++) {
          const checkKey = await queryOne<{ status: string; payment_id: string | null }>(
            `SELECT status, payment_id FROM finance_idempotency_keys WHERE key = ?`,
            [externalRef]
          )
          if (checkKey?.status === 'COMPLETED' && checkKey.payment_id) {
            return formatPaymentResult(checkKey.payment_id)
          }
          const pay = await queryOne<{ id: string }>(
            `SELECT id FROM finance_payments WHERE channel = 'CASH' AND external_reference = ?`,
            [externalRef]
          )
          if (pay) {
            return formatPaymentResult(pay.id)
          }
          await new Promise((r) => setTimeout(r, 100))
        }
        throw new Error('Transaksi pembayaran tunai sedang diproses secara paralel. Silakan muat ulang.')
      }
    }

    try {
      // 5. Validasi Santri Aktif
      const student = await queryOne<{ id: string; nis: string; nama_lengkap: string; status_global: string; asrama: string | null; kamar: string | null }>(
        `SELECT id, nis, nama_lengkap, status_global, asrama, kamar FROM santri WHERE id = ?`,
        [input.santriId]
      )
      if (!student) {
        throw new Error(`Santri dengan ID "${input.santriId}" tidak ditemukan.`)
      }
      if (student.status_global !== 'aktif') {
        throw new Error(`Santri berstatus "${student.status_global}", tidak dapat melakukan pembayaran.`)
      }

      // 6. Buat Payment Order HANYA jika belum ada order yang terbentuk sebelumnya
      if (!orderToUse) {
        const orderItemsPayload: Array<{ obligationId: string; itemType: FinanceItemType; amount: number }> = []

        for (const it of input.items) {
          const amt = Math.floor(it.amount)
          if (amt <= 0) {
            throw new Error(`Nominal pembayaran harus lebih besar dari Rp0.`)
          }

          const ob = await queryOne<{
            id: string
            santri_id: string
            item_type: string
            period: string
            amount_expected: number
            amount_exempted: number
            amount_paid: number
            status: string
            installment_rule: string | null
          }>(
            `SELECT o.id, o.santri_id, o.item_type, o.period, o.amount_expected, o.amount_exempted,
                    o.amount_paid, o.status, t.installment_rule
             FROM finance_obligations o
             LEFT JOIN finance_tariffs t ON o.tariff_id = t.id
             WHERE o.id = ?`,
            [it.obligationId]
          )

          if (!ob) {
            throw new Error(`Kewajiban dengan ID "${it.obligationId}" tidak ditemukan.`)
          }
          if (ob.santri_id !== input.santriId) {
            throw new Error(`Kewajiban "${ob.item_type}" bukan milik santri ${student.nama_lengkap}.`)
          }
          if (ob.status === 'PAID') {
            throw new Error(`Kewajiban "${ob.item_type}" periode ${ob.period} sudah lunas.`)
          }
          if (ob.status === 'EXEMPTED') {
            throw new Error(`Kewajiban "${ob.item_type}" periode ${ob.period} telah dibebaskan.`)
          }

          const expected = ob.amount_expected - ob.amount_exempted
          const remaining = Math.max(0, expected - ob.amount_paid)

          if (amt > remaining) {
            throw new Error(
              `Nominal Rp${amt.toLocaleString('id-ID')} melebihi sisa tagihan ${ob.item_type} (Maksimal Rp${remaining.toLocaleString('id-ID')}).`
            )
          }

          const rule = ob.item_type === 'USPP'
            ? 'ALLOWED'
            : ob.item_type === 'SPP'
            ? 'DISALLOWED'
            : ((ob.installment_rule as 'ALLOWED' | 'DISALLOWED') || 'DISALLOWED')

          if (rule === 'DISALLOWED' && amt !== remaining) {
            throw new Error(
              `Tagihan ${ob.item_type} periode ${ob.period} tidak dapat dicicil parsial. Wajib lunas penuh sebesar Rp${remaining.toLocaleString('id-ID')}.`
            )
          }

          orderItemsPayload.push({
            obligationId: ob.id,
            itemType: ob.item_type as FinanceItemType,
            amount: amt,
          })
        }

        const newOrder = await createPaymentOrder({
          santriId: input.santriId,
          payerType: 'LOKET',
          items: orderItemsPayload,
          feePayer: 'CUSTOMER',
          gatewayFee: 0,
          paymentMethod: 'CASH',
          cashSessionId: cashSession.id,
        })

        orderToUse = { id: newOrder.id, order_number: newOrder.order_number }

        // Kuncikan fakta bahwa order telah dibuat ke dalam idempotency reservation
        await execute(
          `UPDATE finance_idempotency_keys
           SET status = 'ORDER_CREATED', order_id = ?, updated_at = datetime('now')
           WHERE key = ?`,
          [orderToUse.id, externalRef]
        )
      }

      // 7. Eksekusi Pembayaran Tunai & Alokasi Atomik menggunakan orderToUse
      const payment = await recordOrderPayment({
        orderId: orderToUse.id,
        channel: 'CASH',
        method: 'CASH',
        externalReference: externalRef,
        gatewayFee: 0,
        cashSessionId: cashSession.id,
        receivedBy: userId,
      })

      // 8. Update Sesi Kas: Total Cash-in & Expected Closing Balance
      await recordCashInToSession(cashSession.id, payment.gross_amount)

      // 9. Finalisasi status idempotency menjadi COMPLETED
      await execute(
        `UPDATE finance_idempotency_keys
         SET status = 'COMPLETED', payment_id = ?, updated_at = datetime('now')
         WHERE key = ?`,
        [payment.id, externalRef]
      )

      return formatPaymentResult(payment.id)
    } catch (err) {
      // Recovery guard: JANGAN hard-delete reservation jika Payment Order sudah terlanjur dibuat!
      // Catat status ORDER_CREATED agar retry berikutnya dapat me-reuse order tanpa membuat order ganda.
      if (orderToUse?.id) {
        await execute(
          `UPDATE finance_idempotency_keys
           SET status = 'ORDER_CREATED', order_id = ?, updated_at = datetime('now')
           WHERE key = ?`,
          [orderToUse.id, externalRef]
        )
      } else {
        await execute(
          `UPDATE finance_idempotency_keys
           SET status = 'FAILED', updated_at = datetime('now')
           WHERE key = ?`,
          [externalRef]
        )
      }
      throw err
    }
  })()

  inFlightCashPayments.set(externalRef, executionPromise)

  try {
    return await executionPromise
  } finally {
    inFlightCashPayments.delete(externalRef)
  }
}
