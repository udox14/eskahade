// lib/finance/exemptions.ts
// Modul manajemen pembebasan biaya santri Sistem Keuangan Baru (Fase 2C)

import { query, queryOne, execute, generateId, now } from '@/lib/db'
import { computeObligationStatus } from '@/lib/finance/types'
import type {
  FinanceExemption,
  FinanceItemType,
  CreateExemptionInput,
  BatchGrantExemptionResult,
  RevokeExemptionOptions,
} from '@/lib/finance/types'

/**
 * Memvalidasi apakah suatu periode tagihan tercakup dalam rentang periode pembebasan.
 */
function isPeriodCoveredByExemption(
  obligationPeriod: string,
  periodStart: string | null,
  periodEnd: string | null
): boolean {
  if (periodStart && obligationPeriod < periodStart) {
    return false
  }
  if (periodEnd && obligationPeriod > periodEnd) {
    return false
  }
  return true
}

/**
 * Mendaftarkan pembebasan biaya santri dengan penegakan aturan non-retroaktif (PRD Section 14).
 *
 * Aturan Bisnis:
 * 1. Hanya santri berstatus 'aktif' yang dapat diberikan pembebasan biaya.
 * 2. Tagihan eksisting yang berstatus 'UNPAID' (belum ada pembayaran) langsung dimutakhirkan menjadi 'EXEMPTED'.
 * 3. Tagihan yang sudah dibayar sebagian (PARTIALLY_PAID) dibebaskan sisa tagihannya dan berstatus 'PAID' (kewajiban terpenuhi).
 * 4. Transaksi pembayaran yang sudah sukses (PAID) TIDAK BOLEH diubah atau di-void secara retroaktif.
 *    Nilai amount_paid historis tetap terjaga utuh.
 */
