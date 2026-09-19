'use server'

import { query, queryOne, generateId, now } from '@/lib/db'
import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import {
  getActiveCashSession,
  openCashSession,
  closeCashSession,
  recordCashInToSession,
  recordCashOutFromSession,
  getCashSessionSummary,
  getCashSessionHistory,
  type FinanceCashSession,
  type CashSessionTransactionSummary,
} from '@/lib/finance/cash-session'
import {
  findCardByToken,
  getActiveCard,
  type FinanceCredential,
} from '@/lib/finance/cards'
import {
  getStudentPinStatus,
  verifyStudentPin,
  type PinStatus,
} from '@/lib/finance/pins'
import {
  getStudentWalletBalance,
  evaluateWalletLimit,
  recordWalletMutation,
  type WalletLimitEvaluation,
} from '@/lib/finance/wallet'
import { createPaymentOrder } from '@/lib/finance/orders'
import { recordOrderPayment } from '@/lib/finance/payments'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'

// ─── TIPE DATA INTERFACE LOKET ──────────────────────────────────────────────

export interface StudentLoketProfile {
  id: string
  nis: string
  namaLengkap: string
  jenisKelamin: string
  asrama: string | null
  kamar: string | null
  kelas?: string | null
  fotoUrl: string | null
  statusGlobal: string
  card: FinanceCredential | null
  pinStatus: PinStatus
}

export interface StudentLoketFinancials {
  balance: number
  cachedBalance: number
  isSynced: boolean
  limits: WalletLimitEvaluation
  unpaidObligations: Array<{
    id: string
    itemType: string
    itemLabel: string
    period: string
    amountExpected: number
    amountExempted: number
    amountPaid: number
    remaining: number
    installmentRule: 'ALLOWED' | 'DISALLOWED'
    providerName: string | null
  }>
}

export interface LoketWithdrawalInput {
  santriId: string
  amount: number
  verificationToken: string
  idempotencyKey: string
  notes?: string
}

export interface LoketWithdrawalReceipt {
  receiptNumber: string
  type: 'WITHDRAWAL'
  santri: {
    id: string
    nis: string
    namaLengkap: string
    asrama: string | null
    kamar: string | null
  }
  amount: number
  balanceBefore: number
  balanceAfter: number
  remainingDailyQuota: number
  timestamp: string
  operatorName: string
  sessionCode: string
  notes?: string | null
}

export type LoketItemType = FinanceItemType | 'UANG_JAJAN'

export interface LoketPaymentItemInput {
  obligationId?: string | null
  itemType: LoketItemType
  amount: number
}

export interface LoketPaymentInput {
  santriId: string
  items: LoketPaymentItemInput[]
  idempotencyKey: string
  notes?: string
}

export interface LoketPaymentReceipt {
  receiptNumber: string
  type: 'PAYMENT_OR_DEPOSIT'
  santri: {
    id: string
    nis: string
    namaLengkap: string
    asrama: string | null
    kamar: string | null
  }
  grossAmount: number
  timestamp: string
  operatorName: string
  sessionCode: string
  items: Array<{
    itemType: string
    itemLabel: string
    period?: string | null
    amount: number
  }>
  walletBalanceAfter?: number | null
}

export interface LoketSessionTransactionItem {
  id: string
  type: 'WITHDRAWAL' | 'PAYMENT' | 'TOPUP_CASH'
  typeLabel: string
  amount: number
  santriNama: string
  santriNis: string
  referenceId: string | null
  createdAt: string
  operatorName?: string | null
}

// In-flight concurrency maps
const inFlightTransactions = new Map<string, Promise<unknown>>()
const verifiedPinSessions = new Map<string, { santriId: string; expiresAt: number }>()

// ─── OTORISASI OPERATOR LOKET (SERVER-SIDE RBAC) ────────────────────────────

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

