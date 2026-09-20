// lib/finance/historical-backfill.ts
// Historical Obligation Reconstruction & Backfill Engine
//
// Purpose:
// Membangun atau merekonstruksi state kewajiban finansial santri secara otoritatif:
// - SPP: periode 2026-06 s.d. 2026-09 berdasarkan billing start masing-masing santri.
// - USPP: santri baru/terdaftar PSB 2026 atau yang memiliki opening balance.
// - Tahunan (EHB, EKSKUL, KESEHATAN): Tahun Ajaran 2026/2027 (periode 2026).
// - Memperhitungkan pembebasan biaya (finance_exemptions) & riwayat pembayaran (PRE_KOPERASI/KOPERASI).
// - Mendukung DRY-RUN (read-only) dan MUTASI (idempoten & non-destruktif).

import { query, queryOne, execute, generateId, now } from '@/lib/db'
import { getActiveTariff } from '@/lib/finance/tariffs'
import { computeObligationStatus } from '@/lib/finance/types'
import type { FinanceItemType, FinanceObligationStatus } from '@/lib/finance/types'

export interface BackfillStats {
  totalStudentsAnalyzed: number
  totalObligationsAnalyzed: number
  existingObligationsCount: number
  missingObligationsCount: number
  obligationsByItem: Record<string, number>
  obligationsByStatus: Record<string, number>
  totalExpectedAmount: number
  totalExemptedAmount: number
  totalPaidAmount: number
  totalRemainingAmount: number
  overpaymentsCount: number
  totalOverpaymentAmount: number
  fundManagementBreakdown: {
    preKoperasiGross: number
    koperasiGross: number
    totalGross: number
  }
  reconciliationSummary: {
    fullyPaidCount: number
    partiallyPaidCount: number
    unpaidCount: number
    exemptedCount: number
  }
}

export interface StudentBackfillReport {
  santriId: string
  nis: string
  namaLengkap: string
  kelas: string | null
  statusGlobal: string
  effectiveBillingStart: string
  totalObligations: number
  totalExpected: number
  totalExempted: number
  totalPaid: number
  totalRemaining: number
  statusSummary: Record<string, number>
  unpaidObligations: Array<{
    itemType: string
    period: string
    expected: number
    exempted: number
    paid: number
    remaining: number
    status: string
  }>
}

export interface RunBackfillOptions {
  dryRun?: boolean
  targetSantriId?: string
  sppPeriods?: string[] // default: ['2026-06', '2026-07', '2026-08', '2026-09']
  academicYearPeriod?: string // default: '2026'
}

export interface RunBackfillResult {
  dryRun: boolean
  executedAt: string
  stats: BackfillStats
  studentReports?: StudentBackfillReport[]
  sampleReports: StudentBackfillReport[]
}

const DEFAULT_SPP_PERIODS = ['2026-06', '2026-07', '2026-08', '2026-09']
const DEFAULT_ANNUAL_PERIOD = '2026'

/**
 * Menentukan apakah santri tergolong santri baru (PSB 2026/2027) atau memiliki kewajiban USPP.
 * Santri lama sebelum 2026-07-01 tanpa catatan opening balance dianggap telah lunas di era sebelumnya.
 */
async function getUsppLiableStudents(): Promise<Set<string>> {
  const liableSet = new Set<string>()

  // 1. Santri yang memiliki data di keuangan_non_spp_opening_balance (jika tabel ada)
  try {
    const obRows = await query<{ santri_id: string }>(
      `SELECT DISTINCT santri_id FROM keuangan_non_spp_opening_balance
       WHERE jenis_biaya IN ('USPP', 'BANGUNAN') AND nominal_tagihan > 0 AND COALESCE(status, 'AKTIF') = 'AKTIF'`
    )
    obRows.forEach((r) => liableSet.add(r.santri_id))
  } catch {
    // Tabel tidak ada, lanjutkan
  }

  // 2. Santri yang memiliki alur di psb_flow (jika tabel ada)
  try {
    const psbRows = await query<{ santri_id: string }>(
      `SELECT DISTINCT santri_id FROM psb_flow WHERE santri_id IS NOT NULL`
    )
    psbRows.forEach((r) => liableSet.add(r.santri_id))
  } catch {
    // Tabel tidak ada, lanjutkan
  }

  // 3. Santri aktif dengan tanggal_masuk >= 2026-06-01 atau tahun_masuk >= 2026
  try {
    const newStudents = await query<{ id: string }>(
      `SELECT id FROM santri
       WHERE status_global = 'aktif'
         AND (
           tahun_masuk >= 2026
           OR (tanggal_masuk IS NOT NULL AND tanggal_masuk >= '2026-06-01')
           OR (created_at IS NOT NULL AND created_at >= '2026-06-01')
         )`
    )
    newStudents.forEach((r) => liableSet.add(r.id))
  } catch {
    // Abaikan jika query gagal
  }

  return liableSet
}

