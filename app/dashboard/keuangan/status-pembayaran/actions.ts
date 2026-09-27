'use server'

import { query, queryOne, execute } from '@/lib/db'
import {
  getSession,
  getEffectiveRoles,
  hasFinanceMutateRole,
  isDemoSandboxRequest,
} from '@/lib/auth/session'
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
import {
  assertSantriBillable,
  nonBillableSantriSqlPredicate,
  nonBillableItemSqlPredicate,
} from '@/lib/finance/non-billable-santri'

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

export interface ItemBreakdownKpi {
  itemType: string
  itemLabel: string
  targetNominal: number
  paidNominal: number
  remainingNominal: number
  totalCount: number
  lunasCount: number
}

export interface RingkasanKpi {
  totalSantri: number
  totalLunas: number
  totalBelumLunas: number
  totalTunggakanNominal: number
}

export interface BulananKpi {
  totalTagihanNominal: number
  sudahTerbayarNominal: number
  sisaTagihanNominal: number
  totalTagihanCount: number
  lunasCount: number
  itemBreakdown: ItemBreakdownKpi[]
}

export interface TahunanKpi {
  totalTagihanNominal: number
  sudahTerbayarNominal: number
  sisaTagihanNominal: number
  totalTagihanCount: number
  lunasCount: number
  bebasCount: number
  itemBreakdown: ItemBreakdownKpi[]
}

export interface UsppKpi {
  totalKomitmenNominal: number
  terkumpulNominal: number
  sisaPiutangNominal: number
  santriLunasCount: number
  santriMencicilCount: number
  santriBelumBayarCount: number
}

export interface TunggakanItemBreakdownKpi {
  itemType: string
  itemLabel: string
  nominalTunggakan: number
  countTagihan: number
  targetNominal: number
}

export interface TunggakanKpi {
  totalTunggakanNominal: number
  totalTagihanMenunggak: number
  totalSantriMenunggak: number
  tunggakanTertuaLabel: string
  itemBreakdown: TunggakanItemBreakdownKpi[]
}

export interface TabKpiContainer {
  ringkasan?: RingkasanKpi
  bulanan?: BulananKpi
  tahunan?: TahunanKpi
  uspp?: UsppKpi
  tunggakan?: TunggakanKpi
}

export interface UserFinancePermissions {
  canView: boolean
  canRecordPayment: boolean
  role: string
}

export type TabType = 'RINGKASAN' | 'BULANAN' | 'TAHUNAN' | 'USPP' | 'TUNGGAKAN'

export interface RingkasanItemStatus {
  status: FinanceObligationStatus | 'NOT_MATERIALIZED' | 'TUNGGAKAN'
  label: string
  amountExpected: number
  amountPaid: number
  amountExempted: number
  remaining: number
}

export interface RingkasanRowItem {
  santriId: string
  nis: string
  namaLengkap: string
  fotoUrl: string | null
  asrama: string | null
  kamar: string | null
  kelasSekolah: string | null
  spp: RingkasanItemStatus
  uangMakan: RingkasanItemStatus
  uangNyuci: RingkasanItemStatus
  ehb: RingkasanItemStatus
  kesehatan: RingkasanItemStatus
  ekskul: RingkasanItemStatus
  uspp: RingkasanItemStatus
  totalRemaining: number
  overallStatus: 'LUNAS' | 'CICILAN' | 'BELUM_LUNAS' | 'BEBAS'
  hasLegacyTunggakan: boolean
  legacyTunggakanSpp: number
}

export interface BulananRowItem {
  obligationId: string
  santriId: string
  nis: string
  namaLengkap: string
  fotoUrl: string | null
  asrama: string | null
  kamar: string | null
  kelasSekolah: string | null
  itemType: 'SPP' | 'UANG_MAKAN' | 'UANG_NYUCI'
  itemLabel: string
  period: string
  periodLabel: string
  amountExpected: number
  amountPaid: number
  amountExempted: number
  remaining: number
  status: FinanceObligationStatus
  statusLabel: string
  lastPaymentAt: string | null
  lastPaymentMethod: string | null
  providerName: string | null
}

export interface TahunanRowItem {
  obligationId: string
  santriId: string
  nis: string
  namaLengkap: string
  fotoUrl: string | null
  asrama: string | null
  kamar: string | null
  kelasSekolah: string | null
  itemType: 'EHB' | 'KESEHATAN' | 'EKSKUL'
  itemLabel: string
  academicYear: string
  academicYearLabel: string
  amountExpected: number
  amountPaid: number
  amountExempted: number
  remaining: number
  status: FinanceObligationStatus
  statusLabel: string
  lastPaymentAt: string | null
  lastPaymentMethod: string | null
}

export interface UsppRowItem {
  obligationId: string | null
  santriId: string
  nis: string
  namaLengkap: string
  fotoUrl: string | null
  asrama: string | null
  kamar: string | null
  kelasSekolah: string | null
  amountExpected: number
  amountPaid: number
  amountExempted: number
  remaining: number
  installmentCount: number
  lastInstallmentAmount: number | null
  lastInstallmentAt: string | null
  lastInstallmentMethod: string | null
  status: 'BELUM_BAYAR' | 'MENCICIL' | 'LUNAS' | 'BEBAS'
  statusLabel: string
}

export interface TunggakanRowItem {
  obligationId: string
  santriId: string
  nis: string
  namaLengkap: string
  fotoUrl: string | null
  asrama: string | null
  kamar: string | null
  kelasSekolah: string | null
  itemType: 'SPP' | 'UANG_MAKAN' | 'UANG_NYUCI'
  itemLabel: string
  period: string
  periodLabel: string
  amountExpected: number
  amountPaid: number
  amountExempted: number
  remaining: number
  overdueSince: string
  overdueDuration: string
  lastPaymentAt: string | null
  lastPaymentMethod: string | null
  isLegacy: boolean
}

export interface StatusPembayaranQueryParams {
  tab?: TabType
  period?: string
  academicYear?: string
  itemType?: string
  asrama?: string
  kelas?: string
  status?: string
  search?: string
  page?: number
  pageSize?: number
  currentDateOverride?: string
}

