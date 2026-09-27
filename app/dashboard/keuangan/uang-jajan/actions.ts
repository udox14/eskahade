'use server'

import { query, queryOne } from '@/lib/db'
import {
  getSession,
  getEffectiveRoles,
  hasFinanceMutateRole,
  isDemoSandboxRequest,
} from '@/lib/auth/session'
import {
  getStudentWalletBalance,
  recalculateStudentWallet,
  getWalletLedgerHistory,
  evaluateWalletLimit,
  setParentWalletLimits,
  type FinanceWalletLedgerEntry,
  type WalletLimitEvaluation,
} from '@/lib/finance/wallet'
import {
  assertSantriBillable,
  nonBillableSantriSqlPredicate,
} from '@/lib/finance/non-billable-santri'

export interface StudentWalletRow {
  id: string
  nis: string
  namaLengkap: string
  asrama: string | null
  kamar: string | null
  fotoUrl: string | null
  saldoUangJajan: number
  cachedSaldo: number
  isSynced: boolean
  effectiveDailyLimit: number
  parentDailyLimit: number | null
  parentWeeklyLimit: number | null
  parentMonthlyLimit: number | null
  withdrawnToday: number
  remainingDailyQuota: number
  lastTransactionAt: string | null
  lastTransactionType: string | null
  lastTransactionAmount: number | null
  lastTransactionDirection: 'IN' | 'OUT' | null
}

export interface UangJajanKpi {
  totalSaldoTitipan: number
  santriBersaldoCount: number
  mutasiInBulanIniNominal: number
  mutasiOutBulanIniNominal: number
}

export interface UangJajanQueryParams {
  search?: string
  asrama?: string
  saldoFilter?: 'ALL' | 'BER_SALDO' | 'SALDO_KOSONG'
  page?: number
  pageSize?: number
}