export async function authorizeLoketOperator(requireMutate = false): Promise<{
  userId: string
  roles: string[]
  operatorName: string
  isViewOnly: boolean
}> {
  const session = await getSession()
  if (!session) {
    throw new Error('Sesi telah berakhir. Silakan masuk kembali.')
  }

  const roles = getEffectiveRoles(session)
  if (roles.length === 0) {
    throw new Error('Akses ditolak: Pengguna tidak memiliki role yang valid.')
  }

  // Cek apakah memiliki role yang diizinkan untuk melihat/mengakses modul loket
  const hasAllowedRole = roles.some(r => ALLOWED_VIEW_ROLES.includes(r))
  if (!hasAllowedRole) {
    throw new Error('Akses ditolak: Anda tidak memiliki hak akses modul Loket Kasir.')
  }

  // Cek fitur akses jika rute sudah terdaftar
  try {
    const hasFeature = await canAccessFeatureForSession(session, '/dashboard/koperasi/loket')
    if (!hasFeature && !roles.includes('admin') && !roles.includes('admin_koperasi') && !roles.includes('petugas_koperasi')) {
      throw new Error('Akses ditolak: Anda tidak memiliki wewenang untuk membuka Loket Kasir.')
    }
  } catch (err: unknown) {
    // Jika canAccessFeatureForSession gagal karena rute belum termigrasi di remote,
    // fallback ke role check ketat
    if (!hasAllowedRole) throw err
  }

  const isViewOnly = roles.includes('pimpinan') || roles.includes('tester') || !roles.some(r => ALLOWED_MUTATE_ROLES.includes(r))
  if (requireMutate && isViewOnly) {
    throw new Error('Akses ditolak: Akun dengan peran ini hanya memiliki hak melihat (view-only).')
  }

  const operatorName = session.full_name || session.email || 'Petugas Loket'

  return {
    userId: session.id,
    roles,
    operatorName,
    isViewOnly,
  }
}

// ─── INITIAL DATA & CASH SESSION ───────────────────────────────────────────

/**
 * Mengambil initial state untuk halaman Loket Kasir:
 * Status sesi kas operator, saldo kas fisik di laci, dan izin user.
 */
export async function getLoketInitialData(): Promise<{
  activeSession: FinanceCashSession | null
  summary: CashSessionTransactionSummary | null
  isViewOnly: boolean
  operator: { id: string; name: string; roles: string[] }
}> {
  const { userId, roles, operatorName, isViewOnly } = await authorizeLoketOperator()

  const activeSession = await getActiveCashSession(userId)
  let summary: CashSessionTransactionSummary | null = null

  if (activeSession) {
    summary = await getCashSessionSummary(activeSession.id)
  }

  return {
    activeSession,
    summary,
    isViewOnly,
    operator: {
      id: userId,
      name: operatorName,
      roles,
    },
  }
}

/**
 * Membuka sesi kas baru untuk operator.
 */
export async function openLoketCashSession(
  openingBalance: number,
  notes?: string
): Promise<FinanceCashSession> {
  const { userId } = await authorizeLoketOperator(true)
  return openCashSession(userId, openingBalance, notes)
}

/**
 * Menutup sesi kas dengan penghitungan fisik uang kas riil di laci loket
 * dan kalkulasi selisih (PRD #23).
 */
export async function closeLoketCashSession(
  sessionId: string,
  actualClosingBalance: number,
  notes?: string
): Promise<FinanceCashSession> {
  const { userId } = await authorizeLoketOperator(true)
  return closeCashSession(sessionId, userId, actualClosingBalance, notes)
}

// ─── PENCARIAN SANTRI & IDENTIFIKASI ───────────────────────────────────────

/**
 * Mencari santri untuk loket:
 * Mendukung input token QR (`crd_...`) atau NIS santri.
 * Mengembalikan foto besar, profil, status keaktifan kartu, dan status PIN.
 */