export interface StatusPembayaranResponse {
  activeTab: TabType
  items: EnrichedStudentObligationMatrixItem[]
  ringkasanItems?: RingkasanRowItem[]
  bulananItems?: BulananRowItem[]
  tahunanItems?: TahunanRowItem[]
  usppItems?: UsppRowItem[]
  tunggakanItems?: TunggakanRowItem[]
  kpi: StatusPembayaranKpi
  tabKpi?: TabKpiContainer
  pagination: {
    currentPage: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  isPreCutoverPeriod: boolean
  selectedPeriod: string
  selectedAcademicYear?: string
  userPermissions: UserFinancePermissions
}

export interface FilterOptionsResponse {
  asramaList: string[]
  kelasList: string[]
  periodList: Array<{
    value: string
    label: string
    isPreCutover: boolean
  }>
  academicYearList: Array<{
    value: string
    label: string
  }>
  currentPeriod: string
  userPermissions: UserFinancePermissions
}

// â”€â”€â”€ TIPE DATA FASE 4B: DETAIL & DRILLDOWN SANTRI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface StudentIdentityDetail {
  id: string
  nis: string
  namaLengkap: string
  fotoUrl: string | null
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

export interface PaymentCorrectionItem {
  id: string
  correctionNumber: string
  correctionType: 'VOID' | 'REVERSAL' | 'REFUND'
  amount: number
  method: string | null
  reason: string
  createdAt: string
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
  corrections?: PaymentCorrectionItem[]
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

// â”€â”€â”€ TIPE DATA FASE 4C: CATAT PEMBAYARAN TUNAI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  fotoUrl: string | null
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
  if (!period) return '-'
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
 * Helper untuk mendapatkan periode default (bulan berjalan di Asia/Jakarta)
 */
function getCurrentPeriodJakarta(overrideDateStr?: string): string {
  if (overrideDateStr) {
    const match = overrideDateStr.match(/^(\d{4})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}`
  }
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  })
  return formatter.format(now)
}

function getDefaultPeriod(): string {
  return getCurrentPeriodJakarta()
}

/**
 * Normalisasi metode pembayaran ke bahasa operator:
 * - Tunai
 * - Virtual Account
 * - QRIS
 * - Transfer via Portal
 * Tidak pernah mengarang metode dari kewajiban.
 */
function normalizePaymentMethod(channel?: string | null, method?: string | null): string {
  if (!channel && !method) return '-'
  const ch = (channel || '').toUpperCase().trim()
  const m = (method || '').toUpperCase().trim()
  if (ch === 'CASH' || m === 'CASH') return 'Tunai'
  if (m.includes('QRIS')) return 'QRIS'
  if (m.includes('VA') || m.includes('VIRTUAL_ACCOUNT')) return 'Virtual Account'
  if (ch === 'DUITKU') return 'Transfer via Portal'
  if (m === 'TRANSFER') return 'Transfer'
  return m || ch || '-'
}

/**
 * Menghitung umur tunggakan secara presisi per bulan
 */
function calculateOverdueAge(period: string, currentPeriod: string): { overdueSince: string; overdueDuration: string } {
  const parts = period.split('-').map(Number)
  const cParts = currentPeriod.split('-').map(Number)
  const pYear = parts[0]
  const pMonth = parts[1] || 1
  const cYear = cParts[0]
  const cMonth = cParts[1] || 1
  const diffMonths = (cYear - pYear) * 12 + (cMonth - pMonth)
  const overdueSince = formatPeriodLabel(period)
  let overdueDuration = `${diffMonths} bulan`
  if (diffMonths <= 0) {
    overdueDuration = 'Bulan ini'
  } else if (diffMonths === 1) {
    overdueDuration = '1 bulan'
  } else {
    overdueDuration = `${diffMonths} bulan`
  }
  return { overdueSince, overdueDuration }
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

  const hasAccess = await canAccessFeatureForSession(session, '/dashboard/keuangan/status-pembayaran')
  if (!hasAccess) {
    throw new Error('Akses ditolak: Anda tidak memiliki hak akses untuk membuka data Status Pembayaran.')
  }

  // Role 'demo' hanya boleh menulis bila request benar-benar dilayani DEMO_DB.
  const demoRunsInSandbox = isDemoSandboxRequest(session)
  const isViewOnly = roles.includes('pimpinan') || roles.includes('tester')
  const canMutate = !isViewOnly && hasFinanceMutateRole(roles, demoRunsInSandbox)

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
 * langsung dari tabel resmi D1 `spp_tunggakan_historis`.
 */
async function fetchLegacySppArrears(santriIds: string[]): Promise<Map<string, { total: number; count: number }>> {
  const map = new Map<string, { total: number; count: number }>()
  if (santriIds.length === 0) return map

  const CHUNK_SIZE = 80
  const chunks: string[][] = []
  for (let i = 0; i < santriIds.length; i += CHUNK_SIZE) {
    chunks.push(santriIds.slice(i, i + CHUNK_SIZE))
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const placeholders = chunk.map(() => '?').join(',')
      try {
        return await query<{ santri_id: string; nominal_tagihan: number }>(
          `SELECT santri_id, nominal_tagihan
           FROM spp_tunggakan_historis
           WHERE santri_id IN (${placeholders})
             AND status = 'BELUM_LUNAS'
             AND (tahun * 100 + bulan) < 202607`,
          chunk
        )
      } catch (err: unknown) {
        console.error('[status-pembayaran] Gagal membaca spp_tunggakan_historis:', err instanceof Error ? err.message : err)
        return []
      }
    })
  )

  for (const rows of chunkResults) {
    for (const r of rows) {
      const prev = map.get(r.santri_id) ?? { total: 0, count: 0 }
      map.set(r.santri_id, {
        total: prev.total + (r.nominal_tagihan ?? 0),
        count: prev.count + 1,
      })
    }
  }

  return map
}

/**
 * Mengambil informasi pembayaran nyata terakhir untuk daftar obligation_id (efektif setelah koreksi)
 */
async function fetchLatestPaymentsForObligations(
  obligationIds: string[]
): Promise<Map<string, { paidAt: string; method: string; amount: number }>> {
  const map = new Map<string, { paidAt: string; method: string; amount: number }>()
  if (obligationIds.length === 0) return map

  const CHUNK_SIZE = 80
  const chunks: string[][] = []
  for (let i = 0; i < obligationIds.length; i += CHUNK_SIZE) {
    chunks.push(obligationIds.slice(i, i + CHUNK_SIZE))
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const ph = chunk.map(() => '?').join(',')
      try {
        return await query<{
          obligation_id: string
          paid_at: string
          channel: string
          method: string
          net_alloc: number
        }>(
          `SELECT
             a.obligation_id,
             p.paid_at,
             p.channel,
             p.method,
             (a.amount - COALESCE((SELECT SUM(ci.amount) FROM finance_correction_items ci WHERE ci.target_allocation_id = a.id), 0)) as net_alloc
           FROM finance_allocations a
           JOIN finance_payments p ON a.payment_id = p.id
           WHERE a.obligation_id IN (${ph})
           ORDER BY p.paid_at DESC, p.created_at DESC`,
          chunk
        )
      } catch (err: unknown) {
        console.error('[status-pembayaran] Gagal mengambil latest payments:', err)
        return []
      }
    })
  )

  for (const rows of chunkResults) {
    for (const r of rows) {
      if ((r.net_alloc ?? 0) <= 0) continue // Abaikan alokasi yang telah void/refund penuh
      if (!map.has(r.obligation_id)) {
        map.set(r.obligation_id, {
          paidAt: r.paid_at,
          method: normalizePaymentMethod(r.channel, r.method),
          amount: r.net_alloc,
        })
      }
    }
  }

  return map
}

/**
 * Mengambil ringkasan cicilan USPP untuk daftar santri (efektif setelah koreksi)
 */
async function fetchUsppInstallmentStats(
  santriIds: string[]
): Promise<Map<string, { count: number; lastAmount: number | null; lastPaidAt: string | null; lastMethod: string | null }>> {
  const map = new Map<string, { count: number; lastAmount: number | null; lastPaidAt: string | null; lastMethod: string | null }>()
  if (santriIds.length === 0) return map

  const CHUNK_SIZE = 80
  const chunks: string[][] = []
  for (let i = 0; i < santriIds.length; i += CHUNK_SIZE) {
    chunks.push(santriIds.slice(i, i + CHUNK_SIZE))
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const ph = chunk.map(() => '?').join(',')
      try {
        return await query<{
          santri_id: string
          paid_at: string
          channel: string
          method: string
          net_alloc: number
        }>(
          `SELECT
             p.santri_id,
             p.paid_at,
             p.channel,
             p.method,
             (a.amount - COALESCE((SELECT SUM(ci.amount) FROM finance_correction_items ci WHERE ci.target_allocation_id = a.id), 0)) as net_alloc
           FROM finance_allocations a
           JOIN finance_payments p ON a.payment_id = p.id
           WHERE a.item_type = 'USPP'
             AND p.santri_id IN (${ph})
           ORDER BY p.paid_at DESC, p.created_at DESC`,
          chunk
        )
      } catch (err: unknown) {
        console.error('[status-pembayaran] Gagal membaca statistik cicilan USPP:', err)
        return []
      }
    })
  )

  for (const rows of chunkResults) {
    for (const r of rows) {
      if ((r.net_alloc ?? 0) <= 0) continue
      const prev = map.get(r.santri_id)
      if (!prev) {
        map.set(r.santri_id, {
          count: 1,
          lastAmount: r.net_alloc,
          lastPaidAt: r.paid_at,
          lastMethod: normalizePaymentMethod(r.channel, r.method),
        })
      } else {
        prev.count += 1
      }
    }
  }

  return map
}

// â”€â”€â”€ QUERY ENGINE PER TAB (C3 REDESIGN) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchRingkasanData(options: {
  selectedPeriod: string
  currentPeriod: string
  asramaFilter?: string
  kelasFilter?: string
  searchFilter?: string
  statusFilter?: string
  page: number
  pageSize: number
}): Promise<{ items: RingkasanRowItem[]; totalCount: number }> {
  const whereClauses: string[] = [
    "s.status_global = 'aktif'",
    nonBillableSantriSqlPredicate('s.asrama'),
  ]
  const params: unknown[] = []

  if (options.asramaFilter && options.asramaFilter !== 'ALL') {
    whereClauses.push('s.asrama = ?')
    params.push(options.asramaFilter)
  }
  if (options.kelasFilter && options.kelasFilter !== 'ALL') {
    whereClauses.push('s.kelas_sekolah = ?')
    params.push(options.kelasFilter)
  }
  if (options.searchFilter) {
    whereClauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    const q = `%${options.searchFilter}%`
    params.push(q, q)
  }

  const whereSql = whereClauses.join(' AND ')

  // Total santri aktif sesuai kriteria filter
  const countRes = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM santri s WHERE ${whereSql}`,
    params
  )
  const totalCount = countRes?.total ?? 0

  const limit = options.pageSize > 0 ? options.pageSize : 50
  const offset = (Math.max(1, options.page) - 1) * limit

  const studentRows = await query<{
    id: string
    nis: string
    nama_lengkap: string
    foto_url: string | null
    asrama: string | null
    kamar: string | null
    kelas_sekolah: string | null
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.foto_url, s.asrama, s.kamar, s.kelas_sekolah
     FROM santri s
     WHERE ${whereSql}
     ORDER BY s.nama_lengkap ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  if (studentRows.length === 0) {
    return { items: [], totalCount }
  }

  const santriIds = studentRows.map(s => s.id)
  const legacyMap = await fetchLegacySppArrears(santriIds)

  // Mapping periode bulanan dan tahunan
  const monthlyPeriod = options.selectedPeriod
  const annualYear = monthlyPeriod.split('-')[0] || '2026'

  // Ambil seluruh kewajiban untuk santri pada page ini dengan net allocation authoritative
  const ph = santriIds.map(() => '?').join(',')
  const obligationRows = await query<{
    id: string
    santri_id: string
    item_type: string
    period: string
    amount_expected: number
    amount_exempted: number
    status: string
    gross_paid: number
    total_corr: number
  }>(
    `SELECT
       o.id,
       o.santri_id,
       o.item_type,
       o.period,
       o.amount_expected,
       o.amount_exempted,
       o.status,
       (SELECT COALESCE(SUM(amount), 0) FROM finance_allocations WHERE obligation_id = o.id) as gross_paid,
       (SELECT COALESCE(SUM(amount), 0) FROM finance_correction_items WHERE obligation_id = o.id) as total_corr
     FROM finance_obligations o
     WHERE o.santri_id IN (${ph})
       AND (o.period = ? OR o.period = ? OR o.period = 'LIFETIME')
       AND ${nonBillableItemSqlPredicate(
         '(SELECT s.asrama FROM santri s WHERE s.id = o.santri_id)',
         '(SELECT s.kategori_santri FROM santri s WHERE s.id = o.santri_id)',
         'o.item_type'
       )}`,
    [...santriIds, monthlyPeriod, annualYear]
  )

  // Kelompokkan kewajiban per santri dan item_type
  const obMap = new Map<string, Map<string, typeof obligationRows[0]>>()
  for (const ob of obligationRows) {
    let studentObs = obMap.get(ob.santri_id)
    if (!studentObs) {
      studentObs = new Map()
      obMap.set(ob.santri_id, studentObs)
    }
    studentObs.set(ob.item_type, ob)
  }

  const makeItemStatus = (
    ob: typeof obligationRows[0] | undefined,
    isMonthly: boolean
  ): RingkasanItemStatus => {
    if (!ob) {
      return {
        status: 'NOT_MATERIALIZED',
        label: 'Belum Ada Tagihan',
        amountExpected: 0,
        amountPaid: 0,
        amountExempted: 0,
        remaining: 0,
      }
    }

    const expected = ob.amount_expected ?? 0
    const exempted = ob.amount_exempted ?? 0
    const netPaid = Math.max(0, (ob.gross_paid ?? 0) - (ob.total_corr ?? 0))
    const remaining = Math.max(0, expected - exempted - netPaid)

    if (ob.status === 'EXEMPTED' || (expected > 0 && exempted >= expected)) {
      return {
        status: 'EXEMPTED',
        label: 'Dibebaskan',
        amountExpected: expected,
        amountPaid: netPaid,
        amountExempted: exempted,
        remaining: 0,
      }
    }

    if (remaining <= 0 && expected > 0) {
      return {
        status: 'PAID',
        label: 'Lunas',
        amountExpected: expected,
        amountPaid: netPaid,
        amountExempted: exempted,
        remaining: 0,
      }
    }

    if (netPaid > 0) {
      return {
        status: 'PARTIALLY_PAID',
        label: ob.item_type === 'USPP' ? 'Mencicil' : 'Sebagian',
        amountExpected: expected,
        amountPaid: netPaid,
        amountExempted: exempted,
        remaining,
      }
    }

    // Belum bayar: cek apakah tunggakan untuk bulanan
    if (isMonthly && ob.period < options.currentPeriod) {
      return {
        status: 'TUNGGAKAN',
        label: 'Tunggakan',
        amountExpected: expected,
        amountPaid: 0,
        amountExempted: exempted,
        remaining,
      }
    }

    return {
      status: 'UNPAID',
      label: 'Belum Lunas',
      amountExpected: expected,
      amountPaid: 0,
      amountExempted: exempted,
      remaining,
    }
  }

  const items: RingkasanRowItem[] = studentRows.map(s => {
    const studentObs = obMap.get(s.id)
    const spp = makeItemStatus(studentObs?.get('SPP'), true)
    const uangMakan = makeItemStatus(studentObs?.get('UANG_MAKAN'), true)
    const uangNyuci = makeItemStatus(studentObs?.get('UANG_NYUCI'), true)
    const ehb = makeItemStatus(studentObs?.get('EHB'), false)
    const kesehatan = makeItemStatus(studentObs?.get('KESEHATAN'), false)
    const ekskul = makeItemStatus(studentObs?.get('EKSKUL'), false)
    const uspp = makeItemStatus(studentObs?.get('USPP'), false)

    const legacyInfo = legacyMap.get(s.id) ?? { total: 0, count: 0 }
    const totalRemaining =
      spp.remaining +
      uangMakan.remaining +
      uangNyuci.remaining +
      ehb.remaining +
      kesehatan.remaining +
      ekskul.remaining +
      uspp.remaining +
      legacyInfo.total

    const allItems = [spp, uangMakan, uangNyuci, ehb, kesehatan, ekskul, uspp]
    const hasUnpaid = allItems.some(it => it.remaining > 0) || legacyInfo.total > 0
    const hasPartial = allItems.some(it => it.status === 'PARTIALLY_PAID')

    let overallStatus: 'LUNAS' | 'CICILAN' | 'BELUM_LUNAS' | 'BEBAS' = 'LUNAS'
    if (!hasUnpaid) {
      overallStatus = 'LUNAS'
    } else if (hasPartial) {
      overallStatus = 'CICILAN'
    } else {
      overallStatus = 'BELUM_LUNAS'
    }

    return {
      santriId: s.id,
      nis: s.nis,
      namaLengkap: s.nama_lengkap,
      fotoUrl: s.foto_url,
      asrama: s.asrama,
      kamar: s.kamar,
      kelasSekolah: s.kelas_sekolah,
      spp,
      uangMakan,
      uangNyuci,
      ehb,
      kesehatan,
      ekskul,
      uspp,
      totalRemaining,
      overallStatus,
      hasLegacyTunggakan: legacyInfo.total > 0,
      legacyTunggakanSpp: legacyInfo.total,
    }
  })

  return { items, totalCount }
}

async function fetchBulananData(options: {
  selectedPeriod: string
  currentPeriod: string
  asramaFilter?: string
  kelasFilter?: string
  itemFilter?: string
  statusFilter?: string
  searchFilter?: string
  page: number
  pageSize: number
}): Promise<{ items: BulananRowItem[]; totalCount: number; kpi: BulananKpi }> {
  const whereClauses: string[] = [
    "s.status_global = 'aktif'",
    "o.item_type IN ('SPP', 'UANG_MAKAN', 'UANG_NYUCI')",
    "o.period = ?",
    nonBillableSantriSqlPredicate('s.asrama'),
    // SADESA tidak ditagih UANG_MAKAN & UANG_NYUCI (SPP tetap ditagih).
    // Termasuk menutup kewajiban lama yang belum ter-EXEMPTED sebelum aturan ini berlaku.
    nonBillableItemSqlPredicate('s.asrama', 's.kategori_santri', 'o.item_type'),
  ]
  const params: unknown[] = [options.selectedPeriod]

  if (options.itemFilter && options.itemFilter !== 'ALL') {
    whereClauses.push('o.item_type = ?')
    params.push(options.itemFilter)
  }
  if (options.asramaFilter && options.asramaFilter !== 'ALL') {
    whereClauses.push('s.asrama = ?')
    params.push(options.asramaFilter)
  }
  if (options.kelasFilter && options.kelasFilter !== 'ALL') {
    whereClauses.push('s.kelas_sekolah = ?')
    params.push(options.kelasFilter)
  }
  if (options.searchFilter) {
    whereClauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    const q = `%${options.searchFilter}%`
    params.push(q, q)
  }

  // Net calculations
  const grossSql = `(SELECT COALESCE(SUM(amount), 0) FROM finance_allocations WHERE obligation_id = o.id)`
  const corrSql = `(SELECT COALESCE(SUM(amount), 0) FROM finance_correction_items WHERE obligation_id = o.id)`
  const netPaidSql = `MAX(0, ${grossSql} - ${corrSql})`
  const remainingSql = `MAX(0, o.amount_expected - o.amount_exempted - ${netPaidSql})`

  if (options.statusFilter && options.statusFilter !== 'ALL') {
    if (options.statusFilter === 'LUNAS') {
      whereClauses.push(`(${remainingSql} = 0 AND o.amount_expected > 0)`)
    } else if (options.statusFilter === 'SEBAGIAN' || options.statusFilter === 'CICILAN') {
      whereClauses.push(`(${netPaidSql} > 0 AND ${remainingSql} > 0)`)
    } else if (options.statusFilter === 'BELUM_LUNAS') {
      whereClauses.push(`(${netPaidSql} = 0 AND ${remainingSql} > 0)`)
    } else if (options.statusFilter === 'BEBAS' || options.statusFilter === 'EXEMPTED') {
      whereClauses.push(`(o.status = 'EXEMPTED' OR (o.amount_expected > 0 AND o.amount_exempted >= o.amount_expected))`)
    }
  }

  const whereSql = whereClauses.join(' AND ')

  const countPromise = queryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM finance_obligations o
     JOIN santri s ON o.santri_id = s.id
     WHERE ${whereSql}`,
    params
  )

  const aggPromise = query<{
    item_type: string
    total_count: number
    target_nominal: number
    paid_nominal: number
    remaining_nominal: number
    lunas_count: number
  }>(
    `SELECT
       o.item_type,
       COUNT(*) as total_count,
       COALESCE(SUM(o.amount_expected - o.amount_exempted), 0) as target_nominal,
       COALESCE(SUM(${netPaidSql}), 0) as paid_nominal,
       COALESCE(SUM(${remainingSql}), 0) as remaining_nominal,
       COALESCE(SUM(CASE WHEN ${remainingSql} = 0 AND o.amount_expected > 0 THEN 1 ELSE 0 END), 0) as lunas_count
     FROM finance_obligations o
     JOIN santri s ON o.santri_id = s.id
     WHERE ${whereSql}
     GROUP BY o.item_type`,
    params
  )

  const limit = options.pageSize > 0 ? options.pageSize : 50
  const offset = (Math.max(1, options.page) - 1) * limit

  const rowsPromise = query<{
    id: string
    santri_id: string
    nis: string
    nama_lengkap: string
    foto_url: string | null
    asrama: string | null
    kamar: string | null
    kelas_sekolah: string | null
    item_type: 'SPP' | 'UANG_MAKAN' | 'UANG_NYUCI'
    period: string
    amount_expected: number
    amount_exempted: number
    status: string
    gross_paid: number
    total_corr: number
    provider_name: string | null
  }>(
    `SELECT
       o.id,
       o.santri_id,
       s.nis,
       s.nama_lengkap,
       s.foto_url,
       s.asrama,
       s.kamar,
       s.kelas_sekolah,
       o.item_type,
       o.period,
       o.amount_expected,
       o.amount_exempted,
       o.status,
       ${grossSql} as gross_paid,
       ${corrSql} as total_corr,
       m.nama_jasa as provider_name
     FROM finance_obligations o
     JOIN santri s ON o.santri_id = s.id
     LEFT JOIN master_jasa m ON o.provider_id = m.id
     WHERE ${whereSql}
     ORDER BY s.nama_lengkap ASC, o.item_type ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  const [countRes, aggRows, rows] = await Promise.all([
    countPromise,
    aggPromise,
    rowsPromise,
  ])
  const totalCount = countRes?.total ?? 0

  let totalTagihanNominal = 0
  let sudahTerbayarNominal = 0
  let sisaTagihanNominal = 0
  let totalTagihanCount = 0
  let lunasCount = 0

  const monthlyTypes: Array<'SPP' | 'UANG_MAKAN' | 'UANG_NYUCI'> = ['SPP', 'UANG_MAKAN', 'UANG_NYUCI']
  const itemBreakdown: ItemBreakdownKpi[] = monthlyTypes.map((type) => {
    const r = aggRows.find((row) => row.item_type === type)
    const target = r?.target_nominal ?? 0
    const paid = r?.paid_nominal ?? 0
    const remaining = r?.remaining_nominal ?? 0
    const count = r?.total_count ?? 0
    const lunas = r?.lunas_count ?? 0

    totalTagihanNominal += target
    sudahTerbayarNominal += paid
    sisaTagihanNominal += remaining
    totalTagihanCount += count
    lunasCount += lunas

    return {
      itemType: type,
      itemLabel: FINANCE_ITEM_LABELS[type as keyof typeof FINANCE_ITEM_LABELS] || type,
      targetNominal: target,
      paidNominal: paid,
      remainingNominal: remaining,
      totalCount: count,
      lunasCount: lunas,
    }
  })

  const bulananKpi: BulananKpi = {
    totalTagihanNominal,
    sudahTerbayarNominal,
    sisaTagihanNominal,
    totalTagihanCount,
    lunasCount,
    itemBreakdown,
  }

  const obligationIds = rows.map(r => r.id)
  const paymentsMap = await fetchLatestPaymentsForObligations(obligationIds)

  const items: BulananRowItem[] = rows.map(r => {
    const expected = r.amount_expected ?? 0
    const exempted = r.amount_exempted ?? 0
    const netPaid = Math.max(0, (r.gross_paid ?? 0) - (r.total_corr ?? 0))
    const remaining = Math.max(0, expected - exempted - netPaid)

    let status: FinanceObligationStatus = 'UNPAID'
    let statusLabel = 'Belum Lunas'
    if (r.status === 'EXEMPTED' || (expected > 0 && exempted >= expected)) {
      status = 'EXEMPTED'
      statusLabel = 'Dibebaskan'
    } else if (remaining <= 0 && expected > 0) {
      status = 'PAID'
      statusLabel = 'Lunas'
    } else if (netPaid > 0) {
      status = 'PARTIALLY_PAID'
      statusLabel = 'Sebagian'
    }

    const payInfo = paymentsMap.get(r.id)

    return {
      obligationId: r.id,
      santriId: r.santri_id,
      nis: r.nis,
      namaLengkap: r.nama_lengkap,
      fotoUrl: r.foto_url,
      asrama: r.asrama,
      kamar: r.kamar,
      kelasSekolah: r.kelas_sekolah,
      itemType: r.item_type,
      itemLabel: FINANCE_ITEM_LABELS[r.item_type as keyof typeof FINANCE_ITEM_LABELS] || r.item_type,
      period: r.period,
      periodLabel: formatPeriodLabel(r.period),
      amountExpected: expected,
      amountPaid: netPaid,
      amountExempted: exempted,
      remaining,
      status,
      statusLabel,
      lastPaymentAt: payInfo?.paidAt ?? null,
      lastPaymentMethod: payInfo?.method ?? null,
      providerName: r.provider_name,
    }
  })

  return { items, totalCount, kpi: bulananKpi }
}

async function fetchTahunanData(options: {
  academicYear?: string
  asramaFilter?: string
  kelasFilter?: string
  itemFilter?: string
  statusFilter?: string
  searchFilter?: string
  page: number
  pageSize: number
}): Promise<{ items: TahunanRowItem[]; totalCount: number; kpi: TahunanKpi }> {
  const annualPeriod = options.academicYear ? options.academicYear.split('/')[0] : '2026'

  const whereClauses: string[] = [
    "s.status_global = 'aktif'",
    "o.item_type IN ('EHB', 'KESEHATAN', 'EKSKUL')",
    "o.period = ?",
    nonBillableSantriSqlPredicate('s.asrama'),
  ]
  const params: unknown[] = [annualPeriod]

  if (options.itemFilter && options.itemFilter !== 'ALL') {
    whereClauses.push('o.item_type = ?')
    params.push(options.itemFilter)
  }
  if (options.asramaFilter && options.asramaFilter !== 'ALL') {
    whereClauses.push('s.asrama = ?')
    params.push(options.asramaFilter)
  }
  if (options.kelasFilter && options.kelasFilter !== 'ALL') {
    whereClauses.push('s.kelas_sekolah = ?')
    params.push(options.kelasFilter)
  }
  if (options.searchFilter) {
    whereClauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    const q = `%${options.searchFilter}%`
    params.push(q, q)
  }

  const grossSql = `(SELECT COALESCE(SUM(amount), 0) FROM finance_allocations WHERE obligation_id = o.id)`
  const corrSql = `(SELECT COALESCE(SUM(amount), 0) FROM finance_correction_items WHERE obligation_id = o.id)`
  const netPaidSql = `MAX(0, ${grossSql} - ${corrSql})`
  const remainingSql = `MAX(0, o.amount_expected - o.amount_exempted - ${netPaidSql})`

  if (options.statusFilter && options.statusFilter !== 'ALL') {
    if (options.statusFilter === 'LUNAS') {
      whereClauses.push(`(${remainingSql} = 0 AND o.amount_expected > 0)`)
    } else if (options.statusFilter === 'SEBAGIAN' || options.statusFilter === 'CICILAN') {
      whereClauses.push(`(${netPaidSql} > 0 AND ${remainingSql} > 0)`)
    } else if (options.statusFilter === 'BELUM_LUNAS') {
      whereClauses.push(`(${netPaidSql} = 0 AND ${remainingSql} > 0)`)
    } else if (options.statusFilter === 'BEBAS' || options.statusFilter === 'EXEMPTED') {
      whereClauses.push(`(o.status = 'EXEMPTED' OR (o.amount_expected > 0 AND o.amount_exempted >= o.amount_expected))`)
    }
  }

  const whereSql = whereClauses.join(' AND ')

  const countPromise = queryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM finance_obligations o
     JOIN santri s ON o.santri_id = s.id
     WHERE ${whereSql}`,
    params
  )

  const aggPromise = query<{
    item_type: string
    total_count: number
    target_nominal: number
    paid_nominal: number
    remaining_nominal: number
    lunas_count: number
    bebas_count: number
  }>(
    `SELECT
       o.item_type,
       COUNT(*) as total_count,
       COALESCE(SUM(o.amount_expected - o.amount_exempted), 0) as target_nominal,
       COALESCE(SUM(${netPaidSql}), 0) as paid_nominal,
       COALESCE(SUM(${remainingSql}), 0) as remaining_nominal,
       COALESCE(SUM(CASE WHEN ${remainingSql} = 0 AND o.amount_expected > 0 THEN 1 ELSE 0 END), 0) as lunas_count,
       COALESCE(SUM(CASE WHEN o.status = 'EXEMPTED' OR (o.amount_expected > 0 AND o.amount_exempted >= o.amount_expected) THEN 1 ELSE 0 END), 0) as bebas_count
     FROM finance_obligations o
     JOIN santri s ON o.santri_id = s.id
     WHERE ${whereSql}
     GROUP BY o.item_type`,
    params
  )

  const limit = options.pageSize > 0 ? options.pageSize : 50
  const offset = (Math.max(1, options.page) - 1) * limit

  const rowsPromise = query<{
    id: string
    santri_id: string
    nis: string
    nama_lengkap: string
    foto_url: string | null
    asrama: string | null
    kamar: string | null
    kelas_sekolah: string | null
    item_type: 'EHB' | 'KESEHATAN' | 'EKSKUL'
    period: string
    amount_expected: number
    amount_exempted: number
    status: string
    gross_paid: number
    total_corr: number
  }>(
    `SELECT
       o.id,
       o.santri_id,
       s.nis,
       s.nama_lengkap,
       s.foto_url,
       s.asrama,
       s.kamar,
       s.kelas_sekolah,
       o.item_type,
       o.period,
       o.amount_expected,
       o.amount_exempted,
       o.status,
       ${grossSql} as gross_paid,
       ${corrSql} as total_corr
     FROM finance_obligations o
     JOIN santri s ON o.santri_id = s.id
     WHERE ${whereSql}
     ORDER BY s.nama_lengkap ASC, o.item_type ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  const [countRes, aggRows, rows] = await Promise.all([
    countPromise,
    aggPromise,
    rowsPromise,
  ])
  const totalCount = countRes?.total ?? 0

  let totalTagihanNominal = 0
  let sudahTerbayarNominal = 0
  let sisaTagihanNominal = 0
  let totalTagihanCount = 0
  let lunasCount = 0
  let bebasCount = 0

  const annualTypes: Array<'EHB' | 'EKSKUL' | 'KESEHATAN'> = ['EHB', 'EKSKUL', 'KESEHATAN']
  const itemBreakdown: ItemBreakdownKpi[] = annualTypes.map((type) => {
    const r = aggRows.find((row) => row.item_type === type)
    const target = r?.target_nominal ?? 0
    const paid = r?.paid_nominal ?? 0
    const remaining = r?.remaining_nominal ?? 0
    const count = r?.total_count ?? 0
    const lunas = r?.lunas_count ?? 0
    const bebas = r?.bebas_count ?? 0

    totalTagihanNominal += target
    sudahTerbayarNominal += paid
    sisaTagihanNominal += remaining
    totalTagihanCount += count
    lunasCount += lunas
    bebasCount += bebas

    return {
      itemType: type,
      itemLabel: FINANCE_ITEM_LABELS[type as keyof typeof FINANCE_ITEM_LABELS] || type,
      targetNominal: target,
      paidNominal: paid,
      remainingNominal: remaining,
      totalCount: count,
      lunasCount: lunas,
    }
  })

  const tahunanKpi: TahunanKpi = {
    totalTagihanNominal,
    sudahTerbayarNominal,
    sisaTagihanNominal,
    totalTagihanCount,
    lunasCount,
    bebasCount,
    itemBreakdown,
  }

  const obligationIds = rows.map(r => r.id)
  const paymentsMap = await fetchLatestPaymentsForObligations(obligationIds)

  const nextYear = parseInt(annualPeriod, 10) + 1
  const academicYearLabel = `${annualPeriod}/${nextYear}`

  const items: TahunanRowItem[] = rows.map(r => {
    const expected = r.amount_expected ?? 0
    const exempted = r.amount_exempted ?? 0
    const netPaid = Math.max(0, (r.gross_paid ?? 0) - (r.total_corr ?? 0))
    const remaining = Math.max(0, expected - exempted - netPaid)

    let status: FinanceObligationStatus = 'UNPAID'
    let statusLabel = 'Belum Lunas'
    if (r.status === 'EXEMPTED' || (expected > 0 && exempted >= expected)) {
      status = 'EXEMPTED'
      statusLabel = 'Dibebaskan'
    } else if (remaining <= 0 && expected > 0) {
      status = 'PAID'
      statusLabel = 'Lunas'
    } else if (netPaid > 0) {
      status = 'PARTIALLY_PAID'
      statusLabel = 'Sebagian'
    }

    const payInfo = paymentsMap.get(r.id)

    return {
      obligationId: r.id,
      santriId: r.santri_id,
      nis: r.nis,
      namaLengkap: r.nama_lengkap,
      fotoUrl: r.foto_url,
      asrama: r.asrama,
      kamar: r.kamar,
      kelasSekolah: r.kelas_sekolah,
      itemType: r.item_type,
      itemLabel: FINANCE_ITEM_LABELS[r.item_type as keyof typeof FINANCE_ITEM_LABELS] || r.item_type,
      academicYear: annualPeriod,
      academicYearLabel,
      amountExpected: expected,
      amountPaid: netPaid,
      amountExempted: exempted,
      remaining,
      status,
      statusLabel,
      lastPaymentAt: payInfo?.paidAt ?? null,
      lastPaymentMethod: payInfo?.method ?? null,
    }
  })

  return { items, totalCount, kpi: tahunanKpi }
}

async function fetchUsppData(options: {
  asramaFilter?: string
  kelasFilter?: string
  statusFilter?: string
  searchFilter?: string
  page: number
  pageSize: number
}): Promise<{ items: UsppRowItem[]; totalCount: number; kpi: UsppKpi }> {
  const whereClauses: string[] = [
    "s.status_global = 'aktif'",
    nonBillableSantriSqlPredicate('s.asrama'),
  ]
  const params: unknown[] = []

  if (options.asramaFilter && options.asramaFilter !== 'ALL') {
    whereClauses.push('s.asrama = ?')
    params.push(options.asramaFilter)
  }
  if (options.kelasFilter && options.kelasFilter !== 'ALL') {
    whereClauses.push('s.kelas_sekolah = ?')
    params.push(options.kelasFilter)
  }
  if (options.searchFilter) {
    whereClauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    const q = `%${options.searchFilter}%`
    params.push(q, q)
  }

  const grossSql = `(SELECT COALESCE(SUM(amount), 0) FROM finance_allocations WHERE obligation_id = o.id)`
  const corrSql = `(SELECT COALESCE(SUM(amount), 0) FROM finance_correction_items WHERE obligation_id = o.id)`
  const netPaidSql = `MAX(0, ${grossSql} - ${corrSql})`
  const remainingSql = `MAX(0, COALESCE(o.amount_expected, 0) - COALESCE(o.amount_exempted, 0) - ${netPaidSql})`

  if (options.statusFilter && options.statusFilter !== 'ALL') {
    if (options.statusFilter === 'LUNAS') {
      whereClauses.push(`(o.id IS NOT NULL AND ${remainingSql} = 0 AND o.amount_expected > 0)`)
    } else if (options.statusFilter === 'MENCICIL' || options.statusFilter === 'CICILAN') {
      whereClauses.push(`(o.id IS NOT NULL AND ${netPaidSql} > 0 AND ${remainingSql} > 0)`)
    } else if (options.statusFilter === 'BELUM_BAYAR' || options.statusFilter === 'BELUM_LUNAS') {
      whereClauses.push(`(o.id IS NULL OR (${netPaidSql} = 0 AND ${remainingSql} > 0))`)
    } else if (options.statusFilter === 'BEBAS' || options.statusFilter === 'EXEMPTED') {
      whereClauses.push(`(o.id IS NOT NULL AND (o.status = 'EXEMPTED' OR (o.amount_expected > 0 AND o.amount_exempted >= o.amount_expected)))`)
    }
  }

  const whereSql = whereClauses.join(' AND ')

  const countPromise = queryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM santri s
     LEFT JOIN finance_obligations o ON s.id = o.santri_id AND o.item_type = 'USPP' AND o.period = 'LIFETIME'
     WHERE ${whereSql}`,
    params
  )

  const aggPromise = queryOne<{
    total_komitmen: number
    total_terkumpul: number
    sisa_piutang: number
    lunas_count: number
    mencicil_count: number
    belum_bayar_count: number
  }>(
    `SELECT
       COALESCE(SUM(calc.amount_expected), 0) as total_komitmen,
       COALESCE(SUM(calc.net_paid), 0) as total_terkumpul,
       COALESCE(SUM(calc.remaining), 0) as sisa_piutang,
       COUNT(CASE WHEN calc.id IS NOT NULL AND (calc.remaining <= 0 OR calc.status = 'EXEMPTED' OR (calc.amount_expected > 0 AND calc.amount_exempted >= calc.amount_expected)) AND calc.amount_expected > 0 THEN 1 END) as lunas_count,
       COUNT(CASE WHEN calc.id IS NOT NULL AND calc.net_paid > 0 AND calc.remaining > 0 THEN 1 END) as mencicil_count,
       COUNT(CASE WHEN calc.id IS NULL OR (calc.net_paid = 0 AND calc.remaining > 0) THEN 1 END) as belum_bayar_count
     FROM (
       SELECT
         o.id,
         o.amount_expected,
         o.amount_exempted,
         o.status,
         ${netPaidSql} as net_paid,
         ${remainingSql} as remaining
       FROM santri s
       LEFT JOIN finance_obligations o ON s.id = o.santri_id AND o.item_type = 'USPP' AND o.period = 'LIFETIME'
       WHERE ${whereSql}
     ) calc`,
    params
  )

  const limit = options.pageSize > 0 ? options.pageSize : 50
  const offset = (Math.max(1, options.page) - 1) * limit

  const rowsPromise = query<{
    id: string | null
    santri_id: string
    nis: string
    nama_lengkap: string
    foto_url: string | null
    asrama: string | null
    kamar: string | null
    kelas_sekolah: string | null
    amount_expected: number | null
    amount_exempted: number | null
    status: string | null
    gross_paid: number
    total_corr: number
  }>(
    `SELECT
       o.id,
       s.id as santri_id,
       s.nis,
       s.nama_lengkap,
       s.foto_url,
       s.asrama,
       s.kamar,
       s.kelas_sekolah,
       o.amount_expected,
       o.amount_exempted,
       o.status,
       ${grossSql} as gross_paid,
       ${corrSql} as total_corr
     FROM santri s
     LEFT JOIN finance_obligations o ON s.id = o.santri_id AND o.item_type = 'USPP' AND o.period = 'LIFETIME'
     WHERE ${whereSql}
     ORDER BY s.nama_lengkap ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  const [countRes, aggRes, rows] = await Promise.all([
    countPromise,
    aggPromise,
    rowsPromise,
  ])
  const totalCount = countRes?.total ?? 0

  const usppKpi: UsppKpi = {
    totalKomitmenNominal: aggRes?.total_komitmen ?? 0,
    terkumpulNominal: aggRes?.total_terkumpul ?? 0,
    sisaPiutangNominal: aggRes?.sisa_piutang ?? 0,
    santriLunasCount: aggRes?.lunas_count ?? 0,
    santriMencicilCount: aggRes?.mencicil_count ?? 0,
    santriBelumBayarCount: aggRes?.belum_bayar_count ?? 0,
  }

  const santriIds = rows.map(r => r.santri_id)
  const installmentStats = await fetchUsppInstallmentStats(santriIds)

  const items: UsppRowItem[] = rows.map(r => {
    const expected = r.amount_expected ?? 0
    const exempted = r.amount_exempted ?? 0
    const netPaid = Math.max(0, (r.gross_paid ?? 0) - (r.total_corr ?? 0))
    const remaining = Math.max(0, expected - exempted - netPaid)

    const stats = installmentStats.get(r.santri_id)
    const installmentCount = stats?.count ?? 0

    let status: 'BELUM_BAYAR' | 'MENCICIL' | 'LUNAS' | 'BEBAS' = 'BELUM_BAYAR'
    let statusLabel = 'Belum Bayar'

    if (r.status === 'EXEMPTED' || (expected > 0 && exempted >= expected)) {
      status = 'BEBAS'
      statusLabel = 'Dibebaskan'
    } else if (remaining <= 0 && expected > 0) {
      status = 'LUNAS'
      statusLabel = 'Lunas'
    } else if (netPaid > 0) {
      status = 'MENCICIL'
      statusLabel = 'Mencicil'
    }

    return {
      obligationId: r.id,
      santriId: r.santri_id,
      nis: r.nis,
      namaLengkap: r.nama_lengkap,
      fotoUrl: r.foto_url,
      asrama: r.asrama,
      kamar: r.kamar,
      kelasSekolah: r.kelas_sekolah,
      amountExpected: expected,
      amountPaid: netPaid,
      amountExempted: exempted,
      remaining,
      installmentCount,
      lastInstallmentAmount: stats?.lastAmount ?? null,
      lastInstallmentAt: stats?.lastPaidAt ?? null,
      lastInstallmentMethod: stats?.lastMethod ?? null,
      status,
      statusLabel,
    }
  })

  return { items, totalCount, kpi: usppKpi }
}

async function fetchTunggakanData(options: {
  currentPeriod: string
  periodFilter?: string
  asramaFilter?: string
  kelasFilter?: string
  itemFilter?: string
  searchFilter?: string
  page: number
  pageSize: number
}): Promise<{ items: TunggakanRowItem[]; totalCount: number; kpi: TunggakanKpi }> {
  // Aturan kaku: Tunggakan hanya mencakup SPP, Uang Makan, dan Uang Nyuci
  // yang periodenya < currentPeriodJakarta DAN memiliki sisa > 0.
  const emptyKpi: TunggakanKpi = {
    totalTunggakanNominal: 0,
    totalTagihanMenunggak: 0,
    totalSantriMenunggak: 0,
    tunggakanTertuaLabel: '-',
    itemBreakdown: ['SPP', 'UANG_MAKAN', 'UANG_NYUCI'].map(t => ({
      itemType: t,
      itemLabel: FINANCE_ITEM_LABELS[t as keyof typeof FINANCE_ITEM_LABELS] || t,
      nominalTunggakan: 0,
      countTagihan: 0,
      targetNominal: 0,
    })),
  }

  const whereClauses: string[] = [
    "s.status_global = 'aktif'",
    "o.item_type IN ('SPP', 'UANG_MAKAN', 'UANG_NYUCI')",
    "o.period < ?",
    nonBillableSantriSqlPredicate('s.asrama'),
    // SADESA tidak ditagih UANG_MAKAN & UANG_NYUCI (tidak boleh muncul sebagai tunggakan)
    nonBillableItemSqlPredicate('s.asrama', 's.kategori_santri', 'o.item_type'),
    "o.status <> 'EXEMPTED'",
  ]
  const params: unknown[] = [options.currentPeriod]

  if (options.periodFilter && options.periodFilter !== 'ALL') {
    // Validasi: jika filter periode >= currentPeriod, periode tersebut bukan tunggakan
    if (options.periodFilter >= options.currentPeriod) {
      return { items: [], totalCount: 0, kpi: emptyKpi }
    }
    whereClauses.push('o.period = ?')
    params.push(options.periodFilter)
  }

  if (options.itemFilter && options.itemFilter !== 'ALL') {
    if (['SPP', 'UANG_MAKAN', 'UANG_NYUCI'].includes(options.itemFilter)) {
      whereClauses.push('o.item_type = ?')
      params.push(options.itemFilter)
    } else {
      // Item selain SPP/Makan/Cuci (misal Tahunan/USPP) tidak punya due date authoritative -> 0 rows
      return { items: [], totalCount: 0, kpi: emptyKpi }
    }
  }

  if (options.asramaFilter && options.asramaFilter !== 'ALL') {
    whereClauses.push('s.asrama = ?')
    params.push(options.asramaFilter)
  }
  if (options.kelasFilter && options.kelasFilter !== 'ALL') {
    whereClauses.push('s.kelas_sekolah = ?')
    params.push(options.kelasFilter)
  }
  if (options.searchFilter) {
    whereClauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    const q = `%${options.searchFilter}%`
    params.push(q, q)
  }

  // Outstanding authoritative > 0
  const grossSql = `(SELECT COALESCE(SUM(amount), 0) FROM finance_allocations WHERE obligation_id = o.id)`
  const corrSql = `(SELECT COALESCE(SUM(amount), 0) FROM finance_correction_items WHERE obligation_id = o.id)`
  const netPaidSql = `MAX(0, ${grossSql} - ${corrSql})`
  const remainingSql = `(o.amount_expected - o.amount_exempted - ${netPaidSql})`

  whereClauses.push(`${remainingSql} > 0`)
  whereClauses.push(`o.status != 'EXEMPTED'`)

  const whereSql = whereClauses.join(' AND ')

  const countPromise = queryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM finance_obligations o
     JOIN santri s ON o.santri_id = s.id
     WHERE ${whereSql}`,
    params
  )

  const aggPromise = query<{
    item_type: string
    total_count: number
    target_nominal: number
    paid_nominal: number
    remaining_nominal: number
  }>(
    `SELECT
       o.item_type,
       COUNT(*) as total_count,
       COALESCE(SUM(o.amount_expected), 0) as target_nominal,
       COALESCE(SUM(${netPaidSql}), 0) as paid_nominal,
       COALESCE(SUM(${remainingSql}), 0) as remaining_nominal
     FROM finance_obligations o
     JOIN santri s ON o.santri_id = s.id
     WHERE ${whereSql}
     GROUP BY o.item_type`,
    params
  )

  const santriPromise = queryOne<{
    total_santri: number
    oldest_period: string | null
  }>(
    `SELECT
       COUNT(DISTINCT o.santri_id) as total_santri,
       MIN(o.period) as oldest_period
     FROM finance_obligations o
     JOIN santri s ON o.santri_id = s.id
     WHERE ${whereSql}`,
    params
  )

  const limit = options.pageSize > 0 ? options.pageSize : 50
  const offset = (Math.max(1, options.page) - 1) * limit

  const rowsPromise = query<{
    id: string
    santri_id: string
    nis: string
    nama_lengkap: string
    foto_url: string | null
    asrama: string | null
    kamar: string | null
    kelas_sekolah: string | null
    item_type: 'SPP' | 'UANG_MAKAN' | 'UANG_NYUCI'
    period: string
    amount_expected: number
    amount_exempted: number
    gross_paid: number
    total_corr: number
  }>(
    `SELECT
       o.id,
       o.santri_id,
       s.nis,
       s.nama_lengkap,
       s.foto_url,
       s.asrama,
       s.kamar,
       s.kelas_sekolah,
       o.item_type,
       o.period,
       o.amount_expected,
       o.amount_exempted,
       ${grossSql} as gross_paid,
       ${corrSql} as total_corr
     FROM finance_obligations o
     JOIN santri s ON o.santri_id = s.id
     WHERE ${whereSql}
     ORDER BY o.period ASC, s.nama_lengkap ASC, o.item_type ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  const [countRes, aggRows, santriRes, rows] = await Promise.all([
    countPromise,
    aggPromise,
    santriPromise,
    rowsPromise,
  ])
  const totalCount = countRes?.total ?? 0

  let totalTunggakanNominal = 0
  const monthlyTypes: Array<'SPP' | 'UANG_MAKAN' | 'UANG_NYUCI'> = ['SPP', 'UANG_MAKAN', 'UANG_NYUCI']
  const itemBreakdown: TunggakanItemBreakdownKpi[] = monthlyTypes.map((type) => {
    const r = aggRows.find((row) => row.item_type === type)
    const target = r?.target_nominal ?? 0
    const remaining = r?.remaining_nominal ?? 0
    const count = r?.total_count ?? 0

    totalTunggakanNominal += remaining

    return {
      itemType: type,
      itemLabel: FINANCE_ITEM_LABELS[type as keyof typeof FINANCE_ITEM_LABELS] || type,
      nominalTunggakan: remaining,
      countTagihan: count,
      targetNominal: target,
    }
  })

  let tunggakanTertuaLabel = '-'
  if (santriRes?.oldest_period) {
    const { overdueDuration } = calculateOverdueAge(santriRes.oldest_period, options.currentPeriod)
    tunggakanTertuaLabel = overdueDuration
      ? `${formatPeriodLabel(santriRes.oldest_period)} (${overdueDuration})`
      : formatPeriodLabel(santriRes.oldest_period)
  }

  const tunggakanKpi: TunggakanKpi = {
    totalTunggakanNominal,
    totalTagihanMenunggak: totalCount,
    totalSantriMenunggak: santriRes?.total_santri ?? 0,
    tunggakanTertuaLabel,
    itemBreakdown,
  }

  const obligationIds = rows.map(r => r.id)
  const paymentsMap = await fetchLatestPaymentsForObligations(obligationIds)

  const items: TunggakanRowItem[] = rows.map(r => {
    const expected = r.amount_expected ?? 0
    const exempted = r.amount_exempted ?? 0
    const netPaid = Math.max(0, (r.gross_paid ?? 0) - (r.total_corr ?? 0))
    const remaining = Math.max(0, expected - exempted - netPaid)

    const { overdueSince, overdueDuration } = calculateOverdueAge(r.period, options.currentPeriod)
    const payInfo = paymentsMap.get(r.id)

    return {
      obligationId: r.id,
      santriId: r.santri_id,
      nis: r.nis,
      namaLengkap: r.nama_lengkap,
      fotoUrl: r.foto_url,
      asrama: r.asrama,
      kamar: r.kamar,
      kelasSekolah: r.kelas_sekolah,
      itemType: r.item_type,
      itemLabel: FINANCE_ITEM_LABELS[r.item_type as keyof typeof FINANCE_ITEM_LABELS] || r.item_type,
      period: r.period,
      periodLabel: formatPeriodLabel(r.period),
      amountExpected: expected,
      amountPaid: netPaid,
      amountExempted: exempted,
      remaining,
      overdueSince,
      overdueDuration,
      lastPaymentAt: payInfo?.paidAt ?? null,
      lastPaymentMethod: payInfo?.method ?? null,
      isLegacy: false,
    }
  })

  return { items, totalCount, kpi: tunggakanKpi }
}

/**
 * Mengambil data matriks status pembayaran utama beserta agregasi 4 KPI cards
 * dan integrasi per tab (Ringkasan, Bulanan, Tahunan, USPP, Tunggakan).
 */
export async function getStatusPembayaranData(
  params?: StatusPembayaranQueryParams
): Promise<StatusPembayaranResponse> {
  const { permissions } = await authorizeUser()

  const currentPeriod = getCurrentPeriodJakarta(params?.currentDateOverride)
  const selectedPeriod = params?.period?.trim() || currentPeriod
  const isPreCutoverPeriod = selectedPeriod < FINANCE_CUTOVER_START_MONTHLY
  const asramaFilter = params?.asrama?.trim() || undefined
  const kelasFilter = params?.kelas?.trim() || undefined
  const itemFilter = params?.itemType?.trim() || undefined
  const searchFilter = params?.search?.trim() || undefined
  const statusFilter = params?.status && params.status !== 'ALL' ? params.status : undefined
  const page = Math.max(1, params?.page ?? 1)
  const pageSize = params?.pageSize !== undefined ? params.pageSize : 50
  const activeTab: TabType = params?.tab || 'RINGKASAN'

  // 1 & 2. Hitung matriks & KPI secara paralel dengan query data tab aktif
  const matrixAndKpiPromise = (async () => {
    const rawMatrix = await getStudentsObligationMatrix(selectedPeriod, {
      asrama: asramaFilter,
      search: searchFilter,
    })

    const santriIds = rawMatrix.map(item => item.santriId)
    const legacyArrearsMap = await fetchLegacySppArrears(santriIds)

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

    return { enrichedList, kpi }
  })()

  // 3. Eksekusi query spesifik sesuai tab aktif secara paralel
  const tabPromise = (async () => {
    if (activeTab === 'RINGKASAN') {
      const res = await fetchRingkasanData({
        selectedPeriod,
        currentPeriod,
        asramaFilter,
        kelasFilter,
        searchFilter,
        statusFilter,
        page,
        pageSize,
      })
      return { ringkasanItems: res.items, totalCount: res.totalCount }
    } else if (activeTab === 'BULANAN') {
      const res = await fetchBulananData({
        selectedPeriod,
        currentPeriod,
        asramaFilter,
        kelasFilter,
        itemFilter,
        statusFilter,
        searchFilter,
        page,
        pageSize,
      })
      return { bulananItems: res.items, totalCount: res.totalCount, bulananKpi: res.kpi }
    } else if (activeTab === 'TAHUNAN') {
      const res = await fetchTahunanData({
        academicYear: params?.academicYear,
        asramaFilter,
        kelasFilter,
        itemFilter,
        statusFilter,
        searchFilter,
        page,
        pageSize,
      })
      return { tahunanItems: res.items, totalCount: res.totalCount, tahunanKpi: res.kpi }
    } else if (activeTab === 'USPP') {
      const res = await fetchUsppData({
        asramaFilter,
        kelasFilter,
        statusFilter,
        searchFilter,
        page,
        pageSize,
      })
      return { usppItems: res.items, totalCount: res.totalCount, usppKpi: res.kpi }
    } else {
      const res = await fetchTunggakanData({
        currentPeriod,
        periodFilter: params?.period,
        asramaFilter,
        kelasFilter,
        itemFilter,
        searchFilter,
        page,
        pageSize,
      })
      return { tunggakanItems: res.items, totalCount: res.totalCount, tunggakanKpi: res.kpi }
    }
  })()

  const [{ enrichedList, kpi }, tabResult] = await Promise.all([
    matrixAndKpiPromise,
    tabPromise,
  ])

  const ringkasanItems = tabResult.ringkasanItems
  const bulananItems = tabResult.bulananItems
  const tahunanItems = tabResult.tahunanItems
  const usppItems = tabResult.usppItems
  const tunggakanItems = tabResult.tunggakanItems
  const totalTabItems = tabResult.totalCount

  const tabKpi: TabKpiContainer = {
    ringkasan: kpi,
    bulanan: tabResult.bulananKpi,
    tahunan: tabResult.tahunanKpi,
    uspp: tabResult.usppKpi,
    tunggakan: tabResult.tunggakanKpi,
  }

  // Paginasi aman
  const effectiveSize = pageSize === 0 ? totalTabItems : pageSize
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalTabItems / effectiveSize))
  const safePage = Math.min(page, totalPages)