export interface UangJajanResponse {
  items: StudentWalletRow[]
  kpi: UangJajanKpi
  pagination: {
    currentPage: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  asramaList: string[]
  userPermissions: {
    canView: boolean
    canMutate: boolean
    role: string
  }
}

export interface StudentWalletDetailResponse {
  santri: {
    id: string
    nis: string
    namaLengkap: string
    asrama: string | null
    kamar: string | null
    fotoUrl: string | null
    statusGlobal: string
  }
  balance: {
    authoritative: number
    cached: number
    isSynced: boolean
  }
  limits: WalletLimitEvaluation
  ledgerHistory: FinanceWalletLedgerEntry[]
  totalLedgerCount: number
}

const ALLOWED_VIEW_ROLES = [
  'admin',
  'bendahara',
  'admin_koperasi',
  'petugas_koperasi',
  'pimpinan',
  'tester',
  'demo',
]

async function authorizeUser(): Promise<{
  userId: string
  roles: string[]
  canMutate: boolean
}> {
  const session = await getSession()
  if (!session) {
    throw new Error('Sesi telah berakhir. Silakan masuk kembali.')
  }

  const roles = getEffectiveRoles(session)
  const hasViewAccess = roles.some(r => ALLOWED_VIEW_ROLES.includes(r))
  if (!hasViewAccess) {
    throw new Error('Akses ditolak: Anda tidak memiliki hak akses modul Uang Jajan.')
  }

  // Role 'demo' hanya boleh menulis bila request benar-benar dilayani DEMO_DB.
  const demoRunsInSandbox = isDemoSandboxRequest(session)
  const isViewOnly = roles.includes('pimpinan') || roles.includes('tester')
  const canMutate = !isViewOnly && hasFinanceMutateRole(roles, demoRunsInSandbox)

  return {
    userId: session.id,
    roles,
    canMutate,
  }
}

/**
 * Mengambil dataset utama Modul Uang Jajan:
 * - KPI dihitung di atas seluruh dataset santri aktif SEBELUM filter pagination.
 * - Mendukung pencarian, filter asrama, dan filter status saldo.
 */
export async function getUangJajanData(
  params: UangJajanQueryParams
): Promise<UangJajanResponse> {
  const auth = await authorizeUser()

  const search = (params.search || '').trim()
  const asramaFilter = (params.asrama || 'ALL').trim()
  const saldoFilter = params.saldoFilter || 'ALL'
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize || 50))
  const offset = (page - 1) * pageSize

  // 1. Bangun query filter untuk count & paginasi
  const conditions: string[] = [
    "s.status_global = 'aktif'",
    nonBillableSantriSqlPredicate('s.asrama'),
  ]
  const queryParams: unknown[] = []

  if (search) {
    conditions.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    queryParams.push(`%${search}%`, `%${search}%`)
  }

  if (asramaFilter !== 'ALL') {
    conditions.push('s.asrama = ?')
    queryParams.push(asramaFilter)
  }

  if (saldoFilter === 'BER_SALDO') {
    conditions.push('COALESCE(s.saldo_uang_jajan, 0) > 0')
  } else if (saldoFilter === 'SALDO_KOSONG') {
    conditions.push('COALESCE(s.saldo_uang_jajan, 0) <= 0')
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const currentMonthPrefix = new Date().toISOString().slice(0, 7) // YYYY-MM

  // 2. Eksekusi KPI global, daftar asrama, total rows, dan setting limit secara paralel
  const [
    kpiTotalSaldoRow,
    kpiMutasiBulanIniRow,
    asramaRows,
    countRow,
    globalDailyLimitRow,
  ] = await Promise.all([
    queryOne<{ total: number; count_bersaldo: number }>(
      `SELECT
         COALESCE(SUM(saldo_uang_jajan), 0) AS total,
         COALESCE(SUM(CASE WHEN saldo_uang_jajan > 0 THEN 1 ELSE 0 END), 0) AS count_bersaldo
       FROM santri
       WHERE status_global = 'aktif'
         AND ${nonBillableSantriSqlPredicate('asrama')}`
    ),
    queryOne<{ total_in: number; total_out: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) AS total_in,
         COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS total_out
       FROM finance_wallet_ledger
       WHERE strftime('%Y-%m', created_at) = ?`,
      [currentMonthPrefix]
    ),
    query<{ asrama: string }>(
      `SELECT DISTINCT asrama FROM santri
       WHERE status_global = 'aktif' AND asrama IS NOT NULL AND TRIM(asrama) != ''
         AND ${nonBillableSantriSqlPredicate('asrama')}
       ORDER BY asrama ASC`
    ),
    queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM santri s ${whereClause}`,
      queryParams
    ),
    queryOne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'uang_jajan_global_daily_limit'`
    ),
  ])

  const kpi: UangJajanKpi = {
    totalSaldoTitipan: kpiTotalSaldoRow?.total ?? 0,
    santriBersaldoCount: kpiTotalSaldoRow?.count_bersaldo ?? 0,
    mutasiInBulanIniNominal: kpiMutasiBulanIniRow?.total_in ?? 0,
    mutasiOutBulanIniNominal: kpiMutasiBulanIniRow?.total_out ?? 0,
  }

  const asramaList = asramaRows.map(r => r.asrama)
  const totalItems = countRow?.total ?? 0
  const totalPages = Math.ceil(totalItems / pageSize) || 1
  const globalDailyLimit = globalDailyLimitRow?.value ? parseInt(globalDailyLimitRow.value, 10) : 100000

  const studentRows = await query<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    foto_url: string | null
    saldo_uang_jajan: number
    parent_daily_limit: number | null
    parent_weekly_limit: number | null
    parent_monthly_limit: number | null
    last_tx_at: string | null
    last_tx_type: string | null
    last_tx_amount: number | null
    last_tx_direction: 'IN' | 'OUT' | null
    withdrawn_today: number
  }>(
    `SELECT
       s.id,
       s.nis,
       s.nama_lengkap,
       s.asrama,
       s.kamar,
       s.foto_url,
       COALESCE(s.saldo_uang_jajan, 0) AS saldo_uang_jajan,
       wl.parent_daily_limit,
       wl.parent_weekly_limit,
       wl.parent_monthly_limit,
       latest.created_at AS last_tx_at,
       latest.movement_type AS last_tx_type,
       latest.amount AS last_tx_amount,
       latest.direction AS last_tx_direction,
       COALESCE(wt.withdrawn_today, 0) AS withdrawn_today
     FROM santri s
     LEFT JOIN finance_wallet_limits wl ON wl.santri_id = s.id
     LEFT JOIN (
       SELECT l1.santri_id, l1.created_at, l1.movement_type, l1.amount, l1.direction
       FROM finance_wallet_ledger l1
       INNER JOIN (
         SELECT santri_id, MAX(created_at) AS max_date
         FROM finance_wallet_ledger
         GROUP BY santri_id
       ) l2 ON l1.santri_id = l2.santri_id AND l1.created_at = l2.max_date
     ) latest ON latest.santri_id = s.id
     LEFT JOIN (
       SELECT santri_id, SUM(amount) AS withdrawn_today
       FROM finance_wallet_ledger
       WHERE direction = 'OUT' AND movement_type = 'WITHDRAWAL_LOKET'
         AND date(created_at, 'localtime') = date('now', 'localtime')
       GROUP BY santri_id
     ) wt ON wt.santri_id = s.id
     ${whereClause}
     ORDER BY s.nama_lengkap ASC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  )

  const items: StudentWalletRow[] = studentRows.map(row => {
    const parentDaily = row.parent_daily_limit ?? null
    const effectiveDaily = parentDaily !== null ? Math.min(globalDailyLimit, parentDaily) : globalDailyLimit
    const remainingQuota = Math.max(0, effectiveDaily - (row.withdrawn_today || 0))

    return {
      id: row.id,
      nis: row.nis,
      namaLengkap: row.nama_lengkap,
      asrama: row.asrama,
      kamar: row.kamar,
      fotoUrl: row.foto_url,
      saldoUangJajan: row.saldo_uang_jajan,
      cachedSaldo: row.saldo_uang_jajan,
      isSynced: true,
      effectiveDailyLimit: effectiveDaily,
      parentDailyLimit: parentDaily,
      parentWeeklyLimit: row.parent_weekly_limit ?? null,
      parentMonthlyLimit: row.parent_monthly_limit ?? null,
      withdrawnToday: row.withdrawn_today || 0,
      remainingDailyQuota: remainingQuota,
      lastTransactionAt: row.last_tx_at,
      lastTransactionType: row.last_tx_type,
      lastTransactionAmount: row.last_tx_amount,
      lastTransactionDirection: row.last_tx_direction,
    }
  })

  return {
    items,
    kpi,
    pagination: {
      currentPage: page,
      pageSize,
      totalItems,
      totalPages,
    },
    asramaList,
    userPermissions: {
      canView: true,
      canMutate: auth.canMutate,
      role: auth.roles[0] || 'guest',
    },
  }
}