export async function lookupStudentForLoket(
  identifier: string
): Promise<StudentLoketProfile | null> {
  await authorizeLoketOperator()
  const clean = identifier.trim()
  if (!clean) return null

  let studentId: string | null = null
  let card: FinanceCredential | null = null

  // 1. Coba pencarian via Card Token (jika diawali "crd_" atau jika cocok di finance_credentials)
  const cardWithStudent = await findCardByToken(clean)
  if (cardWithStudent) {
    studentId = cardWithStudent.santri_id
    card = {
      id: cardWithStudent.id,
      santri_id: cardWithStudent.santri_id,
      card_token: cardWithStudent.card_token,
      status: cardWithStudent.status,
      issued_at: cardWithStudent.issued_at,
      issued_by: cardWithStudent.issued_by,
      revoked_at: cardWithStudent.revoked_at,
      revoked_by: cardWithStudent.revoked_by,
      revocation_reason: cardWithStudent.revocation_reason,
      created_at: cardWithStudent.created_at,
      updated_at: cardWithStudent.updated_at,
    }
  } else {
    // 2. Fallback pencarian santri via NIS atau ID
    const student = await queryOne<{ id: string }>(
      `SELECT id FROM santri WHERE nis = ? OR id = ? LIMIT 1`,
      [clean, clean]
    )
    if (student) {
      studentId = student.id
      card = await getActiveCard(student.id)
    }
  }

  if (!studentId) return null

  // 3. Ambil data lengkap santri
  const student = await queryOne<{
    id: string
    nis: string
    nama_lengkap: string
    jenis_kelamin: string
    asrama: string | null
    kamar: string | null
    foto_url: string | null
    status_global: string
  }>(
    `SELECT id, nis, nama_lengkap, jenis_kelamin, asrama, kamar, foto_url, status_global
     FROM santri
     WHERE id = ?`,
    [studentId]
  )

  if (!student) return null

  // 4. Ambil status PIN santri
  const pinStatus = await getStudentPinStatus(studentId)

  return {
    id: student.id,
    nis: student.nis,
    namaLengkap: student.nama_lengkap,
    jenisKelamin: student.jenis_kelamin,
    asrama: student.asrama,
    kamar: student.kamar,
    fotoUrl: student.foto_url,
    statusGlobal: student.status_global,
    card,
    pinStatus,
  }
}

// ─── VERIFIKASI PIN SANTRI ──────────────────────────────────────────────────

/**
 * Memverifikasi PIN santri di loket:
 * Melindungi dari brute-force (3x gagal -> temporary lockout 15 menit).
 * Jika berhasil, menghasilkan token verifikasi sementara (5 menit) untuk autorisasi penarikan.
 */
export async function verifyStudentLoketPin(
  santriId: string,
  pin: string
): Promise<{
  verified: boolean
  verificationToken?: string
  locked: boolean
  remainingLockSeconds?: number
  attemptsLeft: number
}> {
  await authorizeLoketOperator()
  const result = await verifyStudentPin(santriId, pin)

  if (result.verified) {
    const token = generateId()
    // Masa berlaku 5 menit
    verifiedPinSessions.set(token, {
      santriId,
      expiresAt: Date.now() + 5 * 60 * 1000,
    })

    return {
      verified: true,
      verificationToken: token,
      locked: false,
      remainingLockSeconds: 0,
      attemptsLeft: 3,
    }
  }

  return {
    verified: false,
    locked: result.locked,
    remainingLockSeconds: result.remainingLockSeconds,
    attemptsLeft: result.attemptsLeft,
  }
}

// ─── KEUANGAN & OBLIGASI SANTRI DI LOKET ───────────────────────────────────

/**
 * Mengambil data finansial santri setelah verifikasi identitas:
 * Saldo uang jajan, limit harian & sisa kuota, serta daftar tagihan belum lunas.
 */