/**
 * Menghitung dan merekonstruksi seluruh kewajiban finansial santri.
 * Jika dryRun = true, proses hanya menghitung simulasi di memori tanpa memutasi DB.
 */
export async function runHistoricalBackfill(
  options: RunBackfillOptions = {}
): Promise<RunBackfillResult> {
  const dryRun = options.dryRun !== false // default: true
  const sppPeriods = options.sppPeriods || DEFAULT_SPP_PERIODS
  const annualPeriod = options.academicYearPeriod || DEFAULT_ANNUAL_PERIOD
  const timestamp = now()

  // 1. Ambil Tahun Ajaran Aktif (2026/2027)
  const activeTa = await queryOne<{ id: number; nama: string }>(
    `SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1`
  ).catch(() => null)
  const academicYearId = activeTa?.id ?? null

  // 2. Resolve Base Tariffs
  // SPP tariff per period (menggunakan getActiveTariff yang otomatis mempertimbangkan override)
  const sppTariffs: Record<string, { id: string | null; nominal: number }> = {}
  for (const p of sppPeriods) {
    const t = await getActiveTariff('SPP', p, academicYearId).catch(() => null)
    sppTariffs[p] = {
      id: t?.id ?? null,
      nominal: t?.nominal ?? 70000,
    }
  }

  // Tariffs untuk USPP dan Biaya Tahunan (sesuai standar kanonikal)
  const [usppTariff, ehbTariff, ekskulTariff, kesehatanTariff] = await Promise.all([
    getActiveTariff('USPP', 'LIFETIME', null).catch(() => null),
    getActiveTariff('EHB', annualPeriod, academicYearId).catch(() => null),
    getActiveTariff('EKSKUL', annualPeriod, academicYearId).catch(() => null),
    getActiveTariff('KESEHATAN', annualPeriod, academicYearId).catch(() => null),
  ])

  const tariffMap: Record<string, { id: string | null; nominal: number }> = {
    USPP: { id: usppTariff?.id ?? null, nominal: usppTariff?.nominal ?? 1000000 },
    EHB: { id: ehbTariff?.id ?? null, nominal: ehbTariff?.nominal ?? 100000 },
    EKSKUL: { id: ekskulTariff?.id ?? null, nominal: ekskulTariff?.nominal ?? 50000 },
    KESEHATAN: { id: kesehatanTariff?.id ?? null, nominal: kesehatanTariff?.nominal ?? 200000 },
  }

  // 3. Ambil Santri Liable USPP
  const usppLiableSet = await getUsppLiableStudents()

  // 3b. Ambil Tunggakan SPP Historis BELUM_LUNAS (Blocker 2: SPP sebelum spp_tagihan_mulai)
  const unpaidHistSppRows = await query<{
    id: string
    santri_id: string
    tahun: number
    bulan: number
    nominal_tagihan: number
  }>(
    `SELECT id, santri_id, tahun, bulan, nominal_tagihan
     FROM spp_tunggakan_historis
     WHERE status = 'BELUM_LUNAS'`
  ).catch(() => [])

  // 4. Query Global SPP Tagihan Mulai & Santri yang Diproses
  const globalSppRow = await queryOne<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'spp_tagihan_mulai'`
  ).catch(() => null)
  const globalSppStart = globalSppRow?.value?.trim() || '2026-06'

  let santriQuery = `
    SELECT id, nis, nama_lengkap, status_global, kelas_sekolah,
           tanggal_masuk, created_at, tahun_masuk
    FROM santri
    WHERE status_global = 'aktif'
  `
  const santriParams: unknown[] = []
  if (options.targetSantriId) {
    santriQuery += ` AND id = ?`
    santriParams.push(options.targetSantriId)
  }
  santriQuery += ` ORDER BY nama_lengkap ASC`

  const students = await query<{
    id: string
    nis: string
    nama_lengkap: string
    status_global: string
    kelas_sekolah: string | null
    tanggal_masuk: string | null
    created_at: string | null
    tahun_masuk: number | null
  }>(santriQuery, santriParams)

  // 5. Pre-load Existing Obligations, Payments, and Exemptions
  const existingObligations = await query<{
    id: string
    santri_id: string
    item_type: FinanceItemType
    period: string
    tariff_id: string | null
    amount_expected: number
    amount_exempted: number
    amount_paid: number
    status: FinanceObligationStatus
  }>(
    `SELECT id, santri_id, item_type, period, tariff_id,
            amount_expected, amount_exempted, amount_paid, status
     FROM finance_obligations`
  ).catch(() => [])

  // Map existing obligations by `${santri_id}:${item_type}:${period}`
  const existingMap = new Map<string, typeof existingObligations[0]>()
  existingObligations.forEach((ob) => {
    existingMap.set(`${ob.santri_id}:${ob.item_type}:${ob.period}`, ob)
  })

  // Pre-load payment allocations per obligation
  const allocations = await query<{
    obligation_id: string
    total_paid: number
  }>(
    `SELECT obligation_id, COALESCE(SUM(amount), 0) AS total_paid
     FROM finance_allocations
     WHERE obligation_id IS NOT NULL
     GROUP BY obligation_id`
  ).catch(() => [])
  const allocationMap = new Map<string, number>()
  allocations.forEach((a) => allocationMap.set(a.obligation_id, a.total_paid))

  // Pre-load direct legacy payment mappings if available (fallback)
  const legacyPaymentSums = await query<{
    santri_id: string
    item_type: string
    period: string
    total_paid: number
  }>(
    `SELECT p.santri_id,
            COALESCE(a.item_type, 'SPP') AS item_type,
            COALESCE(o.period, '2026-07') AS period,
            COALESCE(SUM(a.amount), 0) AS total_paid
     FROM finance_payments p
     JOIN finance_allocations a ON a.payment_id = p.id
     LEFT JOIN finance_obligations o ON o.id = a.obligation_id
     WHERE p.status IN ('PAID', 'SETTLED')
     GROUP BY p.santri_id, a.item_type, o.period`
  ).catch(() => [])
  const paymentSumMap = new Map<string, number>()
  legacyPaymentSums.forEach((s) => {
    paymentSumMap.set(`${s.santri_id}:${s.item_type}:${s.period}`, s.total_paid)
  })

  // Pre-load Gross Payments by Fund Management
  const fundMgmtRows = await query<{
    fund_management: string
    total_gross: number
  }>(
    `SELECT fund_management, COALESCE(SUM(gross_amount), 0) AS total_gross
     FROM finance_payments
     WHERE status IN ('PAID', 'SETTLED')
     GROUP BY fund_management`
  ).catch(() => [])

  let preKoperasiGross = 0
  let koperasiGross = 0
  fundMgmtRows.forEach((r) => {
    if (r.fund_management === 'KOPERASI') {
      koperasiGross = r.total_gross
    } else {
      preKoperasiGross += r.total_gross
    }
  })

  // Pre-load active exemptions
  const activeExemptions = await query<{
    santri_id: string
    item_type: string
    period_start: string | null
    period_end: string | null
  }>(
    `SELECT santri_id, item_type, period_start, period_end
     FROM finance_exemptions
     WHERE status = 'ACTIVE'`
  ).catch(() => [])

  // Helper to check exemption in memory
  const hasActiveExemption = (santriId: string, itemType: string, period: string): boolean => {
    return activeExemptions.some((ex) => {
      if (ex.santri_id !== santriId) return false
      if (ex.item_type !== 'ALL' && ex.item_type !== itemType) return false
      if (ex.period_start && period < ex.period_start) return false
      if (ex.period_end && period > ex.period_end) return false
      return true
    })
  }

  // 6. Loop Process Every Student
  let totalObligationsCount = 0
  let existingObligationsMatched = 0
  let missingObligationsCount = 0
  let totalExpected = 0
  let totalExempted = 0
  let totalPaid = 0
  let totalRemaining = 0
  let overpaymentsCount = 0
  let totalOverpayment = 0

  const obligationsByItem: Record<string, number> = {
    SPP: 0,
    USPP: 0,
    EHB: 0,
    EKSKUL: 0,
    KESEHATAN: 0,
    UANG_MAKAN: 0,
    UANG_NYUCI: 0,
  }

  const obligationsByStatus: Record<string, number> = {
    PAID: 0,
    PARTIALLY_PAID: 0,
    UNPAID: 0,
    EXEMPTED: 0,
    VOID: 0,
  }

  const studentReports: StudentBackfillReport[] = []

  for (const s of students) {
    // Tentukan billing start santri (efektif: max(globalSppStart, tanggal_masuk, created_at))
    let studentEntry = s.tanggal_masuk?.trim() || s.created_at?.trim() || globalSppStart
    if (studentEntry.length > 7) studentEntry = studentEntry.slice(0, 7)
    const billingStart = (studentEntry > globalSppStart && /^\d{4}-\d{2}$/.test(studentEntry))
      ? studentEntry
      : globalSppStart

    const studentReport: StudentBackfillReport = {
      santriId: s.id,
      nis: s.nis,
      namaLengkap: s.nama_lengkap,
      kelas: s.kelas_sekolah,
      statusGlobal: s.status_global,
      effectiveBillingStart: billingStart,
      totalObligations: 0,
      totalExpected: 0,
      totalExempted: 0,
      totalPaid: 0,
      totalRemaining: 0,
      statusSummary: { PAID: 0, PARTIALLY_PAID: 0, UNPAID: 0, EXEMPTED: 0 },
      unpaidObligations: [],
    }

    // List target items for this student:
    // A. SPP per valid month
    const studentItems: Array<{
      itemType: FinanceItemType
      period: string
      tariff: { id: string | null; nominal: number }
    }> = []

    for (const p of sppPeriods) {
      if (p >= billingStart) {
        studentItems.push({
          itemType: 'SPP',
          period: p,
          tariff: sppTariffs[p],
        })
      }
    }

    // A2. SPP Tunggakan Historis Belum Lunas (sebelum spp_tagihan_mulai)
    const studentHistUnpaid = unpaidHistSppRows.filter((h) => h.santri_id === s.id)
    for (const h of studentHistUnpaid) {
      const histPeriod = `${h.tahun}-${String(h.bulan).padStart(2, '0')}`
      // Pastikan tidak menduplikasi jika periode kebetulan ada di sppPeriods
      if (!studentItems.some((it) => it.itemType === 'SPP' && it.period === histPeriod)) {
        studentItems.push({
          itemType: 'SPP',
          period: histPeriod,
          tariff: { id: null, nominal: h.nominal_tagihan },
        })
      }
    }

    // B. USPP (hanya jika liable)
    if (usppLiableSet.has(s.id)) {
      studentItems.push({
        itemType: 'USPP',
        period: 'LIFETIME',
        tariff: tariffMap.USPP,
      })
    }

    // C. Biaya Tahunan (EHB, EKSKUL, KESEHATAN) untuk 2026/2027
    studentItems.push({
      itemType: 'EHB',
      period: annualPeriod,
      tariff: tariffMap.EHB,
    })
    studentItems.push({
      itemType: 'EKSKUL',
      period: annualPeriod,
      tariff: tariffMap.EKSKUL,
    })
    studentItems.push({
      itemType: 'KESEHATAN',
      period: annualPeriod,
      tariff: tariffMap.KESEHATAN,
    })

    // Evaluasi masing-masing item
    for (const item of studentItems) {
      totalObligationsCount++
      obligationsByItem[item.itemType] = (obligationsByItem[item.itemType] || 0) + 1

      const key = `${s.id}:${item.itemType}:${item.period}`
      const existingOb = existingMap.get(key)

      let obId = existingOb?.id
      const expectedAmount = existingOb?.amount_expected ?? item.tariff.nominal
      let paidAmount = 0

      if (existingOb) {
        existingObligationsMatched++
        paidAmount = allocationMap.get(existingOb.id) ?? existingOb.amount_paid ?? 0
      } else {
        missingObligationsCount++
        paidAmount = paymentSumMap.get(key) ?? 0
      }

      // Evaluasi pembebasan biaya (dengan proteksi cicilan sebagian / Blocker 6)
      const isExempt = hasActiveExemption(s.id, item.itemType, item.period)
      let exemptedAmount = 0
      if (isExempt) {
        if (paidAmount === 0) {
          exemptedAmount = expectedAmount
        } else if (paidAmount >= expectedAmount) {
          exemptedAmount = 0 // Sudah lunas, riwayat pembayaran tetap utuh
        } else {
          // Tagihan cicilan sebagian (0 < paidAmount < expectedAmount):
          // REVIEW_REQUIRED: Tidak dieksekusi pembebasan otomatis demi keamanan audit
          exemptedAmount = existingOb?.amount_exempted ?? 0
        }
      } else if (existingOb && existingOb.amount_exempted > 0) {
        exemptedAmount = existingOb.amount_exempted
      }

      // Hitung status kanonikal
      const remainingAmount = Math.max(0, expectedAmount - exemptedAmount - paidAmount)
      let status: FinanceObligationStatus = computeObligationStatus(
        expectedAmount,
        exemptedAmount,
        paidAmount
      )

      if (isExempt && paidAmount === 0) {
        status = 'EXEMPTED'
        exemptedAmount = expectedAmount
      }

      // Deteksi overpayment
      if (paidAmount > expectedAmount) {
        overpaymentsCount++
        totalOverpayment += paidAmount - expectedAmount
      }

      // Update akumulasi
      obligationsByStatus[status] = (obligationsByStatus[status] || 0) + 1
      totalExpected += expectedAmount
      totalExempted += exemptedAmount
      totalPaid += paidAmount
      totalRemaining += remainingAmount

      // Update student report
      studentReport.totalObligations++
      studentReport.totalExpected += expectedAmount
      studentReport.totalExempted += exemptedAmount
      studentReport.totalPaid += paidAmount
      studentReport.totalRemaining += remainingAmount
      studentReport.statusSummary[status] = (studentReport.statusSummary[status] || 0) + 1

      if (remainingAmount > 0) {
        studentReport.unpaidObligations.push({
          itemType: item.itemType,
          period: item.period,
          expected: expectedAmount,
          exempted: exemptedAmount,
          paid: paidAmount,
          remaining: remainingAmount,
          status,
        })
      }

      // Jika mutasi diizinkan (dryRun === false)
      if (!dryRun) {
        if (!existingOb) {
          obId = generateId()
          await execute(
            `INSERT INTO finance_obligations (
               id, santri_id, item_type, academic_year_id, period,
               tariff_id, amount_expected, amount_exempted, amount_paid,
               status, provider_id, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
            [
              obId,
              s.id,
              item.itemType,
              academicYearId,
              item.period,
              item.tariff.id,
              expectedAmount,
              exemptedAmount,
              paidAmount,
              status,
              timestamp,
              timestamp,
            ]
          )
        } else if (
          existingOb.amount_exempted !== exemptedAmount ||
          existingOb.status !== status ||
          existingOb.amount_paid !== paidAmount
        ) {
          await execute(
            `UPDATE finance_obligations
             SET amount_exempted = ?, amount_paid = ?, status = ?, updated_at = ?
             WHERE id = ?`,
            [exemptedAmount, paidAmount, status, timestamp, existingOb.id]
          )
        }
      }
    }

    studentReports.push(studentReport)
  }

  const stats: BackfillStats = {
    totalStudentsAnalyzed: students.length,
    totalObligationsAnalyzed: totalObligationsCount,
    existingObligationsCount: existingObligationsMatched,
    missingObligationsCount,
    obligationsByItem,
    obligationsByStatus,
    totalExpectedAmount: totalExpected,
    totalExemptedAmount: totalExempted,
    totalPaidAmount: totalPaid,
    totalRemainingAmount: totalRemaining,
    overpaymentsCount,
    totalOverpaymentAmount: totalOverpayment,
    fundManagementBreakdown: {
      preKoperasiGross,
      koperasiGross,
      totalGross: preKoperasiGross + koperasiGross,
    },
    reconciliationSummary: {
      fullyPaidCount: obligationsByStatus.PAID || 0,
      partiallyPaidCount: obligationsByStatus.PARTIALLY_PAID || 0,
      unpaidCount: obligationsByStatus.UNPAID || 0,
      exemptedCount: obligationsByStatus.EXEMPTED || 0,
    },
  }

  return {
    dryRun,
    executedAt: timestamp,
    stats,
    studentReports: options.targetSantriId ? studentReports : undefined,
    sampleReports: studentReports.slice(0, 10),
  }
}