  // Backward-compatible slice for rawMatrix (Fase 4A tests)
  let filteredRawList = enrichedList
  if (statusFilter) {
    filteredRawList = enrichedList.filter(item => {
      if (statusFilter === 'LUNAS') {
        return item.overallStatus === 'LUNAS' && !item.hasLegacyTunggakan
      }
      if (statusFilter === 'BELUM_LUNAS') {
        return item.overallStatus === 'BELUM_LUNAS' || item.hasLegacyTunggakan
      }
      return item.overallStatus === statusFilter
    })
  }
  const startIndex = pageSize === 0 ? 0 : (safePage - 1) * effectiveSize
  const paginatedRawItems = pageSize === 0 ? filteredRawList : filteredRawList.slice(startIndex, startIndex + effectiveSize)

  return {
    activeTab,
    items: paginatedRawItems,
    ringkasanItems,
    bulananItems,
    tahunanItems,
    usppItems,
    tunggakanItems,
    kpi,
    tabKpi,
    pagination: {
      currentPage: safePage,
      pageSize,
      totalItems: totalTabItems,
      totalPages,
    },
    isPreCutoverPeriod,
    selectedPeriod,
    selectedAcademicYear: params?.academicYear || selectedPeriod.split('-')[0] || '2026',
    userPermissions: permissions,
  }
}

/**
 * Mengambil opsi filter dropdown (asrama, kelas, periode bulanan, dan tahun ajaran)
 */
export async function getStatusPembayaranFilterOptions(): Promise<FilterOptionsResponse> {
  const { permissions } = await authorizeUser()

  // Ambil daftar asrama, kelas, dan tahun ajaran secara paralel
  const [asramaRows, kRows, taRows] = await Promise.all([
    query<{ asrama: string }>(
      `SELECT DISTINCT asrama
       FROM santri
       WHERE status_global = 'aktif' AND asrama IS NOT NULL AND TRIM(asrama) != ''
         AND ${nonBillableSantriSqlPredicate('asrama')}
       ORDER BY asrama ASC`
    ).catch(() => []),
    query<{ kelas_sekolah: string }>(
      `SELECT DISTINCT kelas_sekolah
       FROM santri
       WHERE status_global = 'aktif' AND kelas_sekolah IS NOT NULL AND TRIM(kelas_sekolah) != ''
         AND ${nonBillableSantriSqlPredicate('asrama')}
       ORDER BY kelas_sekolah ASC`
    ).catch(() => []),
    query<{ id: number; nama: string; is_active: number }>(
      `SELECT id, nama, is_active FROM tahun_ajaran ORDER BY nama DESC`
    ).catch(() => []),
  ])

  const asramaList = asramaRows.map(r => r.asrama)
  const kelasList = kRows.map(r => r.kelas_sekolah)

  // Susun daftar periode (12 bulan ke belakang hingga 6 bulan ke depan)
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

  let academicYearList: FilterOptionsResponse['academicYearList'] = taRows.map(r => ({
    value: r.nama.split('/')[0] || r.nama,
    label: r.nama,
  }))

  if (academicYearList.length === 0) {
    academicYearList = [
      { value: '2026', label: '2026/2027' },
      { value: '2025', label: '2025/2026' },
    ]
  }

  return {
    asramaList,
    kelasList,
    periodList,
    academicYearList,
    currentPeriod,
    userPermissions: permissions,
  }
}

// â”€â”€â”€ SERVER ACTION FASE 4B: DETAIL & DRILLDOWN SANTRI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface RawObligationDetailRow {
  id: string
  item_type: string
  period: string
  amount_expected: number
  amount_exempted: number
  status: string
  provider_id: string | null
  provider_name: string | null
  created_at: string
  updated_at: string
  gross_paid: number
  total_corr: number
}

