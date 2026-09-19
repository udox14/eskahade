'use server'

import { query, queryOne } from '@/lib/db'
import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import {
  issueCard,
  revokeCard,
  reportLostCard,
  blockCard,
  unblockCard,
  type CardStatus,
  type FinanceCredential,
} from '@/lib/finance/cards'
import {
  setStudentPin,
  resetStudentPin,
  unlockStudentPin,
} from '@/lib/finance/pins'
import { generateQrSvg } from '@/lib/finance/qr'

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
  const pageSize = Math.max(1, Math.min(100, params.pageSize || 20))
  const offset = (page - 1) * pageSize

  // 1. KPI Global
  const kpiSantriAktif = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri WHERE status_global = 'aktif'`
  )
  const kpiKartuAktif = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM finance_credentials WHERE status = 'ACTIVE'`
  )
  const kpiKartuHilang = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM finance_credentials WHERE status = 'LOST'`
  )
  const kpiPinTerkunci = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM finance_student_pins
     WHERE locked_until IS NOT NULL AND datetime(locked_until) > datetime('now')`
  )

  const kpi: KredensialKpi = {
    totalSantriAktif: kpiSantriAktif?.total ?? 0,
    totalKartuAktif: kpiKartuAktif?.total ?? 0,
    totalKartuHilang: kpiKartuHilang?.total ?? 0,
    totalPinTerkunci: kpiPinTerkunci?.total ?? 0,
  }

  // 2. Daftar Asrama
  const asramaRows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama FROM santri
     WHERE status_global = 'aktif' AND asrama IS NOT NULL AND TRIM(asrama) != ''
     ORDER BY asrama ASC`
  )
  const asramaList = asramaRows.map(r => r.asrama)

  // 3. Bangun query filter
  const conditions: string[] = ["s.status_global = 'aktif'"]
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

  // 4. Hitung total items
  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM santri s
     LEFT JOIN (
       SELECT * FROM finance_credentials WHERE status = 'ACTIVE'
     ) c ON c.santri_id = s.id
     LEFT JOIN finance_student_pins p ON p.santri_id = s.id
     ${whereClause}`,
    queryParams
  )
  const totalItems = countRow?.total ?? 0
  const totalPages = Math.ceil(totalItems / pageSize) || 1

  // 5. Query data santri & kredensial
  const rows = await query<{
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

  const conditions: string[] = ["s.status_global = 'aktif'", "c.status = 'ACTIVE'"]
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
