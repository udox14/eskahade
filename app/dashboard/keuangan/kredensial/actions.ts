'use server'

import { query, queryOne, execute, generateId, now } from '@/lib/db'
import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import {
  issueCard,
  revokeCard,
  reportLostCard,
  blockCard,
  unblockCard,
  generateCardToken,
  type CardStatus,
  type FinanceCredential,
} from '@/lib/finance/cards'
import {
  setStudentPin,
  resetStudentPin,
  unlockStudentPin,
  generateRandomPin,
} from '@/lib/finance/pins'
import { hashPassword } from '@/lib/auth/password'
import { generateQrSvg } from '@/lib/finance/qr'
import {
  isAsramaBebasTagihan,
  nonBillableSantriSqlPredicate,
} from '@/lib/finance/non-billable-santri'

export interface BulkCandidateScope {
  type: 'ALL_UNISSUED' | 'BY_ASRAMA' | 'FILTERED' | 'SELECTED_IDS'
  asrama?: string
  search?: string
  santriIds?: string[]
}

export interface BulkCandidatesSummary {
  totalCandidates: number
  eligibleCount: number
  alreadyActiveCount: number
  candidateIds: string[]
  skippedSample: Array<{ namaLengkap: string; nis: string; asrama: string | null }>
}

export interface BatchChunkItemResult {
  santriId: string
  namaLengkap: string
  nis: string
  asrama: string | null
  kamar: string | null
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'ISSUED_PIN_NOT_RETRIEVABLE'
  reason?: string
  cardToken?: string
  initialPin?: string
}

export interface BatchChunkResult {
  success: boolean
  processedCount: number
  successCount: number
  skippedCount: number
  issuedPinNotRetrievableCount: number
  failedCount: number
  items: BatchChunkItemResult[]
}

export interface RecoverPinChunkItemResult {
  santriId: string
  namaLengkap: string
  nis: string
  asrama: string | null
  kamar: string | null
  status: 'SUCCESS' | 'FAILED'
  newPin?: string
  reason?: string
}

export interface RecoverPinChunkResult {
  success: boolean
  processedCount: number
  successCount: number
  failedCount: number
  items: RecoverPinChunkItemResult[]
}

export interface StudentCredentialRow {

  id: string
  nis: string
  namaLengkap: string
  asrama: string | null
  kamar: string | null
  fotoUrl: string | null
  statusGlobal: string
  cardId: string | null
  cardToken: string | null
  cardStatus: CardStatus | 'NONE'
  cardIssuedAt: string | null
  hasPin: boolean
  isPinLocked: boolean
  pinLockedUntil: string | null
  pinFailedAttempts: number
}

export interface KredensialKpi {
  totalSantriAktif: number
  totalKartuAktif: number
  totalKartuHilang: number
  totalPinTerkunci: number
}

export interface KredensialQueryParams {
  search?: string
  asrama?: string
  cardStatusFilter?: 'ALL' | 'ACTIVE' | 'NONE' | 'REVOKED' | 'LOST' | 'BLOCKED'
  pinStatusFilter?: 'ALL' | 'HAS_PIN' | 'NO_PIN' | 'LOCKED'
  page?: number
  pageSize?: number
}

export interface KredensialResponse {
  items: StudentCredentialRow[]
  kpi: KredensialKpi
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

export interface CardPrintItem {
  santriId: string
  namaLengkap: string
  nis: string
  asrama: string | null
  kamar: string | null
  fotoUrl: string | null
  cardToken: string
  qrSvg: string
}

const ALLOWED_VIEW_ROLES = [
  'admin',
  'bendahara',
  'admin_koperasi',
  'petugas_koperasi',
  'pimpinan',
  'tester',
]

const ALLOWED_MUTATE_ROLES = [
  'admin',
  'bendahara',
  'admin_koperasi',
  'petugas_koperasi',
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
    throw new Error('Akses ditolak: Anda tidak memiliki hak akses modul Kredensial Kartu.')
  }