/**
 * Mengambil rincian detail kewajiban finansial santri, drilldown per kategori,
 * coexistence tunggakan pra-cutover, histori pembayaran nyata, dan catatan koreksi.
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
    foto_url: string | null
    jenis_kelamin: string
    status_global: string
    asrama: string | null
    kamar: string | null
    kategori_santri: string | null
    tahun_masuk: number | null
    tanggal_masuk: string | null
    tempat_makan: string | null
    tempat_mencuci: string | null
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.foto_url, s.jenis_kelamin, s.status_global, s.asrama, s.kamar,
            s.kategori_santri,
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

  assertSantriBillable(santriRow.asrama, santriRow.nama_lengkap, santriRow.kategori_santri)

  const santri: StudentIdentityDetail = {
    id: santriRow.id,
    nis: santriRow.nis,
    namaLengkap: santriRow.nama_lengkap,
    fotoUrl: santriRow.foto_url,
    jenisKelamin: santriRow.jenis_kelamin,
    statusGlobal: santriRow.status_global,
    asrama: santriRow.asrama,
    kamar: santriRow.kamar,
    tahunMasuk: santriRow.tahun_masuk,
    tanggalMasuk: santriRow.tanggal_masuk,
    tempatMakan: santriRow.tempat_makan,
    tempatMencuci: santriRow.tempat_mencuci,
  }

  // 2. Ambil seluruh kewajiban santri dengan authoritative net allocation & corrections
  const grossSql = `(SELECT COALESCE(SUM(amount), 0) FROM finance_allocations WHERE obligation_id = o.id)`
  const corrSql = `(SELECT COALESCE(SUM(amount), 0) FROM finance_correction_items WHERE obligation_id = o.id)`

  const obligationRows = await query<RawObligationDetailRow>(
    `SELECT o.id, o.item_type, o.period, o.amount_expected, o.amount_exempted,
            o.status, o.provider_id, o.created_at, o.updated_at,
            m.nama_jasa AS provider_name,
            ${grossSql} as gross_paid,
            ${corrSql} as total_corr
     FROM finance_obligations o
     LEFT JOIN master_jasa m ON o.provider_id = m.id
     WHERE o.santri_id = ?
     ORDER BY o.period DESC, o.item_type ASC`,
    [santriId]
  )

  const mapObligation = (r: RawObligationDetailRow): ObligationBreakdownItem => {
    const expected = r.amount_expected ?? 0
    const exempted = r.amount_exempted ?? 0
    const netPaid = Math.max(0, (r.gross_paid ?? 0) - (r.total_corr ?? 0))
    const remaining = Math.max(0, expected - exempted - netPaid)
    const label = FINANCE_ITEM_LABELS[r.item_type as keyof typeof FINANCE_ITEM_LABELS] || r.item_type

    let computedStatus: FinanceObligationStatus = (r.status || 'UNPAID') as FinanceObligationStatus
    if (r.status === 'EXEMPTED' || (expected > 0 && exempted >= expected)) {
      computedStatus = 'EXEMPTED'
    } else if (remaining <= 0 && expected > 0) {
      computedStatus = 'PAID'
    } else if (netPaid > 0) {
      computedStatus = 'PARTIALLY_PAID'
    }

    return {
      id: r.id,
      itemType: r.item_type,
      itemLabel: label,
      period: r.period,
      periodLabel: formatPeriodLabel(r.period),
      amountExpected: expected,
      amountExempted: exempted,
      amountPaid: netPaid,
      remaining,
      status: computedStatus,
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

  // 4. Ambil histori cicilan khusus USPP (read-only, urut kronologis)
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
      method: normalizePaymentMethod(r.channel, r.method),
      amount: r.amount ?? 0,
      paidAt: r.paid_at,
      externalReference: r.external_reference,
    }))
  } catch (err: unknown) {
    console.error('[detail-drawer] Gagal membaca histori cicilan USPP:', err instanceof Error ? err.message : err)
  }

  // 5. Ambil histori pembayaran nyata secara PAYMENT-DRIVEN beserta rincian koreksi (read-only)
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

      // Ambil koreksi yang menargetkan pembayaran-pembayaran ini
      const corrMap = new Map<string, PaymentCorrectionItem[]>()
      try {
        const corrRows = await query<{
          id: string
          target_payment_id: string
          correction_number: string
          correction_type: 'VOID' | 'REVERSAL' | 'REFUND'
          total_amount: number
          method: string | null
          reason: string
          created_at: string
        }>(
          `SELECT id, target_payment_id, correction_number, correction_type, total_amount, method, reason, created_at
           FROM finance_corrections
           WHERE target_payment_id IN (${placeholders})
           ORDER BY created_at ASC`,
          paymentIds
        )

        for (const c of corrRows) {
          const cList = corrMap.get(c.target_payment_id) || []
          cList.push({
            id: c.id,
            correctionNumber: c.correction_number,
            correctionType: c.correction_type,
            amount: c.total_amount ?? 0,
            method: c.method,
            reason: c.reason,
            createdAt: c.created_at,
          })
          corrMap.set(c.target_payment_id, cList)
        }
      } catch (err: unknown) {
        console.error('[detail-drawer] Gagal membaca koreksi transaksi:', err)
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

        const paymentCorrections = corrMap.get(p.id) || []

        return {
          id: p.id,
          paymentNumber: p.payment_number,
          channel: p.channel,
          method: normalizePaymentMethod(p.channel, p.method),
          grossAmount,
          allocatedAmount: isUnallocated ? 0 : allocatedAmount,
          unallocatedAmount,
          allocationStatus: (p.allocation_status || 'ALLOCATED') as 'ALLOCATED' | 'PARTIALLY_ALLOCATED' | 'UNALLOCATED',
          allocationStatusLabel: statusLabel,
          status: p.status,
          paidAt: p.paid_at,
          externalReference: p.external_reference,
          allocations: isUnallocated ? [] : allocs,
          corrections: paymentCorrections.length > 0 ? paymentCorrections : undefined,
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

// â”€â”€â”€ SERVER ACTIONS FASE 4C: CATAT PEMBAYARAN TUNAI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    foto_url: string | null
    asrama: string | null
    kamar: string | null
  }>(
    `SELECT id, nis, nama_lengkap, foto_url, asrama, kamar
     FROM santri
     WHERE status_global = 'aktif'
       AND ${nonBillableSantriSqlPredicate('asrama')}
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
      fotoUrl: r.foto_url,
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
    foto_url: string | null
    jenis_kelamin: string
    status_global: string
    asrama: string | null
    kamar: string | null
    kategori_santri: string | null
    tahun_masuk: number | null
    tanggal_masuk: string | null
    tempat_makan: string | null
    tempat_mencuci: string | null
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.foto_url, s.jenis_kelamin, s.status_global, s.asrama, s.kamar,
            s.kategori_santri,
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
  assertSantriBillable(santriRow.asrama, santriRow.nama_lengkap, santriRow.kategori_santri)

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
      fotoUrl: santriRow.foto_url,
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
      const student = await queryOne<{ id: string; nis: string; nama_lengkap: string; status_global: string; asrama: string | null; kamar: string | null; kategori_santri: string | null }>(
        `SELECT id, nis, nama_lengkap, status_global, asrama, kamar, kategori_santri FROM santri WHERE id = ?`,
        [input.santriId]
      )
      if (!student) {
        throw new Error(`Santri dengan ID "${input.santriId}" tidak ditemukan.`)
      }
      if (student.status_global !== 'aktif') {
        throw new Error(`Santri berstatus "${student.status_global}", tidak dapat melakukan pembayaran.`)
      }
      assertSantriBillable(student.asrama, student.nama_lengkap, student.kategori_santri)

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