export async function getStudentLoketAccountData(
  santriId: string
): Promise<StudentLoketFinancials> {
  await authorizeLoketOperator()

  const { balance, cachedBalance } = await getStudentWalletBalance(santriId)
  const limits = await evaluateWalletLimit(santriId)

  // Ambil kewajiban yang belum lunas
  const rows = await query<{
    id: string
    item_type: string
    period: string
    amount_expected: number
    amount_exempted: number
    amount_paid: number
    installment_rule: string | null
    provider_name: string | null
  }>(
    `SELECT o.id, o.item_type, o.period, o.amount_expected, o.amount_exempted, o.amount_paid,
            t.installment_rule, j.nama_jasa AS provider_name
     FROM finance_obligations o
     LEFT JOIN finance_tariffs t ON o.tariff_id = t.id
     LEFT JOIN master_jasa j ON o.provider_id = j.id
     WHERE o.santri_id = ? AND o.status IN ('UNPAID', 'PARTIALLY_PAID')
     ORDER BY o.period ASC, o.item_type ASC`,
    [santriId]
  )

  const unpaidObligations = rows.map(r => {
    const effectiveExpected = Math.max(0, r.amount_expected - r.amount_exempted)
    const remaining = Math.max(0, effectiveExpected - r.amount_paid)
    const rule = r.item_type === 'USPP'
      ? 'ALLOWED'
      : r.item_type === 'SPP'
      ? 'DISALLOWED'
      : ((r.installment_rule as 'ALLOWED' | 'DISALLOWED') || 'DISALLOWED')

    return {
      id: r.id,
      itemType: r.item_type,
      itemLabel: FINANCE_ITEM_LABELS[r.item_type as FinanceItemType] ?? r.item_type,
      period: r.period,
      amountExpected: r.amount_expected,
      amountExempted: r.amount_exempted,
      amountPaid: r.amount_paid,
      remaining,
      installmentRule: rule,
      providerName: r.provider_name,
    }
  })

  return {
    balance,
    cachedBalance,
    isSynced: balance === cachedBalance,
    limits,
    unpaidObligations,
  }
}

// ─── EKSEKUSI PENCAIRAN UANG JAJAN (WITHDRAWAL) ──────────────────────────────

/**
 * Mengeksekusi penarikan uang jajan santri di loket:
 * 1. Validasi sesi kas aktif operator.
 * 2. Validasi token verifikasi PIN santri.
 * 3. Validasi kartu santri berstatus ACTIVE.
 * 4. Validasi saldo mencukupi dan tidak melebihi sisa kuota limit harian.
 * 5. Perekaman mutasi buku besar finance_wallet_ledger ('WITHDRAWAL_LOKET', direction 'OUT').
 * 6. Pembaruan pengeluaran sesi kas (recordCashOutFromSession).
 * 7. Mengembalikan bukti struk transaksi.
 */