  const isViewOnly = roles.includes('pimpinan') || roles.includes('tester')
  const canMutate = !isViewOnly && roles.some(r => ALLOWED_MUTATE_ROLES.includes(r))

  return {
    userId: session.id,
    roles,
    canMutate,
  }
}

/**
 * Mengambil dataset tabel santri beserta status kartu fisik dan PIN.
 */
export async function getKredensialData(
  params: KredensialQueryParams
): Promise<KredensialResponse> {
  const auth = await authorizeUser()

  const search = (params.search || '').trim()
  const asramaFilter = (params.asrama || 'ALL').trim()
  const cardStatusFilter = params.cardStatusFilter || 'ALL'
  const pinStatusFilter = params.pinStatusFilter || 'ALL'
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize || 50))
  const offset = (page - 1) * pageSize

  // 1. KPI Global & 2. Daftar Asrama (Paralel)
  const [
    kpiSantriAktif,
    kpiKartuAktif,
    kpiKartuHilang,
    kpiPinTerkunci,
    asramaRows,
  ] = await Promise.all([
    queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM santri
       WHERE status_global = 'aktif'
         AND ${nonBillableSantriSqlPredicate('asrama')}`
    ),
    queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM finance_credentials c
       JOIN santri s ON s.id = c.santri_id
       WHERE c.status = 'ACTIVE'
         AND ${nonBillableSantriSqlPredicate('s.asrama')}`
    ),
    queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM finance_credentials c
       JOIN santri s ON s.id = c.santri_id
       WHERE c.status = 'LOST'
         AND ${nonBillableSantriSqlPredicate('s.asrama')}`
    ),
    queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM finance_student_pins p
       JOIN santri s ON s.id = p.santri_id
       WHERE p.locked_until IS NOT NULL AND datetime(p.locked_until) > datetime('now')
         AND ${nonBillableSantriSqlPredicate('s.asrama')}`
    ),
    query<{ asrama: string }>(
      `SELECT DISTINCT asrama FROM santri
       WHERE status_global = 'aktif' AND asrama IS NOT NULL AND TRIM(asrama) != ''
         AND ${nonBillableSantriSqlPredicate('asrama')}
       ORDER BY asrama ASC`
    ),
  ])

  const kpi: KredensialKpi = {
    totalSantriAktif: kpiSantriAktif?.total ?? 0,
    totalKartuAktif: kpiKartuAktif?.total ?? 0,
    totalKartuHilang: kpiKartuHilang?.total ?? 0,
    totalPinTerkunci: kpiPinTerkunci?.total ?? 0,
  }

  const asramaList = asramaRows.map(r => r.asrama)

  // 3. Bangun query filter
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

  if (cardStatusFilter === 'ACTIVE') {
    conditions.push("c.status = 'ACTIVE'")
  } else if (cardStatusFilter === 'NONE') {
    conditions.push('c.id IS NULL')
  } else if (cardStatusFilter === 'LOST') {
    conditions.push("c.status = 'LOST'")
  } else if (cardStatusFilter === 'BLOCKED') {
    conditions.push("c.status = 'BLOCKED'")
  } else if (cardStatusFilter === 'REVOKED') {
    conditions.push("c.status = 'REVOKED'")
  }

  if (pinStatusFilter === 'HAS_PIN') {
    conditions.push('p.pin_hash IS NOT NULL')
  } else if (pinStatusFilter === 'NO_PIN') {
    conditions.push('p.pin_hash IS NULL')
  } else if (pinStatusFilter === 'LOCKED') {
    conditions.push("p.locked_until IS NOT NULL AND datetime(p.locked_until) > datetime('now')")
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // 4. Hitung total items & 5. Query data santri & kredensial secara paralel
  const countPromise = queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM santri s
     LEFT JOIN (
       SELECT * FROM finance_credentials WHERE status = 'ACTIVE'
     ) c ON c.santri_id = s.id
     LEFT JOIN finance_student_pins p ON p.santri_id = s.id
     ${whereClause}`,
    queryParams
  )

  const rowsPromise = query<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    foto_url: string | null
    status_global: string
    card_id: string | null
    card_token: string | null
    card_status: CardStatus | null
    card_issued_at: string | null
    pin_hash: string | null
    failed_attempts: number | null
    locked_until: string | null
  }>(
    `SELECT
       s.id,
       s.nis,
       s.nama_lengkap,
       s.asrama,
       s.kamar,
       s.foto_url,
       s.status_global,
       c.id AS card_id,
       c.card_token,
       c.status AS card_status,
       c.issued_at AS card_issued_at,
       p.pin_hash,
       p.failed_attempts,
       p.locked_until
     FROM santri s
     LEFT JOIN (
       SELECT * FROM finance_credentials WHERE status = 'ACTIVE'
     ) c ON c.santri_id = s.id
     LEFT JOIN finance_student_pins p ON p.santri_id = s.id
     ${whereClause}
     ORDER BY s.nama_lengkap ASC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  )

  const [countRow, rows] = await Promise.all([countPromise, rowsPromise])
  const totalItems = countRow?.total ?? 0
  const totalPages = Math.ceil(totalItems / pageSize) || 1

  const nowMs = Date.now()
  const items: StudentCredentialRow[] = rows.map(r => {
    let isLocked = false
    if (r.locked_until) {
      isLocked = new Date(r.locked_until).getTime() > nowMs
    }

    return {
      id: r.id,
      nis: r.nis,
      namaLengkap: r.nama_lengkap,
      asrama: r.asrama,
      kamar: r.kamar,
      fotoUrl: r.foto_url,
      statusGlobal: r.status_global,
      cardId: r.card_id,
      cardToken: r.card_token,
      cardStatus: r.card_status ?? 'NONE',
      cardIssuedAt: r.card_issued_at,
      hasPin: Boolean(r.pin_hash),
      isPinLocked: isLocked,
      pinLockedUntil: r.locked_until,
      pinFailedAttempts: r.failed_attempts ?? 0,
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
 * Server action: Menerbitkan kartu baru santri (atomik me-revoke kartu lama).
 */
export async function issueCardAction(
  santriId: string,
  reason?: string
): Promise<{ success: boolean; card: FinanceCredential }> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  const card = await issueCard(santriId, auth.userId, { reason })
  return { success: true, card }
}

/**
 * Server action: Me-revoke kartu santri.
 */
export async function revokeCardAction(
  cardId: string,
  reason: string
): Promise<{ success: boolean }> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  await revokeCard(cardId, reason, auth.userId)
  return { success: true }
}

/**
 * Server action: Melaporkan kartu hilang.
 */
export async function reportLostCardAction(
  cardId: string,
  reason: string
): Promise<{ success: boolean }> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  await reportLostCard(cardId, reason, auth.userId)
  return { success: true }
}