/**
 * Mengambil rincian detail santri untuk slide-over drawer:
 * - Saldo authoritatif vs saldo cache
 * - Evaluasi limit lengkap
 * - Histori mutasi buku besar
 */
export async function getStudentWalletDetail(
  santriId: string,
  page: number = 1
): Promise<StudentWalletDetailResponse> {
  await authorizeUser()

  const student = await queryOne<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    foto_url: string | null
    status_global: string
    kategori_santri: string | null
  }>(
    `SELECT id, nis, nama_lengkap, asrama, kamar, foto_url, status_global, kategori_santri
     FROM santri WHERE id = ?`,
    [santriId]
  )

  if (!student) {
    throw new Error(`Santri dengan ID "${santriId}" tidak ditemukan.`)
  }
  assertSantriBillable(student.asrama, student.nama_lengkap, student.kategori_santri)

  const { balance, cachedBalance } = await getStudentWalletBalance(santriId)
  const limits = await evaluateWalletLimit(santriId)
  const { items: ledgerHistory, total: totalLedgerCount } = await getWalletLedgerHistory(santriId, {
    page,
    pageSize: 30,
  })

  return {
    santri: {
      id: student.id,
      nis: student.nis,
      namaLengkap: student.nama_lengkap,
      asrama: student.asrama,
      kamar: student.kamar,
      fotoUrl: student.foto_url,
      statusGlobal: student.status_global,
    },
    balance: {
      authoritative: balance,
      cached: cachedBalance,
      isSynced: balance === cachedBalance,
    },
    limits,
    ledgerHistory,
    totalLedgerCount,
  }
}

/**
 * Server action untuk memicu sinkronisasi/rekalkulasi saldo uang jajan santri.
 */
export async function recalculateStudentWalletAction(
  santriId: string
): Promise<{ success: boolean; newBalance: number }> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  const newBalance = await recalculateStudentWallet(santriId)
  return { success: true, newBalance }
}

/**
 * Server action untuk menyimpan / memperbarui limit orang tua santri.
 */
export async function saveParentLimitsAction(
  santriId: string,
  limits: {
    daily?: number | null
    weekly?: number | null
    monthly?: number | null
  }
): Promise<{ success: boolean }> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  await setParentWalletLimits(santriId, limits, auth.userId)
  return { success: true }
}