export async function executeLoketWithdrawal(
  input: LoketWithdrawalInput
): Promise<LoketWithdrawalReceipt> {
  const { userId, operatorName } = await authorizeLoketOperator(true)

  const amount = Math.floor(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal penarikan uang jajan harus bernilai lebih dari Rp0.')
  }

  const activeSession = await getActiveCashSession(userId)
  if (!activeSession) {
    throw new Error('Tidak ada sesi kas yang aktif. Buka sesi kas terlebih dahulu sebelum mencairkan uang.')
  }

  // 1. Validasi Token Verifikasi PIN
  const pinSession = verifiedPinSessions.get(input.verificationToken)
  if (!pinSession || pinSession.santriId !== input.santriId || Date.now() > pinSession.expiresAt) {
    throw new Error('Verifikasi PIN santri tidak valid atau telah kedaluwarsa. Masukkan PIN kembali.')
  }

  // 2. Validasi Santri & Kartu Aktif
  const student = await queryOne<{
    id: string
    nis: string
    nama_lengkap: string
    status_global: string
    asrama: string | null
    kamar: string | null
  }>(
    `SELECT id, nis, nama_lengkap, status_global, asrama, kamar FROM santri WHERE id = ?`,
    [input.santriId]
  )
  if (!student) {
    throw new Error(`Santri dengan ID "${input.santriId}" tidak ditemukan.`)
  }
  if (student.status_global !== 'aktif') {
    throw new Error(`Santri tidak aktif (status: ${student.status_global}).`)
  }

  const activeCard = await getActiveCard(input.santriId)
  if (!activeCard || activeCard.status !== 'ACTIVE') {
    throw new Error('Santri tidak memiliki kartu fisik aktif. Harap hubungi admin koperasi.')
  }

  // 3. Validasi Limit Penarikan Harian Bertingkat
  const limitEval = await evaluateWalletLimit(input.santriId)
  if (amount > limitEval.remainingDailyQuota) {
    throw new Error(
      `Nominal Rp${amount.toLocaleString('id-ID')} melebihi sisa kuota penarikan harian santri (Sisa limit: Rp${limitEval.remainingDailyQuota.toLocaleString('id-ID')}).`
    )
  }

  // 4. In-flight Lock Idempotency
  const extKey = input.idempotencyKey.trim() || generateId()
  const existingInFlight = inFlightTransactions.get(extKey)
  if (existingInFlight) {
    return existingInFlight as Promise<LoketWithdrawalReceipt>
  }

  const executionPromise = (async (): Promise<LoketWithdrawalReceipt> => {
    // 5. Eksekusi Mutasi Buku Besar Uang Jajan
    const ledgerEntry = await recordWalletMutation({
      santriId: input.santriId,
      direction: 'OUT',
      movementType: 'WITHDRAWAL_LOKET',
      amount,
      cashSessionId: activeSession.id,
      operatorId: userId,
      notes: input.notes || 'Pencairan uang jajan di loket kasir',
    })

    // 6. Catat kas keluar pada Sesi Kas
    await recordCashOutFromSession(activeSession.id, amount)

    // 7. Konsumsi token verifikasi PIN agar tidak dapat digunakan berulang
    verifiedPinSessions.delete(input.verificationToken)

    const receiptNumber = `WD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${ledgerEntry.id.slice(-6).toUpperCase()}`

    return {
      receiptNumber,
      type: 'WITHDRAWAL',
      santri: {
        id: student.id,
        nis: student.nis,
        namaLengkap: student.nama_lengkap,
        asrama: student.asrama,
        kamar: student.kamar,
      },
      amount,
      balanceBefore: ledgerEntry.balance_before,
      balanceAfter: ledgerEntry.balance_after,
      remainingDailyQuota: Math.max(0, limitEval.remainingDailyQuota - amount),
      timestamp: ledgerEntry.created_at,
      operatorName,
      sessionCode: activeSession.session_code,
      notes: ledgerEntry.notes,
    }
  })()

  inFlightTransactions.set(extKey, executionPromise)

  try {
    return await executionPromise
  } finally {
    inFlightTransactions.delete(extKey)
  }
}

// ─── EKSEKUSI PENYETORAN / PEMBAYARAN LOKET ────────────────────────────────

/**
 * Mengeksekusi penerimaan setoran uang jajan tunai atau pembayaran tagihan di loket:
 * 1. Menggunakan Payment Order Engine & Pembayaran Tunai Fase 3A/4C.
 * 2. Mendukung item tagihan sekolah (SPP, Makan, Cuci, dll.) dan/atau setoran UANG_JAJAN tunai.
 * 3. Jika memuat UANG_JAJAN, mencatat mutasi buku besar finance_wallet_ledger ('TOPUP_CASH', direction 'IN').
 * 4. Mengkinikan penerimaan kas pada Sesi Kas aktif (recordCashInToSession).
 * 5. Mengembalikan struk penerimaan pembayaran.
 */