/**
 * Server action: Blokir kartu.
 */
export async function blockCardAction(
  cardId: string,
  reason: string
): Promise<{ success: boolean }> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  await blockCard(cardId, reason, auth.userId)
  return { success: true }
}

/**
 * Server action: Buka blokir kartu.
 */
export async function unblockCardAction(
  cardId: string
): Promise<{ success: boolean }> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  await unblockCard(cardId)
  return { success: true }
}

/**
 * Server action: Me-reset PIN santri yang sudah ada secara eksplisit.
 */
export async function resetPinAction(
  santriId: string,
  newPin: string,
  reason?: string
): Promise<{ success: boolean }> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  await resetStudentPin(santriId, newPin, auth.userId, reason)
  return { success: true }
}

/**
 * Server action: Daftarkan / Reset PIN santri.
 */
export async function setPinAction(
  santriId: string,
  pin: string,
  isReset?: boolean,
  reason?: string
): Promise<{ success: boolean }> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  if (isReset) {
    await resetStudentPin(santriId, pin, auth.userId, reason)
  } else {
    await setStudentPin(santriId, pin, auth.userId, { isReset, reason })
  }
  return { success: true }
}

/**
 * Server action: Buka kunci PIN santri.
 */
export async function unlockPinAction(
  santriId: string,
  reason?: string
): Promise<{ success: boolean }> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  await unlockStudentPin(santriId, auth.userId, reason)
  return { success: true }
}