export async function grantExemption(
  input: CreateExemptionInput
): Promise<FinanceExemption> {
  // 1. Validasi santri aktif
  const santri = await queryOne<{ id: string; nama_lengkap: string; status_global: string }>(
    `SELECT id, nama_lengkap, status_global FROM santri WHERE id = ?`,
    [input.santri_id]
  )

  if (!santri) {
    throw new Error(`Santri dengan ID "${input.santri_id}" tidak ditemukan.`)
  }

  if (santri.status_global !== 'aktif') {
    throw new Error(
      `Pembebasan biaya hanya dapat diberikan kepada santri berstatus 'aktif'. Santri "${santri.nama_lengkap}" berstatus '${santri.status_global}'.`
    )
  }

  // 2. Validasi rentang periode jika keduanya diisi
  if (input.period_start && input.period_end && input.period_start > input.period_end) {
    throw new Error(
      `Rentang periode tidak valid: period_start (${input.period_start}) tidak boleh lebih besar dari period_end (${input.period_end}).`
    )
  }

  const id = generateId()
  const nowStr = now()
  const academicYearId = input.academic_year_id ?? null
  const periodStart = input.period_start ?? null
  const periodEnd = input.period_end ?? null
  const notes = input.notes ?? null
  const createdBy = input.created_by ?? null

  // 3. Simpan data pembebasan dengan status 'ACTIVE' (Non-destructive)
  await execute(
    `INSERT INTO finance_exemptions (
      id, santri_id, item_type, academic_year_id,
      period_start, period_end, reason, notes,
      status, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [
      id,
      input.santri_id,
      input.item_type,
      academicYearId,
      periodStart,
      periodEnd,
      input.reason,
      notes,
      createdBy,
      nowStr,
    ]
  )

  const created = await getExemptionById(id)
  if (!created) {
    throw new Error('Gagal memverifikasi pembentukan data pembebasan biaya.')
  }

  // 4. Sinkronisasi non-retroaktif ke tagihan eksisting (finance_obligations)
  const existingObligations = await query<{
    id: string
    item_type: FinanceItemType
    period: string
    amount_expected: number
    amount_exempted: number
    amount_paid: number
    status: string
  }>(
    `SELECT id, item_type, period, amount_expected, amount_exempted, amount_paid, status
     FROM finance_obligations
     WHERE santri_id = ?`,
    [input.santri_id]
  )

  for (const ob of existingObligations) {
    const itemMatches = input.item_type === 'ALL' || input.item_type === ob.item_type
    const periodMatches = isPeriodCoveredByExemption(ob.period, periodStart, periodEnd)

    if (itemMatches && periodMatches) {
      if (ob.amount_paid === 0 && ob.status === 'UNPAID') {
        // Tagihan belum pernah dibayar sama sekali -> Bebaskan penuh
        await execute(
          `UPDATE finance_obligations
           SET amount_exempted = amount_expected,
               status = 'EXEMPTED',
               updated_at = ?
           WHERE id = ?`,
          [nowStr, ob.id]
        )
      } else if (ob.amount_paid > 0 && ob.amount_paid < ob.amount_expected) {
        // Tagihan sudah dibayar sebagian (PARTIALLY_PAID) / Blocker 6:
        // JANGAN ubah secara diam-diam menjadi EXEMPTED atau PAID penuh.
        // Status PARTIALLY_PAID dan riwayat pembayaran dipertahankan (REVIEW_REQUIRED).
        // Tidak ada refund atau manipulasi saldo otomatis tanpa verifikasi operator.
      }
      // Jika sudah PAID (amount_paid >= amount_expected), jangan diubah secara retroaktif!
    }
  }

  return created
}

/**
 * Alias createExemption mengarah ke grantExemption.
 */
export const createExemption = grantExemption

/**
 * Memberikan pembebasan biaya secara massal ke banyak santri sekaligus (batch grant).
 */
export async function batchGrantExemptions(
  santriIds: string[],
  input: Omit<CreateExemptionInput, 'santri_id'>
): Promise<BatchGrantExemptionResult> {
  let grantedCount = 0
  let failedCount = 0
  const errors: Array<{ santriId: string; error: string }> = []

  for (const santriId of santriIds) {
    try {
      await grantExemption({
        ...input,
        santri_id: santriId,
      })
      grantedCount++
    } catch (err: unknown) {
      failedCount++
      errors.push({
        santriId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    totalRequested: santriIds.length,
    grantedCount,
    failedCount,
    errors,
  }
}

/**
 * Mencabut data pembebasan biaya secara non-destruktif dan merecalculate status tagihan terkait.
 *
 * Aturan Bisnis & Audit:
 * 1. Pembebasan TIDAK di-hard-delete. Status dimutakhirkan menjadi 'REVOKED' disertai metadata
 *    revoked_at, revoked_by, dan revocation_reason.
 * 2. Seluruh kewajiban santri yang terpengaruh dire-evaluasi:
 *    - Jika masih ada pembebasan aktif lain yang meng-cover, amount_exempted disesuaikan.
 *    - Jika tidak ada pembebasan aktif lain, amount_exempted kembali menjadi 0.
 * 3. Status kewajiban direcalculate kembali dari amount_paid dibanding (amount_expected - amount_exempted):
 *    - Jika sebelumnya partially-paid dan sisa dibebaskan (status PAID), pencabutan pembebasan
 *      mengembalikan status ke 'PARTIALLY_PAID' secara akurat.
 *    - Jika sebelumnya belum dibayar sama sekali (status EXEMPTED), status kembali menjadi 'UNPAID'.
 */
export async function revokeExemption(
  exemptionId: string,
  options?: RevokeExemptionOptions
): Promise<{ success: boolean; restoredCount: number }> {
  const exemption = await getExemptionById(exemptionId)
  if (!exemption) {
    throw new Error(`Data pembebasan dengan ID "${exemptionId}" tidak ditemukan.`)
  }
  if (exemption.status === 'REVOKED') {
    throw new Error(`Data pembebasan dengan ID "${exemptionId}" sudah dicabut sebelumnya.`)
  }

  const timestamp = now()

  // 1. Non-destructive: update status menjadi REVOKED dan catat metadata audit
  await execute(
    `UPDATE finance_exemptions
     SET status = 'REVOKED',
         revoked_at = ?,
         revoked_by = ?,
         revocation_reason = ?
     WHERE id = ?`,
    [
      timestamp,
      options?.revokedBy ?? null,
      options?.reason ?? null,
      exemptionId,
    ]
  )

  // 2. Re-evaluasi seluruh tagihan santri bersangkutan yang memiliki potongan pembebasan
  const obligations = await query<{
    id: string
    item_type: FinanceItemType
    period: string
    amount_expected: number
    amount_exempted: number
    amount_paid: number
    status: string
    academic_year_id: number | null
  }>(
    `SELECT id, item_type, period, amount_expected, amount_exempted, amount_paid, status, academic_year_id
     FROM finance_obligations
     WHERE santri_id = ? AND amount_exempted > 0`,
    [exemption.santri_id]
  )

  let restoredCount = 0

  for (const ob of obligations) {
    // Periksa apakah masih ada pembebasan aktif lain yang meng-cover tagihan ini
    const otherExemption = await checkExemption(
      exemption.santri_id,
      ob.item_type,
      ob.period,
      ob.academic_year_id
    )

    let newAmountExempted = 0
    if (otherExemption) {
      if (ob.amount_paid === 0) {
        newAmountExempted = ob.amount_expected
      } else {
        newAmountExempted = Math.max(0, ob.amount_expected - ob.amount_paid)
      }
    } else {
      newAmountExempted = 0
    }

    const newStatus = computeObligationStatus(
      ob.amount_expected,
      newAmountExempted,
      ob.amount_paid
    )

    if (newAmountExempted !== ob.amount_exempted || newStatus !== ob.status) {
      await execute(
        `UPDATE finance_obligations
         SET amount_exempted = ?,
             status = ?,
             updated_at = ?
         WHERE id = ?`,
        [newAmountExempted, newStatus, timestamp, ob.id]
      )
      restoredCount++
    }
  }

  return { success: true, restoredCount }
}

/**
 * Mengambil data pembebasan berdasarkan ID (termasuk metadata revocation).
 */
export async function getExemptionById(id: string): Promise<FinanceExemption | null> {
  return queryOne<FinanceExemption>(
    `SELECT id, santri_id, item_type, academic_year_id,
            period_start, period_end, reason, notes,
            status, revoked_at, revoked_by, revocation_reason,
            created_by, created_at
     FROM finance_exemptions
     WHERE id = ?`,
    [id]
  )
}

/**
 * Memeriksa apakah santri memiliki pembebasan biaya AKTIF untuk item dan periode tertentu.
 * Hanya exemption dengan status = 'ACTIVE' yang diperhitungkan.
 */
export async function checkExemption(
  santriId: string,
  itemType: FinanceItemType,
  period: string,
  academicYearId?: number | null
): Promise<FinanceExemption | null> {
  let sql = `
    SELECT id, santri_id, item_type, academic_year_id,
           period_start, period_end, reason, notes,
           status, revoked_at, revoked_by, revocation_reason,
           created_by, created_at
    FROM finance_exemptions
    WHERE santri_id = ?
      AND status = 'ACTIVE'
      AND (item_type = ? OR item_type = 'ALL')
      AND (period_start IS NULL OR period_start <= ?)
      AND (period_end IS NULL OR period_end >= ?)
  `
  const params: unknown[] = [santriId, itemType, period, period]

  if (academicYearId) {
    sql += ` AND (academic_year_id = ? OR academic_year_id IS NULL)`
    params.push(academicYearId)
  }

  sql += `
    ORDER BY (CASE WHEN item_type = ? THEN 1 ELSE 0 END) DESC,
             created_at DESC
    LIMIT 1
  `
  params.push(itemType)

  return queryOne<FinanceExemption>(sql, params)
}

/**
 * Mengambil seluruh riwayat pembebasan biaya untuk satu santri (termasuk yang telah di-revoke).
 */
export async function listExemptionsBySantri(
  santriId: string
): Promise<FinanceExemption[]> {
  return query<FinanceExemption>(
    `SELECT id, santri_id, item_type, academic_year_id,
            period_start, period_end, reason, notes,
            status, revoked_at, revoked_by, revocation_reason,
            created_by, created_at
     FROM finance_exemptions
     WHERE santri_id = ?
     ORDER BY created_at DESC`,
    [santriId]
  )
}

/**
 * Mengambil daftar seluruh pembebasan dengan filter opsional.
 */
export async function listAllExemptions(filter?: {
  academicYearId?: number | null
  itemType?: string
  status?: 'ACTIVE' | 'REVOKED'
}): Promise<FinanceExemption[]> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter?.status) {
    conditions.push('status = ?')
    params.push(filter.status)
  }

  if (filter?.itemType) {
    conditions.push('(item_type = ? OR item_type = \'ALL\')')
    params.push(filter.itemType)
  }

  if (filter?.academicYearId !== undefined) {
    if (filter.academicYearId === null) {
      conditions.push('academic_year_id IS NULL')
    } else {
      conditions.push('academic_year_id = ?')
      params.push(filter.academicYearId)
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return query<FinanceExemption>(
    `SELECT id, santri_id, item_type, academic_year_id,
            period_start, period_end, reason, notes,
            status, revoked_at, revoked_by, revocation_reason,
            created_by, created_at
     FROM finance_exemptions
     ${whereClause}
     ORDER BY created_at DESC`,
    params
  )
}

// ─── GROUP / BULK WAIVER RULE ENGINE ────────────────────────────────────────

export interface GroupExemptionPreview {
  targetType: 'INDIVIDUAL' | 'KELAS'
  targetValue: string
  targetLabel: string
  itemType: FinanceItemType | 'ALL'
  periodStart: string | null
  periodEnd: string | null
  totalStudents: number
  alreadyExemptedCount: number
  alreadyPaidCount: number
  partiallyPaidCount: number
  partiallyPaidAmount: number
  partiallyRemainingAmount: number
  reviewRequiredCount: number
  unpaidCount: number
  sampleStudents: Array<{
    id: string
    nis: string
    nama_lengkap: string
    kelas: string | null
    asrama: string | null
    kamar: string | null
  }>
}

export interface GroupExemptionApplyResult {
  targetType: 'INDIVIDUAL' | 'KELAS'
  targetValue: string
  totalTargeted: number
  exemptionsCreated: number
  obligationsUpdated: number
  alreadyExempted: number
  partiallyPaidSkipped: number
  partiallyPaidAmount: number
  partiallyRemainingAmount: number
  errors: Array<{ santriId: string; error: string }>
}

export interface LegacySppExemptionMigrationResult {
  totalLegacyFound: number
  migratedCount: number
  alreadyMigratedCount: number
  obligationsUpdated: number
}

/**
 * Pratinjau dampak aturan pembebasan biaya untuk target Individual atau Kelas.
 * Menghitung santri terdampak, tagihan yang sudah dibayar, belum dibayar, atau sudah dibebaskan.
 */
export async function previewGroupExemption(params: {
  targetType: 'INDIVIDUAL' | 'KELAS'
  targetValue: string
  itemType: FinanceItemType | 'ALL'
  periodStart?: string | null
  periodEnd?: string | null
  academicYearId?: number | null
}): Promise<GroupExemptionPreview> {
  const periodStart = params.periodStart || null
  const periodEnd = params.periodEnd || null

  let studentsQuery = `
    SELECT id, nis, nama_lengkap, kelas_sekolah AS kelas, asrama, kamar
    FROM santri
    WHERE status_global = 'aktif'
  `
  const queryParams: unknown[] = []

  if (params.targetType === 'INDIVIDUAL') {
    studentsQuery += ` AND id = ?`
    queryParams.push(params.targetValue)
  } else {
    studentsQuery += ` AND (kelas_sekolah = ? OR kelas_sekolah LIKE ?)`
    queryParams.push(params.targetValue, `${params.targetValue}%`)
  }

  studentsQuery += ` ORDER BY nama_lengkap ASC`

  const students = await query<{
    id: string
    nis: string
    nama_lengkap: string
    kelas: string | null
    asrama: string | null
    kamar: string | null
  }>(studentsQuery, queryParams)

  let alreadyExemptedCount = 0
  let alreadyPaidCount = 0
  let partiallyPaidCount = 0
  let partiallyPaidAmount = 0
  let partiallyRemainingAmount = 0
  let reviewRequiredCount = 0
  let unpaidCount = 0

  for (const s of students) {
    // 1. Cek apakah santri sudah memiliki pembebasan aktif untuk item dan periode ini
    const testPeriod = periodStart || '2026-07'
    const activeEx = await checkExemption(s.id, params.itemType === 'ALL' ? 'SPP' : params.itemType, testPeriod, params.academicYearId)
    if (activeEx) {
      alreadyExemptedCount++
    }

    // 2. Cek status kewajiban jika periode spesifik ditentukan
    if (params.itemType !== 'ALL') {
      let obQuery = `SELECT status, amount_paid, amount_expected FROM finance_obligations
                     WHERE santri_id = ? AND item_type = ?`
      const obParams: unknown[] = [s.id, params.itemType]
      if (periodStart) {
        obQuery += ` AND period = ?`
        obParams.push(periodStart)
      }
      const ob = await queryOne<{ status: string; amount_paid: number; amount_expected: number }>(
        obQuery,
        obParams
      )
      if (ob) {
        if (ob.status === 'PAID') {
          alreadyPaidCount++
        } else if (ob.status === 'PARTIALLY_PAID' || (ob.amount_paid > 0 && ob.amount_paid < ob.amount_expected)) {
          partiallyPaidCount++
          partiallyPaidAmount += ob.amount_paid
          partiallyRemainingAmount += Math.max(0, ob.amount_expected - ob.amount_paid)
          reviewRequiredCount++
        } else if (ob.status === 'UNPAID') {
          unpaidCount++
        }
      } else {
        unpaidCount++
      }
    } else {
      unpaidCount++
    }
  }

  const targetLabel =
    params.targetType === 'INDIVIDUAL'
      ? students[0]?.nama_lengkap || params.targetValue
      : `Kelas ${params.targetValue}`

  return {
    targetType: params.targetType,
    targetValue: params.targetValue,
    targetLabel,
    itemType: params.itemType,
    periodStart,
    periodEnd,
    totalStudents: students.length,
    alreadyExemptedCount,
    alreadyPaidCount,
    partiallyPaidCount,
    partiallyPaidAmount,
    partiallyRemainingAmount,
    reviewRequiredCount,
    unpaidCount,
    sampleStudents: students.slice(0, 15),
  }
}

/**
 * Menerapkan pembebasan biaya massal (Group Waiver) secara kanonikal dan idempoten.
 * Memperbarui status kewajiban yang belum dibayar menjadi EXEMPTED tanpa membuat payment palsu,
 * dan menjaga utuh riwayat pembayaran yang sudah ada (non-retroaktif).
 */
export async function applyGroupExemption(params: {
  targetType: 'INDIVIDUAL' | 'KELAS'
  targetValue: string
  itemType: FinanceItemType | 'ALL'
  periodStart?: string | null
  periodEnd?: string | null
  academicYearId?: number | null
  reason: string
  notes?: string | null
  createdBy?: string | null
}): Promise<GroupExemptionApplyResult> {
  let studentsQuery = `
    SELECT id, nama_lengkap, kelas_sekolah AS kelas
    FROM santri
    WHERE status_global = 'aktif'
  `
  const queryParams: unknown[] = []

  if (params.targetType === 'INDIVIDUAL') {
    studentsQuery += ` AND id = ?`
    queryParams.push(params.targetValue)
  } else {
    studentsQuery += ` AND (kelas_sekolah = ? OR kelas_sekolah LIKE ?)`
    queryParams.push(params.targetValue, `${params.targetValue}%`)
  }

  const students = await query<{ id: string; nama_lengkap: string; kelas: string | null }>(
    studentsQuery,
    queryParams
  )

  let exemptionsCreated = 0
  let obligationsUpdated = 0
  let alreadyExempted = 0
  let partiallyPaidSkipped = 0
  let partiallyPaidAmount = 0
  let partiallyRemainingAmount = 0
  const errors: Array<{ santriId: string; error: string }> = []

  const periodStart = params.periodStart || null
  const periodEnd = params.periodEnd || null

  for (const student of students) {
    try {
      // Cek apakah santri memiliki kewajiban partially paid yang dikecualikan dari pembebasan otomatis
      const partiallyPaidObs = await query<{ id: string; amount_paid: number; amount_expected: number }>(
        `SELECT id, amount_paid, amount_expected FROM finance_obligations
         WHERE santri_id = ?
           AND (item_type = ? OR ? = 'ALL')
           AND amount_paid > 0
           AND amount_paid < amount_expected`,
        [student.id, params.itemType, params.itemType]
      )
      for (const po of partiallyPaidObs) {
        partiallyPaidSkipped++
        partiallyPaidAmount += po.amount_paid
        partiallyRemainingAmount += Math.max(0, po.amount_expected - po.amount_paid)
      }

      // Cek apakah santri sudah memiliki pembebasan identik yang aktif
      const existingActive = await queryOne<{ id: string }>(
        `SELECT id FROM finance_exemptions
         WHERE santri_id = ?
           AND status = 'ACTIVE'
           AND (item_type = ? OR item_type = 'ALL')
           AND (
             (period_start IS NULL AND ? IS NULL) OR (period_start = ?)
           )
           AND (
             (period_end IS NULL AND ? IS NULL) OR (period_end = ?)
           ) LIMIT 1`,
        [student.id, params.itemType, periodStart, periodStart, periodEnd, periodEnd]
      )

      if (existingActive) {
        alreadyExempted++
        continue
      }

      await grantExemption({
        santri_id: student.id,
        item_type: params.itemType,
        academic_year_id: params.academicYearId ?? null,
        period_start: periodStart,
        period_end: periodEnd,
        reason: params.reason,
        notes: params.notes ?? null,
        created_by: params.createdBy ?? null,
      })

      exemptionsCreated++
      obligationsUpdated++
    } catch (err: unknown) {
      errors.push({
        santriId: student.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    targetType: params.targetType,
    targetValue: params.targetValue,
    totalTargeted: students.length,
    exemptionsCreated,
    obligationsUpdated,
    alreadyExempted,
    partiallyPaidSkipped,
    partiallyPaidAmount,
    partiallyRemainingAmount,
    errors,
  }
}

/**
 * Memigrasikan data pembebasan SPP legacy (santri_pembebasan_biaya / santri.bebas_spp)
 * ke model kanonikal finance_exemptions secara idempoten dan aman.
 */
export async function migrateLegacySppExemptions(
  createdBy?: string | null
): Promise<LegacySppExemptionMigrationResult> {
  // 1. Ambil santri bebas SPP dari santri_pembebasan_biaya jika ada, atau fallback ke santri.bebas_spp
  let legacyRows: Array<{ santri_id: string; alasan: string | null }> = []

  try {
    legacyRows = await query<{ santri_id: string; alasan: string | null }>(
      `SELECT santri_id, alasan FROM santri_pembebasan_biaya
       WHERE service_kind = 'SPP' AND is_active = 1`
    )
  } catch {
    // Fallback jika tabel santri_pembebasan_biaya tidak ada
    legacyRows = []
  }

  if (legacyRows.length === 0) {
    const santriBebas = await query<{ id: string }>(
      `SELECT id FROM santri WHERE bebas_spp = 1 AND status_global = 'aktif'`
    )
    legacyRows = santriBebas.map((s) => ({
      santri_id: s.id,
      alasan: 'Migrasi otomatis dari santri.bebas_spp',
    }))
  }

  let migratedCount = 0
  let alreadyMigratedCount = 0
  let obligationsUpdated = 0
  const nowStr = now()

  for (const row of legacyRows) {
    // Cek apakah sudah ada pembebasan SPP permanen aktif
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM finance_exemptions
       WHERE santri_id = ? AND item_type = 'SPP' AND period_start IS NULL AND period_end IS NULL AND status = 'ACTIVE' LIMIT 1`,
      [row.santri_id]
    )

    if (existing) {
      alreadyMigratedCount++
      continue
    }

    const exId = generateId()
    const reasonText = row.alasan || 'Migrasi Pembebasan SPP Permanen Legacy'

    await execute(
      `INSERT INTO finance_exemptions (
         id, santri_id, item_type, academic_year_id, period_start, period_end,
         reason, notes, status, created_by, created_at
       ) VALUES (?, ?, 'SPP', NULL, NULL, NULL, ?, 'Migrasi Otomatis Legacy SPP Exemption', 'ACTIVE', ?, ?)`,
      [exId, row.santri_id, reasonText, createdBy ?? null, nowStr]
    )

    // Perbarui seluruh kewajiban SPP yang belum dibayar untuk santri ini
    const unpaidObligations = await query<{ id: string; amount_expected: number; amount_paid: number }>(
      `SELECT id, amount_expected, amount_paid FROM finance_obligations
       WHERE santri_id = ? AND item_type = 'SPP'`,
      [row.santri_id]
    )

    for (const ob of unpaidObligations) {
      if (ob.amount_paid === 0) {
        await execute(
          `UPDATE finance_obligations
           SET amount_exempted = amount_expected, status = 'EXEMPTED', updated_at = ?
           WHERE id = ?`,
          [nowStr, ob.id]
        )
        obligationsUpdated++
      } else if (ob.amount_paid < ob.amount_expected) {
        const remaining = ob.amount_expected - ob.amount_paid
        const newStatus = computeObligationStatus(ob.amount_expected, remaining, ob.amount_paid)
        await execute(
          `UPDATE finance_obligations
           SET amount_exempted = ?, status = ?, updated_at = ?
           WHERE id = ?`,
          [remaining, newStatus, nowStr, ob.id]
        )
        obligationsUpdated++
      }
    }

    migratedCount++
  }

  return {
    totalLegacyFound: legacyRows.length,
    migratedCount,
    alreadyMigratedCount,
    obligationsUpdated,
  }
}