export async function executeLoketDepositOrPayment(
  input: LoketPaymentInput
): Promise<LoketPaymentReceipt> {
  const { userId, operatorName } = await authorizeLoketOperator(true)

  if (!input.items || input.items.length === 0) {
    throw new Error('Pilih minimal 1 pos yang akan disetor atau dibayar.')
  }

  const activeSession = await getActiveCashSession(userId)
  if (!activeSession) {
    throw new Error('Tidak ada sesi kas yang aktif. Buka sesi kas terlebih dahulu sebelum menerima pembayaran.')
  }

  const student = await queryOne<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    status_global: string
  }>(
    `SELECT id, nis, nama_lengkap, asrama, kamar, status_global FROM santri WHERE id = ?`,
    [input.santriId]
  )
  if (!student) {
    throw new Error(`Santri dengan ID "${input.santriId}" tidak ditemukan.`)
  }
  if (student.status_global !== 'aktif') {
    throw new Error(`Santri tidak aktif (status: ${student.status_global}).`)
  }

  const extKey = input.idempotencyKey.trim() || generateId()
  const existingInFlight = inFlightTransactions.get(extKey)
  if (existingInFlight) {
    return existingInFlight as Promise<LoketPaymentReceipt>
  }

  const executionPromise = (async (): Promise<LoketPaymentReceipt> => {
    // 1. Validasi setiap item
    const obligationOrderItems: Array<{
      obligationId: string
      itemType: FinanceItemType
      amount: number
    }> = []

    let topupCashAmount = 0

    for (const it of input.items) {
      const amt = Math.floor(it.amount)
      if (amt <= 0) {
        throw new Error(`Nominal item "${it.itemType}" harus lebih besar dari Rp0.`)
      }

      if (it.itemType === 'UANG_JAJAN') {
        topupCashAmount += amt
      } else if (it.obligationId) {
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
          throw new Error(`Tagihan dengan ID "${it.obligationId}" tidak ditemukan.`)
        }
        if (ob.santri_id !== input.santriId) {
          throw new Error(`Tagihan "${ob.item_type}" bukan milik santri ${student.nama_lengkap}.`)
        }
        if (ob.status === 'PAID') {
          throw new Error(`Tagihan "${ob.item_type}" periode ${ob.period} sudah lunas.`)
        }
        if (ob.status === 'EXEMPTED') {
          throw new Error(`Tagihan "${ob.item_type}" periode ${ob.period} telah dibebaskan.`)
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

        obligationOrderItems.push({
          obligationId: ob.id,
          itemType: ob.item_type as FinanceItemType,
          amount: amt,
        })
      } else {
        throw new Error(`Item ${it.itemType} tidak memiliki obligation ID.`)
      }
    }

    let paymentId: string | null = null
    let paymentGross = 0
    let paidTimestamp = now()

    // 2. Jika ada pembayaran tagihan kewajiban, buat Payment Order & catat pembayaran
    if (obligationOrderItems.length > 0) {
      const order = await createPaymentOrder({
        santriId: input.santriId,
        payerType: 'LOKET',
        items: obligationOrderItems,
        paymentMethod: 'CASH',
        feePayer: 'CUSTOMER',
        gatewayFee: 0,
        cashSessionId: activeSession.id,
      })

      // CATATAN AUDIT: Pembayaran tunai loket berstatus PAID (bukan SETTLED),
      // dicatat pada channel CASH, dan tidak pernah membuat gateway settlement items.
      const payment = await recordOrderPayment({
        orderId: order.id,
        channel: 'CASH',
        method: 'CASH',
        externalReference: extKey,
        gatewayFee: 0,
        cashSessionId: activeSession.id,
        receivedBy: userId,
      })

      paymentId = payment.id
      paymentGross = payment.gross_amount
      paidTimestamp = payment.paid_at
    }

    // 3. Jika ada setoran Uang Jajan, catat ke finance_wallet_ledger
    let walletBalanceAfter: number | null = null
    let topupLedgerId: string | null = null
    if (topupCashAmount > 0) {
      const ledgerEntry = await recordWalletMutation({
        santriId: input.santriId,
        direction: 'IN',
        movementType: 'TOPUP_CASH',
        amount: topupCashAmount,
        referenceId: null,
        cashSessionId: activeSession.id,
        operatorId: userId,
        notes: input.notes || 'Setoran tunai uang jajan di loket kasir',
      })
      walletBalanceAfter = ledgerEntry.balance_after
      topupLedgerId = ledgerEntry.id
    }

    const totalCashReceived = paymentGross + topupCashAmount

    // 4. Update cash-in sesi kas (live derived cache)
    await recordCashInToSession(activeSession.id, totalCashReceived)

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const receiptNumber = paymentId
      ? `PAY-${datePrefix}-${paymentId.slice(-6).toUpperCase()}`
      : `DEP-${datePrefix}-${(topupLedgerId ?? generateId()).slice(-6).toUpperCase()}`

    const receiptItems: Array<{
      itemType: LoketItemType
      itemLabel: string
      amount: number
    }> = []

    if (topupCashAmount > 0) {
      receiptItems.push({
        itemType: 'UANG_JAJAN',
        itemLabel: 'Top-up Uang Jajan',
        amount: topupCashAmount,
      })
    }

    for (const it of obligationOrderItems) {
      receiptItems.push({
        itemType: it.itemType,
        itemLabel: FINANCE_ITEM_LABELS[it.itemType] ?? it.itemType,
        amount: it.amount,
      })
    }

    return {
      receiptNumber,
      type: 'PAYMENT_OR_DEPOSIT',
      santri: {
        id: student.id,
        nis: student.nis,
        namaLengkap: student.nama_lengkap,
        asrama: student.asrama,
        kamar: student.kamar,
      },
      grossAmount: totalCashReceived,
      timestamp: paidTimestamp,
      operatorName,
      sessionCode: activeSession.session_code,
      items: receiptItems,
      walletBalanceAfter,
    }
  })()

  inFlightTransactions.set(extKey, executionPromise)

  try {
    return await executionPromise
  } finally {
    inFlightTransactions.delete(extKey)
  }
}