/**
 * Mengambil data batch santri untuk pencetakan kartu ATM-style.
 * Menghasilkan string SVG QR Code murni untuk setiap kartu yang berstatus ACTIVE.
 */
export async function getCardsForBatchPrint(
  santriIds?: string[],
  asrama?: string
): Promise<CardPrintItem[]> {
  await authorizeUser()

  const conditions: string[] = [
    "s.status_global = 'aktif'",
    "c.status = 'ACTIVE'",
    nonBillableSantriSqlPredicate('s.asrama'),
  ]
  const params: unknown[] = []

  if (santriIds && santriIds.length > 0) {
    const placeholders = santriIds.map(() => '?').join(', ')
    conditions.push(`s.id IN (${placeholders})`)
    params.push(...santriIds)
  }

  if (asrama && asrama !== 'ALL') {
    conditions.push('s.asrama = ?')
    params.push(asrama)
  }

  const rows = await query<{
    santri_id: string
    nama_lengkap: string
    nis: string
    asrama: string | null
    kamar: string | null
    foto_url: string | null
    card_token: string
  }>(
    `SELECT
       s.id AS santri_id,
       s.nama_lengkap,
       s.nis,
       s.asrama,
       s.kamar,
       s.foto_url,
       c.card_token
     FROM santri s
     JOIN finance_credentials c ON c.santri_id = s.id AND c.status = 'ACTIVE'
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.asrama ASC, s.nama_lengkap ASC`,
    params
  )

  return rows.map(r => ({
    santriId: r.santri_id,
    namaLengkap: r.nama_lengkap,
    nis: r.nis,
    asrama: r.asrama,
    kamar: r.kamar,
    fotoUrl: r.foto_url,
    cardToken: r.card_token,
    qrSvg: generateQrSvg(r.card_token, {
      size: 96,
      margin: 1,
      darkColor: '#0f172a',
      lightColor: '#ffffff',
      title: `QR Kartu ${r.nama_lengkap}`,
    }),
  }))
}

/**
 * Mengambil ringkasan kandidat untuk penerbitan kartu massal.
 */
export async function getBulkIssuanceCandidatesAction(
  scope: BulkCandidateScope
): Promise<BulkCandidatesSummary> {
  await authorizeUser()

  const conditions: string[] = [
    "s.status_global = 'aktif'",
    nonBillableSantriSqlPredicate('s.asrama'),
  ]
  const params: unknown[] = []

  if (scope.type === 'BY_ASRAMA' && scope.asrama && scope.asrama !== 'ALL') {
    conditions.push('s.asrama = ?')
    params.push(scope.asrama)
  } else if (scope.type === 'FILTERED') {
    if (scope.search && scope.search.trim()) {
      conditions.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
      params.push(`%${scope.search.trim()}%`, `%${scope.search.trim()}%`)
    }
    if (scope.asrama && scope.asrama !== 'ALL') {
      conditions.push('s.asrama = ?')
      params.push(scope.asrama)
    }
  } else if (scope.type === 'SELECTED_IDS' && scope.santriIds && scope.santriIds.length > 0) {
    const placeholders = scope.santriIds.map(() => '?').join(', ')
    conditions.push(`s.id IN (${placeholders})`)
    params.push(...scope.santriIds)
  }

  const rows = await query<{
    id: string
    nama_lengkap: string
    nis: string
    asrama: string | null
    active_card_id: string | null
  }>(
    `SELECT
       s.id,
       s.nama_lengkap,
       s.nis,
       s.asrama,
       c.id AS active_card_id
     FROM santri s
     LEFT JOIN (
       SELECT id, santri_id FROM finance_credentials WHERE status = 'ACTIVE'
     ) c ON c.santri_id = s.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.asrama ASC, s.nama_lengkap ASC`,
    params
  )

  const eligible = rows.filter((r) => !r.active_card_id)
  const alreadyActive = rows.filter((r) => Boolean(r.active_card_id))

  return {
    totalCandidates: rows.length,
    eligibleCount: eligible.length,
    alreadyActiveCount: alreadyActive.length,
    candidateIds: eligible.map((r) => r.id),
    skippedSample: alreadyActive.slice(0, 10).map((r) => ({
      namaLengkap: r.nama_lengkap,
      nis: r.nis,
      asrama: r.asrama,
    })),
  }
}