// ─── RIWAYAT TRANSAKSI SESI INI & SESI SEBELUMNYA ──────────────────────────

/**
 * Mengambil histori seluruh transaksi (penarikan, pembayaran, setoran) yang terjadi dalam sesi kas ini.
 */
export async function getLoketCurrentSessionTransactions(
  sessionId: string
): Promise<LoketSessionTransactionItem[]> {
  await authorizeLoketOperator()

  // 1. Ambil penarikan dari finance_wallet_ledger
  const withdrawals = await query<{
    id: string
    movement_type: string
    amount: number
    santri_nama: string
    santri_nis: string
    reference_id: string | null
    created_at: string
    operator_name: string | null
  }>(
    `SELECT l.id, l.movement_type, l.amount, s.nama_lengkap AS santri_nama, s.nis AS santri_nis,
            l.reference_id, l.created_at, u.full_name AS operator_name
     FROM finance_wallet_ledger l
     JOIN santri s ON s.id = l.santri_id
     LEFT JOIN users u ON u.id = l.operator_id
     WHERE l.cash_session_id = ?
     ORDER BY l.created_at DESC`,
    [sessionId]
  )

  // 2. Ambil pembayaran dari finance_payments
  const payments = await query<{
    id: string
    payment_number: string
    gross_amount: number
    santri_nama: string
    santri_nis: string
    paid_at: string
    operator_name: string | null
  }>(
    `SELECT p.id, p.payment_number, p.gross_amount, s.nama_lengkap AS santri_nama, s.nis AS santri_nis,
            p.paid_at, u.full_name AS operator_name
     FROM finance_payments p
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN users u ON u.id = p.received_by
     WHERE p.cash_session_id = ? AND p.channel = 'CASH'
     ORDER BY p.paid_at DESC`,
    [sessionId]
  )

  const items: LoketSessionTransactionItem[] = []

  for (const w of withdrawals) {
    const isTopup = w.movement_type === 'TOPUP_CASH'
    items.push({
      id: w.id,
      type: isTopup ? 'TOPUP_CASH' : 'WITHDRAWAL',
      typeLabel: isTopup ? 'Setoran Uang Jajan' : 'Penarikan Uang Jajan',
      amount: w.amount,
      santriNama: w.santri_nama,
      santriNis: w.santri_nis,
      referenceId: w.reference_id,
      createdAt: w.created_at,
      operatorName: w.operator_name,
    })
  }

  for (const p of payments) {
    items.push({
      id: p.id,
      type: 'PAYMENT',
      typeLabel: 'Pembayaran Tagihan',
      amount: p.gross_amount,
      santriNama: p.santri_nama,
      santriNis: p.santri_nis,
      referenceId: p.payment_number,
      createdAt: p.paid_at,
      operatorName: p.operator_name,
    })
  }

  // Sort by date DESC
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return items
}

/**
 * Mengambil riwayat sesi-sesi kas sebelumnya.
 */
export async function getPastCashSessions(options?: {
  page?: number
  pageSize?: number
}): Promise<{ items: FinanceCashSession[]; total: number }> {
  await authorizeLoketOperator()
  return getCashSessionHistory(options)
}