/**
 * Server action: Menerbitkan batch kartu santri per chunk (maksimum 50 santri per chunk).
 * Menjamin:
 * 1. Santri yang SUDAH memiliki kartu ACTIVE otomatis di-SKIP (tidak merusak kartu existing).
 * 2. Santri yang BELUM punya PIN di-generate-kan PIN acak 6-digit baru (di-hash PBKDF2).
 *    Plaintext PIN dikembalikan SEKALI dalam respons untuk cetak slip PIN, tidak pernah disimpan di DB.
 * 3. Santri yang SUDAH punya PIN dipertahankan PIN-nya (zero reset).
 * 4. Invariant tepat 1 kartu ACTIVE per santri ditegakkan.
 */
export async function issueCardBatchChunkAction(
  santriIds: string[]
): Promise<BatchChunkResult> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  // Batasi chunk maksimal 50 santri
  const chunk = santriIds.slice(0, 50)
  const items: BatchChunkItemResult[] = []
  let successCount = 0
  let skippedCount = 0
  let issuedPinNotRetrievableCount = 0
  let failedCount = 0

  for (const santriId of chunk) {
    try {
      const student = await queryOne<{
        id: string
        status_global: string
        nama_lengkap: string
        nis: string
        asrama: string | null
        kamar: string | null
      }>(
        `SELECT id, status_global, nama_lengkap, nis, asrama, kamar FROM santri WHERE id = ?`,
        [santriId]
      )

      if (!student) {
        items.push({
          santriId,
          namaLengkap: 'Tidak Ditemukan',
          nis: '-',
          asrama: null,
          kamar: null,
          status: 'FAILED',
          reason: 'Santri tidak ditemukan di database.',
        })
        failedCount++
        continue
      }

      if (student.status_global !== 'aktif') {
        items.push({
          santriId,
          namaLengkap: student.nama_lengkap,
          nis: student.nis,
          asrama: student.asrama,
          kamar: student.kamar,
          status: 'SKIPPED',
          reason: `Santri berstatus "${student.status_global}" (tidak aktif).`,
        })
        skippedCount++
        continue
      }

      if (isAsramaBebasTagihan(student.asrama)) {
        items.push({
          santriId,
          namaLengkap: student.nama_lengkap,
          nis: student.nis,
          asrama: student.asrama,
          kamar: student.kamar,
          status: 'SKIPPED',
          reason: `Santri asrama ${String(student.asrama ?? '').trim().toUpperCase()} (penduduk setempat) bebas dari seluruh tagihan keuangan.`,
        })
        skippedCount++
        continue
      }

      // Cek apakah sudah ada kartu ACTIVE
      const existingActiveCard = await queryOne<{ id: string; card_token: string }>(
        `SELECT id, card_token FROM finance_credentials WHERE santri_id = ? AND status = 'ACTIVE' LIMIT 1`,
        [santriId]
      )

      if (existingActiveCard) {
        // Cek apakah santri sudah memiliki PIN terdaftar di database
        const existingPin = await queryOne<{ santri_id: string }>(
          `SELECT santri_id FROM finance_student_pins WHERE santri_id = ? LIMIT 1`,
          [santriId]
        )

        if (existingPin) {
          // Kartu sudah aktif dan PIN sudah ada (hash), namun plaintext PIN tidak dapat diambil kembali
          // (misal karena response hilang/timeout saat chunk commit lalu operator retry).
          items.push({
            santriId,
            namaLengkap: student.nama_lengkap,
            nis: student.nis,
            asrama: student.asrama,
            kamar: student.kamar,
            cardToken: existingActiveCard.card_token,
            status: 'ISSUED_PIN_NOT_RETRIEVABLE',
            reason: 'Kartu sudah diterbitkan, tetapi PIN awal tidak dapat ditampilkan kembali. Reset PIN untuk membuat PIN baru.',
          })
          issuedPinNotRetrievableCount++
        } else {
          items.push({
            santriId,
            namaLengkap: student.nama_lengkap,
            nis: student.nis,
            asrama: student.asrama,
            kamar: student.kamar,
            cardToken: existingActiveCard.card_token,
            status: 'SKIPPED',
            reason: 'Sudah memiliki kartu ACTIVE.',
          })
          skippedCount++
        }
        continue
      }

      // Cek apakah santri sudah memiliki PIN terdaftar
      const existingPinRecord = await queryOne<{ santri_id: string }>(
        `SELECT santri_id FROM finance_student_pins WHERE santri_id = ? LIMIT 1`,
        [santriId]
      )

      let generatedPlaintextPin: string | undefined = undefined

      if (!existingPinRecord) {
        // Santri belum punya PIN -> buat PIN acak 6-digit baru yang aman (unbiased rejection sampling)
        const randomPin = generateRandomPin()
        const pinHash = await hashPassword(randomPin)
        const ts = now()
        const logId = generateId()

        // Simpan hash PIN (database HANYA menyimpan hash)
        await execute(
          `INSERT INTO finance_student_pins (
             santri_id, pin_hash, failed_attempts, locked_until, updated_at, updated_by
           ) VALUES (?, ?, 0, NULL, ?, ?)`,
          [santriId, pinHash, ts, auth.userId]
        )

        // Catat audit trail
        await execute(
          `INSERT INTO finance_pin_audit_logs (
             id, santri_id, action, performed_by, reason, created_at
           ) VALUES (?, ?, 'SET', ?, 'Inisialisasi PIN awal via penerbitan kartu massal', ?)`,
          [logId, santriId, auth.userId, ts]
        )

        generatedPlaintextPin = randomPin
      }
      // Jika santri sudah punya PIN, PERTAHANKAN PIN LAMA (tidak diubah)

      // Terbitkan kartu ACTIVE baru dengan token acak crd_<24_hex>
      const newCardId = generateId()
      const cardToken = generateCardToken()
      const ts = now()

      await execute(
        `INSERT INTO finance_credentials (
           id, santri_id, card_token, status, issued_at,
           issued_by, created_at, updated_at
         ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
        [newCardId, santriId, cardToken, ts, auth.userId, ts, ts]
      )

      items.push({
        santriId,
        namaLengkap: student.nama_lengkap,
        nis: student.nis,
        asrama: student.asrama,
        kamar: student.kamar,
        status: 'SUCCESS',
        cardToken,
        initialPin: generatedPlaintextPin,
      })
      successCount++
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      items.push({
        santriId,
        namaLengkap: '-',
        nis: '-',
        asrama: null,
        kamar: null,
        status: 'FAILED',
        reason: errMsg,
      })
      failedCount++
    }
  }

  return {
    success: failedCount === 0,
    processedCount: chunk.length,
    successCount,
    skippedCount,
    issuedPinNotRetrievableCount,
    failedCount,
    items,
  }
}

/**
 * Server action: Recovery PIN santri terdampak (response lost / retry penerbitan massal).
 * Menjamin:
 * 1. Otorisasi server-side: hanya role yang berwenang mutasi.
 * 2. Batas chunking maksimal 50 santri.
 * 3. Generate PIN baru 6 digit numerik acak independen (unbiased rejection sampling).
 * 4. Replace hash lama PBKDF2 di finance_student_pins, reset failed_attempts = 0, locked_until = NULL.
 * 5. Audit log mutlak per santri dengan action = 'RESET', performer = userId, dan keterangan recovery.
 * 6. Mengembalikan plaintext PIN baru SEKALI dalam response chunk untuk dapat langsung dicetak.
 * 7. Tidak menyimpan plaintext PIN di database maupun server logs.
 */
export async function recoverStudentPinsBatchChunkAction(
  santriIds: string[],
  reason?: string
): Promise<RecoverPinChunkResult> {
  const auth = await authorizeUser()
  if (!auth.canMutate) {
    throw new Error('Akses ditolak: Anda hanya memiliki izin lihat (view-only).')
  }

  const chunk = santriIds.slice(0, 50)
  const items: RecoverPinChunkItemResult[] = []
  let successCount = 0
  let failedCount = 0
  const auditReason = reason?.trim() || 'Reset PIN darurat (Recovery response-lost penerbitan kartu massal)'

  for (const santriId of chunk) {
    try {
      const student = await queryOne<{
        id: string
        status_global: string
        nama_lengkap: string
        nis: string
        asrama: string | null
        kamar: string | null
      }>(
        `SELECT id, status_global, nama_lengkap, nis, asrama, kamar FROM santri WHERE id = ?`,
        [santriId]
      )

      if (!student) {
        items.push({
          santriId,
          namaLengkap: 'Tidak Ditemukan',
          nis: '-',
          asrama: null,
          kamar: null,
          status: 'FAILED',
          reason: 'Santri tidak ditemukan di database.',
        })
        failedCount++
        continue
      }

      if (isAsramaBebasTagihan(student.asrama)) {
        items.push({
          santriId,
          namaLengkap: student.nama_lengkap,
          nis: student.nis,
          asrama: student.asrama,
          kamar: student.kamar,
          status: 'FAILED',
          reason: `Santri asrama ${String(student.asrama ?? '').trim().toUpperCase()} (penduduk setempat) bebas dari seluruh tagihan keuangan.`,
        })
        failedCount++
        continue
      }

      // Generate PIN acak baru 6 digit dengan rejection sampling
      const newPin = generateRandomPin()
      const pinHash = await hashPassword(newPin)
      const ts = now()
      const logId = generateId()

      // Update hash PIN di finance_student_pins (atau insert jika belum ada)
      const existingPin = await queryOne<{ santri_id: string }>(
        `SELECT santri_id FROM finance_student_pins WHERE santri_id = ? LIMIT 1`,
        [santriId]
      )

      if (existingPin) {
        await execute(
          `UPDATE finance_student_pins
           SET pin_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = ?, updated_by = ?
           WHERE santri_id = ?`,
          [pinHash, ts, auth.userId, santriId]
        )
      } else {
        await execute(
          `INSERT INTO finance_student_pins (
             santri_id, pin_hash, failed_attempts, locked_until, updated_at, updated_by
           ) VALUES (?, ?, 0, NULL, ?, ?)`,
          [santriId, pinHash, ts, auth.userId]
        )
      }

      // Audit trail mutlak dengan action 'RESET'
      await execute(
        `INSERT INTO finance_pin_audit_logs (
           id, santri_id, action, performed_by, reason, created_at
         ) VALUES (?, ?, 'RESET', ?, ?, ?)`,
        [logId, santriId, auth.userId, auditReason, ts]
      )

      items.push({
        santriId,
        namaLengkap: student.nama_lengkap,
        nis: student.nis,
        asrama: student.asrama,
        kamar: student.kamar,
        status: 'SUCCESS',
        newPin,
      })
      successCount++
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      items.push({
        santriId,
        namaLengkap: '-',
        nis: '-',
        asrama: null,
        kamar: null,
        status: 'FAILED',
        reason: errMsg,
      })
      failedCount++
    }
  }

  return {
    success: failedCount === 0,
    processedCount: chunk.length,
    successCount,
    failedCount,
    items,
  }
}

